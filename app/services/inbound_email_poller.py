"""Agnostic Inbound Email Poller using Amazon SES S3 receipts and standard IMAP for automated customer inquiry ingestion and ticket correlation."""
import asyncio
import email
from email.header import decode_header
import email.utils
import imaplib
import logging
from typing import List, Optional

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.schemas.inquiry import ChannelEnum, CustomerReplyCreate
from app.services.email_filter import is_automated_delivery_failure_or_loop, extract_customer_name_from_body
from app.services.email_thread import (
    extract_reference_message_ids,
    resolve_inbound_ticket,
    strip_quoted_history,
)
from app.services.bedrock_service import get_bedrock_service

logger = logging.getLogger("app.services.inbound_email_poller")


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
                if settings.SES_INBOUND_BUCKET_NAME:
                    for parsed in await asyncio.to_thread(self._collect_s3_ses_emails):
                        await self._consume_parsed_email(
                            parsed,
                            source="S3_SES",
                            delete_key=parsed.get("s3_key"),
                        )

                if self.is_enabled and self.host and self.user and self.password:
                    for parsed in await asyncio.to_thread(self._collect_imap_emails):
                        await self._consume_parsed_email(parsed, source="IMAP")
            except Exception as exc:
                logger.warning(f"Error during inbound email polling: {exc}")
            await asyncio.sleep(self.poll_interval)

    async def _consume_parsed_email(self, parsed: dict, source: str, delete_key: Optional[str] = None) -> bool:
        """Dispatch a parsed inbound email and acknowledge the transport payload only on success.

        The S3 object is deleted strictly after the correlation transaction commits, so a
        transient database or AI failure leaves the object in place for the next poll cycle
        instead of silently discarding the customer message.
        """
        try:
            accepted = await self._dispatch_parsed_email(
                customer_name=parsed["customer_name"],
                customer_email=parsed["customer_email"],
                subject=parsed["subject"],
                body=parsed["body"],
                reference_message_ids=parsed.get("reference_message_ids"),
                ticket_reference=parsed.get("ticket_reference"),
            )
        except Exception as exc:
            logger.error(f"Failed to dispatch {source} inbound email from {parsed.get('customer_email')}: {exc}")
            return False

        if accepted and delete_key:
            await asyncio.to_thread(self._delete_s3_object, delete_key)
        return accepted

    def _delete_s3_object(self, key: str) -> None:
        """Remove a fully processed inbound email object from the SES receipt bucket."""
        bucket_name = settings.SES_INBOUND_BUCKET_NAME
        if not bucket_name or not key:
            return
        try:
            import boto3

            boto3.client("s3", region_name=settings.AWS_REGION).delete_object(Bucket=bucket_name, Key=key)
            logger.info(f"Deleted processed S3 inbound email object: {key}")
        except Exception as exc:
            logger.warning(f"Unable to delete S3 inbound email object {key}: {exc}")

    @staticmethod
    def _parse_raw_message(raw_bytes: bytes) -> Optional[dict]:
        """Parse a raw RFC 5322 payload into a normalized inbound email envelope."""
        try:
            msg = email.message_from_bytes(raw_bytes)
        except Exception as exc:
            logger.error(f"Unable to parse raw inbound email payload: {exc}")
            return None

        raw_from = _decode_mime_header(msg.get("From"))
        sender_name, sender_email = email.utils.parseaddr(raw_from)
        if not sender_email:
            logger.warning("Inbound email discarded: no parsable From address.")
            return None

        subject = _decode_mime_header(msg.get("Subject"))
        raw_body = _extract_text_body(msg)
        body = strip_quoted_history(raw_body) or raw_body or "(Empty email body)"

        reference_message_ids = extract_reference_message_ids(
            _decode_mime_header(msg.get("In-Reply-To")),
            _decode_mime_header(msg.get("References")),
        )
        header_ticket_reference = _decode_mime_header(msg.get("X-Ticket-Id")) or None

        resolved_name = extract_customer_name_from_body(
            body=strip_quoted_history(raw_body) or raw_body,
            fallback_name=sender_name,
            sender_email=sender_email,
        )
        return {
            "customer_name": resolved_name,
            "customer_email": sender_email,
            "subject": subject,
            "body": body,
            "reference_message_ids": reference_message_ids,
            "ticket_reference": header_ticket_reference,
        }

    def _collect_s3_ses_emails(self) -> List[dict]:
        """Check Amazon SES S3 inbound bucket for raw customer emails. Returns parsed email dicts."""
        bucket_name = settings.SES_INBOUND_BUCKET_NAME
        if not bucket_name:
            return []

        results: List[dict] = []
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
                    parsed = self._parse_raw_message(obj["Body"].read())
                    if parsed is None:
                        s3.delete_object(Bucket=bucket_name, Key=key)
                        continue
                    parsed["s3_key"] = key
                    logger.info(
                        f"S3 SES inbound email received from {parsed['customer_email']} "
                        f"({parsed['customer_name']}) subject: '{parsed['subject']}'"
                    )
                    results.append(parsed)
                except Exception as item_exc:
                    logger.error(f"Error processing S3 inbound email {key}: {item_exc}")
        except Exception as exc:
            logger.debug(f"S3 SES polling check deferred: {exc}")
        return results

    def _collect_imap_emails(self) -> List[dict]:
        """Synchronous IMAP fetch and parse logic executed inside worker thread. Returns parsed email dicts."""
        if not self.host or not self.user or not self.password:
            logger.debug("IMAP host, user, or password not configured. Skipping poll cycle.")
            return []

        results: List[dict] = []
        mail = None
        try:
            if self.use_ssl:
                mail = imaplib.IMAP4_SSL(self.host, self.port)
            else:
                mail = imaplib.IMAP4(self.host, self.port)

            mail.login(self.user, self.password)
            mail.select("INBOX")

            status, messages = mail.search(None, "UNSEEN")
            if status != "OK" or not messages or not messages[0]:
                return results

            email_ids = messages[0].split()
            for eid in email_ids:
                res, data = mail.fetch(eid, "(RFC822)")
                if res != "OK" or not data or not data[0]:
                    continue

                raw_email = data[0][1]
                if not isinstance(raw_email, (bytes, bytearray)):
                    continue

                parsed = self._parse_raw_message(bytes(raw_email))
                if parsed is None:
                    mail.store(eid, "+FLAGS", "\\Seen")
                    continue

                parsed["imap_id"] = eid
                logger.info(
                    f"Inbound email received from {parsed['customer_email']} "
                    f"({parsed['customer_name']}) with subject: '{parsed['subject']}'"
                )
                results.append(parsed)

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
        return results

    async def _dispatch_parsed_email(
        self,
        customer_name: str,
        customer_email: str,
        subject: str,
        body: str,
        reference_message_ids: Optional[List[str]] = None,
        ticket_reference: Optional[str] = None,
    ) -> bool:
        """Correlate to an existing ticket thread or enqueue a new inquiry for Bedrock triage.

        Returns True when the inbound email was accepted for processing.
        """
        # 0. Retain only newly authored text; quoted history is already stored in the ticket thread
        body = strip_quoted_history(body) or body

        is_filtered, reason = is_automated_delivery_failure_or_loop(customer_email, subject, body)
        if is_filtered:
            logger.info(f"Silently dropped automated inbound email from {customer_email} - Reason: {reason}")
            return True

        async with AsyncSessionLocal() as db:
            inquiry, strategy = await resolve_inbound_ticket(
                db,
                customer_email=customer_email,
                subject=subject,
                reference_message_ids=reference_message_ids,
                ticket_reference=ticket_reference,
            )

            if inquiry is not None:
                logger.info(
                    f"Auto-correlating inbound email from {customer_email} to ticket {inquiry.id} ({strategy})"
                )
                from app.api.v1.inquiries import post_customer_reply

                reply_payload = CustomerReplyCreate(
                    body=body,
                    customer_name=customer_name,
                    customer_email=customer_email,
                )
                await post_customer_reply(inquiry_id=inquiry.id, payload=reply_payload, db=db)
                await db.commit()
                return True

        # No unambiguous ticket correlation: enqueue to SQS FIFO buffer for full AI triage
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
        return True


_inbound_poller_instance: Optional[InboundEmailPoller] = None


def get_inbound_email_poller() -> InboundEmailPoller:
    """Provide singleton instance of InboundEmailPoller."""
    global _inbound_poller_instance
    if _inbound_poller_instance is None:
        _inbound_poller_instance = InboundEmailPoller()
    return _inbound_poller_instance
