"""Agnostic Inbound Email Poller using standard IMAP for automated customer inquiry ingestion and ticket correlation."""
import asyncio
import email
from email.header import decode_header
import email.utils
import imaplib
import logging
import re
from typing import Optional

from sqlalchemy import select, cast, String
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.inquiry import Inquiry
from app.schemas.inquiry import ChannelEnum, CustomerReplyCreate, InquiryCreate
from app.services.bedrock_service import get_bedrock_service

logger = logging.getLogger("app.services.inbound_email_poller")

TICKET_ID_REGEX = re.compile(r"(?:\[Ticket #|Ticket #)([A-Fa-f0-9\-]{8,36})\]?", re.IGNORECASE)


def _decode_mime_header(header_value: Optional[str]) -> str:
    """Safely decode RFC 2047 MIME encoded headers."""
    if not header_value:
        return ""
    decoded_fragments = decode_header(header_value)
    result = []
    for fragment, encoding in decoded_fragments:
        if isinstance(fragment, bytes):
            result.append(fragment.decode(encoding or "utf-8", errors="replace"))
        else:
            result.append(str(fragment))
    return "".join(result).strip()


def _extract_text_body(msg: email.message.Message) -> str:
    """Extract plain text body from multipart or single-part MIME message."""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = part.get("Content-Disposition", "")
            if content_type == "text/plain" and "attachment" not in content_disposition:
                payload = part.get_payload(decode=True)
                if isinstance(payload, bytes):
                    charset = part.get_content_charset() or "utf-8"
                    return payload.decode(charset, errors="replace").strip()
                elif isinstance(payload, str):
                    return payload.strip()
        # Fallback to text/html if no text/plain found
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                payload = part.get_payload(decode=True)
                if isinstance(payload, bytes):
                    charset = part.get_content_charset() or "utf-8"
                    return payload.decode(charset, errors="replace").strip()
                elif isinstance(payload, str):
                    return payload.strip()
    else:
        payload = msg.get_payload(decode=True)
        if isinstance(payload, bytes):
            charset = msg.get_content_charset() or "utf-8"
            return payload.decode(charset, errors="replace").strip()
        elif isinstance(payload, str):
            return payload.strip()
    return ""


class InboundEmailPoller:
    """Asynchronous background worker checking support inbox for incoming customer inquiries and replies."""

    def __init__(self):
        self.host = settings.IMAP_HOST
        self.port = settings.IMAP_PORT
        self.user = settings.IMAP_USER
        self.password = settings.IMAP_PASSWORD
        self.use_ssl = settings.IMAP_USE_SSL
        self.poll_interval = settings.INBOUND_EMAIL_POLL_INTERVAL_SECONDS
        self.is_enabled = settings.INBOUND_EMAIL_POLL_ENABLED
        self._task: Optional[asyncio.Task] = None
        self._running = False

    def start(self):
        """Start the background polling task if enabled (via IMAP or S3 SES bucket)."""
        has_imap = self.is_enabled and self.host and self.user and self.password
        has_s3_ses = bool(settings.SES_INBOUND_BUCKET_NAME)

        if not has_imap and not has_s3_ses:
            logger.info("Inbound Email Poller is disabled (no IMAP or SES S3 bucket configured).")
            return

        self._running = True
        self._task = asyncio.create_task(self._poll_loop())
        mode = "S3 SES + IMAP" if (has_s3_ses and has_imap) else ("S3 SES" if has_s3_ses else "IMAP")
        logger.info(f"Inbound Email Poller started in [{mode}] mode (polling every {self.poll_interval}s).")

    async def stop(self):
        """Gracefully stop the polling task."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Inbound Email Poller stopped.")

    async def _poll_loop(self):
        """Continuous polling loop executing in the background."""
        while self._running:
            try:
                # 1. Process real inbound emails deposited by Amazon SES in S3
                if settings.SES_INBOUND_BUCKET_NAME:
                    await asyncio.to_thread(self._check_and_process_s3_ses_emails)

                # 2. Process external IMAP inbox if configured
                if self.is_enabled and self.host and self.user and self.password:
                    await asyncio.to_thread(self._check_and_process_emails)
            except Exception as exc:
                logger.warning(f"Error during inbound email polling: {exc}")
            await asyncio.sleep(self.poll_interval)

    def _check_and_process_s3_ses_emails(self):
        """Check Amazon SES S3 inbound bucket for raw customer emails and ingest them."""
        bucket_name = settings.SES_INBOUND_BUCKET_NAME
        if not bucket_name:
            return

        try:
            import boto3
            s3 = boto3.client("s3", region_name=settings.AWS_REGION)
            res = s3.list_objects_v2(Bucket=bucket_name, MaxKeys=10)
            contents = res.get("Contents", [])
            for item in contents:
                key = item["Key"]
                if key.endswith("/") or item.get("Size", 0) == 0:
                    continue
                try:
                    obj = s3.get_object(Bucket=bucket_name, Key=key)
                    raw_bytes = obj["Body"].read()
                    msg = email.message_from_bytes(raw_bytes)

                    raw_from = _decode_mime_header(msg.get("From"))
                    sender_name, sender_email = email.utils.parseaddr(raw_from)
                    subject = _decode_mime_header(msg.get("Subject"))
                    body = _extract_text_body(msg) or "(Empty email body)"

                    logger.info(f"S3 SES inbound email received from {sender_email} subject: '{subject}'")

                    asyncio.run(self._dispatch_parsed_email(sender_name or sender_email, sender_email, subject, body))

                    s3.delete_object(Bucket=bucket_name, Key=key)
                    logger.info(f"Processed and deleted S3 inbound email: {key}")
                except Exception as item_exc:
                    logger.error(f"Error processing S3 inbound email {key}: {item_exc}")
        except Exception as exc:
            logger.debug(f"S3 SES polling check deferred: {exc}")

    def _check_and_process_emails(self):
        """Synchronous IMAP fetch and parse logic executed inside worker thread."""
        if not self.host or not self.user or not self.password:
            logger.debug("IMAP host, user, or password not configured. Skipping poll cycle.")
            return

        mail = None
        try:
            if self.use_ssl:
                mail = imaplib.IMAP4_SSL(self.host, self.port)
            else:
                mail = imaplib.IMAP4(self.host, self.port)

            mail.login(self.user, self.password)
            mail.select("INBOX")

            # Search for unread emails
            status, messages = mail.search(None, "UNSEEN")
            if status != "OK" or not messages or not messages[0]:
                return

            email_ids = messages[0].split()
            for eid in email_ids:
                res, data = mail.fetch(eid, "(RFC822)")
                if res != "OK" or not data or not data[0]:
                    continue

                raw_email = data[0][1]
                if not isinstance(raw_email, (bytes, bytearray)):
                    continue
                msg = email.message_from_bytes(raw_email)

                raw_from = _decode_mime_header(msg.get("From"))
                sender_name, sender_email = email.utils.parseaddr(raw_from)
                subject = _decode_mime_header(msg.get("Subject"))
                body = _extract_text_body(msg) or "(Empty email body)"

                logger.info(f"Inbound email received from {sender_email} with subject: '{subject}'")

                # Process email asynchronously via database
                asyncio.run(self._dispatch_parsed_email(sender_name or sender_email, sender_email, subject, body))

                # Mark message as read
                mail.store(eid, "+FLAGS", "\\Seen")

        except Exception as exc:
            logger.error(f"IMAP connection or parsing exception: {exc}")
        finally:
            if mail:
                try:
                    mail.close()
                    mail.logout()
                except Exception:
                    pass

    async def _dispatch_parsed_email(self, customer_name: str, customer_email: str, subject: str, body: str):
        """Correlate to existing ticket or create new inquiry with Bedrock triage."""
        match = TICKET_ID_REGEX.search(subject)
        async with AsyncSessionLocal() as db:
            if match:
                short_id = match.group(1).lower()
                # Find ticket by prefix or full ID
                stmt = select(Inquiry).options(selectinload(Inquiry.messages)).where(
                    cast(Inquiry.id, String).ilike(f"{short_id}%")
                )
                res = await db.execute(stmt)
                inquiry = res.scalar_one_or_none()

                if inquiry:
                    logger.info(f"Auto-correlating reply to existing Ticket #{inquiry.id} from {customer_email}")
                    from app.api.v1.inquiries import post_customer_reply
                    reply_payload = CustomerReplyCreate(
                        body=body,
                        customer_name=customer_name,
                        customer_email=customer_email,
                    )
                    await post_customer_reply(inquiry_id=inquiry.id, payload=reply_payload, db=db)
                    return

            # No ticket reference matched: enqueue to SQS FIFO buffer
            from app.services.sqs_service import get_sqs_service
            sqs = get_sqs_service()
            tracking_id = await sqs.send_inquiry(
                {
                    "channel": ChannelEnum.EMAIL.value,
                    "customer_name": customer_name or "External Customer",
                    "customer_email": customer_email or "unknown@external.com",
                    "subject": subject,
                    "body": body,
                },
                group_id="email",
            )
            logger.info(f"Enqueued external inbound email into SQS FIFO buffer: tracking_id={tracking_id}")


# Singleton instance
_inbound_poller_instance: Optional[InboundEmailPoller] = None


def get_inbound_email_poller() -> InboundEmailPoller:
    """Provide singleton instance of InboundEmailPoller."""
    global _inbound_poller_instance
    if _inbound_poller_instance is None:
        _inbound_poller_instance = InboundEmailPoller()
    return _inbound_poller_instance
