"""Agnostic Outbound Email Service supporting Amazon SES, standard SMTP, and mock dev delivery."""
import asyncio
import email.mime.multipart
import email.mime.text
import logging
import smtplib
import uuid
from typing import Dict, Any, List, Optional
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError, NoCredentialsError

from app.core.config import settings

logger = logging.getLogger("app.services.email_service")


def _plain_text_to_html(plain_text: str) -> str:
    """Render the plain text notification body as a minimal HTML alternative.

    Mail clients that render HTML only would otherwise flatten the body without any
    paragraph structure, degrading readability of the AI-authored message.
    """
    escaped = (
        (plain_text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )
    paragraphs = [block.replace("\n", "<br />") for block in escaped.split("\n\n")]
    body_html = "".join(f"<p>{block}</p>" for block in paragraphs if block.strip())
    return (
        '<!DOCTYPE html><html><body style="font-family:Arial,Helvetica,sans-serif;'
        'font-size:14px;color:#111827;line-height:1.5;">'
        f"{body_html}</body></html>"
    )


class EmailService:
    """Outbound email dispatcher grounded in company profile configuration."""

    def __init__(self):
        self.company_name = settings.COMPANY_NAME
        self.company_domain = settings.COMPANY_DOMAIN
        self.support_email = settings.SUPPORT_EMAIL
        self.from_email = settings.SMTP_FROM_EMAIL or settings.SUPPORT_EMAIL

        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.smtp_use_tls = settings.SMTP_USE_TLS

        self.outbox: List[Dict[str, Any]] = []

        self._ses_client = None

    def _get_ses_client(self):
        if self._ses_client is None:
            try:
                ses_config = Config(
                    connect_timeout=2,
                    read_timeout=3,
                    retries={"max_attempts": 1, "mode": "standard"},
                )
                self._ses_client = boto3.client("sesv2", region_name=settings.AWS_REGION, config=ses_config)
            except Exception as exc:
                logger.debug(f"Unable to instantiate SES client: {exc}")
                self._ses_client = None
        return self._ses_client

    def _resolve_verified_sender(self) -> str:
        """Resolve an active verified Amazon SES email sender, preferring the support mailbox.

        The envelope sender must be a verified SES identity and must terminate on the inbound
        receipt rule domain, otherwise customer replies are never deposited for ingestion.
        """
        ses_client = self._get_ses_client()
        if not ses_client:
            return self.from_email or self.support_email

        try:
            response = ses_client.list_email_identities()
            identities = [
                entry.get("IdentityName", "")
                for entry in response.get("EmailIdentities", [])
                if entry.get("IdentityType") != "EMAIL_ADDRESS"
            ] + [
                entry.get("IdentityName", "")
                for entry in response.get("EmailIdentities", [])
                if entry.get("IdentityType") == "EMAIL_ADDRESS"
            ]
            verified_emails = [ident for ident in identities if "@" in ident]
            verified_domains = [ident for ident in identities if "@" not in ident]

            candidates = [self.support_email, self.from_email]
            for candidate in candidates:
                if not candidate or "@" not in candidate:
                    continue
                if candidate in identities or candidate.split("@")[1] in identities:
                    return candidate

            for identity in verified_emails:
                if identity.split("@")[1] == self.company_domain:
                    return identity
            if verified_domains:
                return f"support@{verified_domains[0]}"
            if verified_emails:
                return verified_emails[0]
        except Exception as exc:
            logger.debug(f"Unable to query SES verified identities: {exc}")

        return self.from_email or self.support_email

    def _build_rfc5322_message_id(self, ticket_id: str) -> str:
        """Generate a globally unique RFC 5322 Message-ID for thread correlation."""
        return f"<{uuid.uuid4().hex}.{str(ticket_id).replace('-', '')[:12]}@{self.company_domain}>"

    @staticmethod
    def _thread_headers(
        message_id: str,
        ticket_id: str,
        in_reply_to: Optional[str],
        references: Optional[str],
    ) -> List[Dict[str, str]]:
        """Assemble threading headers accepted by the Amazon SES v2 SendEmail API.

        Amazon SES owns the Message-ID header and rejects it as a custom header, so it is
        only supplied through the SMTP transport. In-Reply-To and References are accepted and
        drive native conversation threading in the customer's mail client.
        """
        headers: List[Dict[str, str]] = []
        if in_reply_to:
            headers.append({"Name": "In-Reply-To", "Value": in_reply_to})
            headers.append({"Name": "References", "Value": references or in_reply_to})
        headers.append({"Name": "X-Ticket-Id", "Value": str(ticket_id)})
        return headers

    async def send_customer_notification(
        self,
        customer_email: str,
        customer_name: str,
        ticket_id: str,
        ticket_subject: str,
        message_body: str,
        action_type: str = "REPLY",
        agent_name: str = "Support Specialist",
        in_reply_to: Optional[str] = None,
        references: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Dispatch real outbound notification to customer's personal email inbox.

        The message body is transmitted verbatim. The AI-authored draft already contains its
        own greeting, content and sign-off, so no wrapper envelope, header block, separator or
        portal link is injected, which would duplicate content in the customer's inbox.
        """
        short_id = ticket_id[:8].upper()
        subject = f"[Ticket #{short_id}] {ticket_subject}"
        rfc5322_message_id = self._build_rfc5322_message_id(ticket_id)

        text_lines = [
            (message_body or "").strip(),
            "",
            "Reply directly to this email to continue this ticket.",
        ]
        plain_text = "\n".join(text_lines)

        delivery_result: Dict[str, Any] = {
            "ticket_id": ticket_id,
            "recipient": customer_email,
            "sender": self.from_email,
            "subject": subject,
            "action_type": action_type,
            "channel": "OUTBOUND_EMAIL",
            "status": "SENT",
            "provider": "MOCK",
            "body": plain_text,
        }

        # 1. Try Amazon SES v2 (non-blocking thread execution with timeout guardrails).
        #    SES v2 is required because the SES v1 SendEmail API cannot emit custom RFC 5322 headers.
        ses_client = self._get_ses_client()
        if ses_client:
            try:
                # Use dynamically resolved verified identity for Amazon SES envelope sender
                active_sender = self._resolve_verified_sender()
                loop = asyncio.get_running_loop()
                ses_res = await loop.run_in_executor(
                    None,
                    lambda: ses_client.send_email(
                        FromEmailAddress=active_sender,
                        Destination={"ToAddresses": [customer_email]},
                        ReplyToAddresses=[self.support_email],
                        Content={
                            "Simple": {
                                "Subject": {"Data": subject, "Charset": "UTF-8"},
                                "Body": {
                                    "Text": {"Data": plain_text, "Charset": "UTF-8"},
                                    "Html": {"Data": _plain_text_to_html(plain_text), "Charset": "UTF-8"},
                                },
                                "Headers": self._thread_headers(rfc5322_message_id, ticket_id, in_reply_to, references),
                            }
                        },
                    ),
                )
                logger.info(f"Email dispatched via Amazon SES to {customer_email}: MessageId={ses_res.get('MessageId')}")
                delivery_result["provider"] = "AMAZON_SES"
                # Amazon SES owns the Message-ID header and overwrites it, so no correlatable
                # RFC 5322 identifier is available for inbound reference correlation.
                delivery_result["message_id"] = None
                delivery_result["transport_message_id"] = ses_res.get("MessageId")
                self.outbox.append(delivery_result)
                return delivery_result
            except Exception as exc:
                logger.warning(f"SES delivery bypassed/failed: {exc}. Attempting SMTP fallback.")

        if self.smtp_host and self.smtp_user and self.smtp_password:
            try:
                def _send_smtp():
                    msg = email.mime.multipart.MIMEMultipart("alternative")
                    msg["Subject"] = subject
                    msg["From"] = self.from_email
                    msg["To"] = customer_email
                    msg["Reply-To"] = self.support_email
                    msg["Message-ID"] = rfc5322_message_id
                    if in_reply_to:
                        msg["In-Reply-To"] = in_reply_to
                        msg["References"] = references or in_reply_to
                    msg["X-Ticket-Id"] = str(ticket_id)
                    msg.attach(email.mime.text.MIMEText(plain_text, "plain", "utf-8"))
                    msg.attach(email.mime.text.MIMEText(_plain_text_to_html(plain_text), "html", "utf-8"))

                    with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=5) as server:
                        if self.smtp_use_tls:
                            server.starttls()
                        server.login(self.smtp_user, self.smtp_password)
                        server.sendmail(self.from_email, [customer_email], msg.as_string())

                loop = asyncio.get_running_loop()
                await loop.run_in_executor(None, _send_smtp)
                logger.info(f"Email successfully delivered via SMTP ({self.smtp_host}) to {customer_email}")
                delivery_result["provider"] = "SMTP"
                delivery_result["message_id"] = rfc5322_message_id
                self.outbox.append(delivery_result)
                return delivery_result
            except Exception as exc:
                logger.warning(f"SMTP delivery failed: {exc}. Falling back to dev logger outbox.")

        logger.info(
            f"[OUTBOUND EMAIL DISPATCHED] To: {customer_email} | From: {self.from_email} | Action: {action_type} | Subject: {subject}"
        )
        delivery_result["provider"] = "LOCAL_OUTBOX"
        delivery_result["message_id"] = rfc5322_message_id
        self.outbox.append(delivery_result)
        return delivery_result

    async def send_proactive_sla_warning(
        self,
        manager_email: str,
        ticket_id: str,
        priority: str,
        customer_name: str,
        ticket_subject: str,
        remaining_minutes: int,
        department: str,
    ) -> Dict[str, Any]:
        """Dispatch early warning escalation email before an SLA deadline breaches."""
        short_id = ticket_id[:8].upper()
        subject = f"[EARLY WARNING] {priority} Ticket #{short_id} SLA Breach Imminent ({remaining_minutes}m Remaining)"
        body = (
            f"PROACTIVE SLA RISK ALERT\n\n"
            f"The following {priority} customer ticket is within {remaining_minutes} minutes of breaching its contractual SLA deadline:\n"
            f"- Ticket ID: #{short_id} ({ticket_id})\n"
            f"- Priority: {priority}\n"
            f"- Department: {department}\n"
            f"- Customer: {customer_name}\n"
            f"- Subject: {ticket_subject}\n"
            f"- Time Remaining: {remaining_minutes} minutes\n\n"
            f"Proactive assignment or agent intervention is required immediately to prevent breach penalties.\n"
            f"Access the Operations Console: http://localhost:5173\n\n"
            f"{self.company_name} Incident Prevention & Monitoring"
        )
        return await self._dispatch_generic_email(
            recipient=manager_email,
            subject=subject,
            body=body,
            category="PROACTIVE_SLA_WARNING",
        )

    async def send_sla_breach_escalation(
        self,
        manager_email: str,
        ticket_id: str,
        priority: str,
        customer_name: str,
        ticket_subject: str,
        overdue_minutes: int,
        department: str,
    ) -> Dict[str, Any]:
        """Dispatch high-priority escalation email to operations leadership when an SLA deadline is breached."""
        short_id = ticket_id[:8].upper()
        subject = f"[CRITICAL SLA BREACH] {priority} Ticket #{short_id} Overdue ({overdue_minutes}m)"
        body = (
            f"URGENT OPERATIONAL ESCALATION\n\n"
            f"The following {priority} customer ticket has breached its contractual SLA resolution deadline:\n"
            f"- Ticket ID: #{short_id} ({ticket_id})\n"
            f"- Priority: {priority}\n"
            f"- Department: {department}\n"
            f"- Customer: {customer_name}\n"
            f"- Subject: {ticket_subject}\n"
            f"- Time Overdue: {overdue_minutes} minutes\n\n"
            f"Immediate supervisor action is required to avoid financial breach penalties.\n"
            f"Access the Operations Console to triage: http://localhost:5173\n\n"
            f"{self.company_name} Incident Management Engine"
        )
        return await self._dispatch_generic_email(
            recipient=manager_email,
            subject=subject,
            body=body,
            category="SLA_BREACH_ESCALATION",
        )

    async def send_compliance_threshold_alert(
        self,
        manager_email: str,
        current_compliance_rate: float,
        target_threshold: float,
        breached_count: int,
        total_active: int,
    ) -> Dict[str, Any]:
        """Dispatch executive escalation alert when queue compliance drops below target threshold."""
        subject = f"[EXECUTIVE ALERT] SLA Compliance Dropped to {current_compliance_rate}% (Target: ≥{target_threshold}%)"
        body = (
            f"EXECUTIVE QUEUE HEALTH ALERT\n\n"
            f"Active operational queue compliance has fallen below the contractual ITIL threshold:\n"
            f"- Current Compliance: {current_compliance_rate}%\n"
            f"- Contractual Target: ≥ {target_threshold}%\n"
            f"- Active Breached Tickets: {breached_count}\n"
            f"- Total Active Inquiries: {total_active}\n\n"
            f"Recommendation: Surge operator capacity and claim high-priority breached tickets immediately.\n"
            f"Operations Console: http://localhost:5173\n\n"
            f"{self.company_name} Automated Triage & Incident Monitoring"
        )
        return await self._dispatch_generic_email(
            recipient=manager_email,
            subject=subject,
            body=body,
            category="COMPLIANCE_THRESHOLD_ALERT",
        )

    async def _dispatch_generic_email(
        self,
        recipient: str,
        subject: str,
        body: str,
        category: str,
    ) -> Dict[str, Any]:
        """Underlying helper to route outbound emails through SES, SMTP, or mock outbox."""
        delivery_result = {
            "recipient": recipient,
            "sender": self.from_email,
            "subject": subject,
            "category": category,
            "channel": "OUTBOUND_EMAIL",
            "status": "SENT",
            "provider": "MOCK",
        }

        ses_client = self._get_ses_client()
        if ses_client:
            try:
                active_sender = self._resolve_verified_sender()
                loop = asyncio.get_running_loop()
                ses_res = await loop.run_in_executor(
                    None,
                    lambda: ses_client.send_email(
                        FromEmailAddress=active_sender,
                        Destination={"ToAddresses": [recipient]},
                        ReplyToAddresses=[self.support_email],
                        Content={
                            "Simple": {
                                "Subject": {"Data": subject, "Charset": "UTF-8"},
                                "Body": {
                                    "Text": {"Data": body, "Charset": "UTF-8"},
                                    "Html": {"Data": _plain_text_to_html(body), "Charset": "UTF-8"},
                                },
                            }
                        },
                    ),
                )
                delivery_result["provider"] = "AMAZON_SES"
                delivery_result["transport_message_id"] = ses_res.get("MessageId")
                self.outbox.append(delivery_result)
                return delivery_result
            except Exception as exc:
                logger.warning(f"SES delivery failed: {exc}. Attempting SMTP fallback.")

        if self.smtp_host and self.smtp_user and self.smtp_password:
            try:
                def _send_generic_smtp():
                    msg = email.mime.multipart.MIMEMultipart("alternative")
                    msg["Subject"] = subject
                    msg["From"] = self.from_email
                    msg["To"] = recipient
                    msg.attach(email.mime.text.MIMEText(body, "plain", "utf-8"))

                    with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=5) as server:
                        if self.smtp_use_tls:
                            server.starttls()
                        server.login(self.smtp_user, self.smtp_password)
                        server.sendmail(self.from_email, [recipient], msg.as_string())

                loop = asyncio.get_running_loop()
                await loop.run_in_executor(None, _send_generic_smtp)
                delivery_result["provider"] = "SMTP"
                self.outbox.append(delivery_result)
                return delivery_result
            except Exception as exc:
                logger.warning(f"SMTP delivery failed: {exc}. Falling back to dev outbox.")

        logger.info(f"[OUTBOUND NOTIFICATION] To: {recipient} | Subject: {subject}")
        delivery_result["provider"] = "LOCAL_OUTBOX"
        self.outbox.append(delivery_result)
        return delivery_result


_email_service_instance: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """FastAPI dependency provider for EmailService."""
    global _email_service_instance
    if _email_service_instance is None:
        _email_service_instance = EmailService()
    return _email_service_instance
