"""Agnostic Outbound Email Service supporting Amazon SES, standard SMTP, and mock dev delivery."""
import email.mime.multipart
import email.mime.text
import logging
import smtplib
from typing import Dict, Any, List, Optional
import boto3
from botocore.exceptions import ClientError, NoCredentialsError

from app.core.config import settings

logger = logging.getLogger("app.services.email_service")


class EmailService:
    """Outbound email dispatcher grounded in company profile configuration."""

    def __init__(self):
        self.company_name = settings.COMPANY_NAME
        self.company_domain = settings.COMPANY_DOMAIN
        self.support_email = settings.SUPPORT_EMAIL
        self.from_email = settings.SMTP_FROM_EMAIL or settings.SUPPORT_EMAIL

        # SMTP settings
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.smtp_use_tls = settings.SMTP_USE_TLS

        # In-memory outbox for testing, audit inspection, and offline dev mode
        self.outbox: List[Dict[str, Any]] = []

        # Lazy SES client
        self._ses_client = None

    def _get_ses_client(self):
        if self._ses_client is None:
            try:
                self._ses_client = boto3.client("ses", region_name=settings.AWS_REGION)
            except Exception as exc:
                logger.debug(f"Unable to instantiate SES client: {exc}")
                self._ses_client = None
        return self._ses_client

    async def send_customer_notification(
        self,
        customer_email: str,
        customer_name: str,
        ticket_id: str,
        ticket_subject: str,
        message_body: str,
        action_type: str = "REPLY",
        agent_name: str = "Support Specialist",
    ) -> Dict[str, Any]:
        """Dispatch real outbound notification to customer's personal email inbox."""
        short_id = str(ticket_id)[:8].upper()
        subject = f"[Ticket #{short_id}] {ticket_subject}"
        is_paused = action_type == "REQUEST_INFO"

        # Build clean plain text body
        text_lines = [
            f"Hello {customer_name},",
            "",
            f"You have received an update from {agent_name} at {self.company_name}:",
            "--------------------------------------------------",
            message_body,
            "--------------------------------------------------",
            "",
            f"How to reply:",
            f"- Reply directly to this email ({self.support_email}), or",
            f"- Open your ticket online at: http://localhost:5173",
            "",
            f"Warm regards,",
            f"{self.company_name} Support Team",
            f"{self.company_domain}",
        ]
        plain_text = "\n".join(text_lines)

        delivery_result = {
            "ticket_id": str(ticket_id),
            "recipient": customer_email,
            "sender": self.from_email,
            "subject": subject,
            "action_type": action_type,
            "channel": "OUTBOUND_EMAIL",
            "status": "SENT",
            "provider": "MOCK",
        }

        # 1. Try Amazon SES (if in cloud or AWS credentials present)
        ses_client = self._get_ses_client()
        if ses_client and settings.ENVIRONMENT.lower() != "dev":
            try:
                ses_res = ses_client.send_email(
                    Source=self.from_email,
                    Destination={"ToAddresses": [customer_email]},
                    Message={
                        "Subject": {"Data": subject, "Charset": "UTF-8"},
                        "Body": {"Text": {"Data": plain_text, "Charset": "UTF-8"}},
                    },
                )
                logger.info(f"Email dispatched via Amazon SES: MessageId={ses_res.get('MessageId')}")
                delivery_result["provider"] = "AMAZON_SES"
                delivery_result["message_id"] = ses_res.get("MessageId")
                self.outbox.append(delivery_result)
                return delivery_result
            except (ClientError, NoCredentialsError) as exc:
                logger.warning(f"SES delivery bypassed/failed: {exc}. Attempting SMTP fallback.")

        # 2. Try Standard SMTP (if SMTP_HOST is declared)
        if self.smtp_host and self.smtp_user and self.smtp_password:
            try:
                msg = email.mime.multipart.MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = self.from_email
                msg["To"] = customer_email
                msg["Reply-To"] = self.support_email
                msg.attach(email.mime.text.MIMEText(plain_text, "plain", "utf-8"))

                with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10) as server:
                    if self.smtp_use_tls:
                        server.starttls()
                    server.login(self.smtp_user, self.smtp_password)
                    server.sendmail(self.from_email, [customer_email], msg.as_string())

                logger.info(f"Email successfully delivered via SMTP ({self.smtp_host}) to {customer_email}")
                delivery_result["provider"] = "SMTP"
                self.outbox.append(delivery_result)
                return delivery_result
            except Exception as exc:
                logger.warning(f"SMTP delivery failed: {exc}. Falling back to dev logger outbox.")

        # 3. Dev / Test / Offline Fallback (Logs formatted message, records in memory outbox)
        logger.info(
            f"[OUTBOUND EMAIL DISPATCHED] To: {customer_email} | From: {self.from_email} | Action: {action_type} | Subject: {subject}"
        )
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
