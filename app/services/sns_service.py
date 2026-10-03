"""Amazon SNS service for asynchronous event publishing and ChatOps alerts."""
import json
import logging
from typing import Dict, Any, Optional
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from app.core.config import settings

logger = logging.getLogger("app.services.sns_service")


class SNSService:
    """Service publishing domain events and ChatOps notifications via Amazon SNS."""

    def __init__(self):
        self.region = settings.AWS_REGION
        self.alerts_topic_arn = settings.SNS_ALERTS_TOPIC_ARN
        self.receipts_topic_arn = settings.SNS_CUSTOMER_RECEIPTS_TOPIC_ARN
        config = Config(region_name=self.region)
        self.client = boto3.client("sns", config=config)

    async def publish_ticket_created(self, inquiry_dict: Dict[str, Any]) -> bool:
        """Publish ticket.created event to trigger customer email receipts with SLA deadline."""
        if not self.receipts_topic_arn:
            logger.info(f"[Mock SNS] Customer receipt event generated for inquiry {inquiry_dict.get('id')}")
            return True

        message = {
            "event_type": "ticket.created",
            "inquiry_id": str(inquiry_dict.get("id")),
            "customer_email": inquiry_dict.get("customer_email"),
            "subject": inquiry_dict.get("subject"),
            "priority": inquiry_dict.get("priority"),
            "sla_deadline_at": str(inquiry_dict.get("sla_deadline_at")),
        }

        try:
            self.client.publish(
                TopicArn=self.receipts_topic_arn,
                Subject=f"Ticket Registered: {inquiry_dict.get('id')}",
                Message=json.dumps(message),
                MessageAttributes={
                    "Priority": {"DataType": "String", "StringValue": str(inquiry_dict.get("priority"))},
                    "Department": {"DataType": "String", "StringValue": str(inquiry_dict.get("department"))},
                },
            )
            return True
        except ClientError as exc:
            logger.warning(f"Failed to publish to SNS receipts topic: {exc}")
            return False

    async def publish_ops_alert(self, inquiry_dict: Dict[str, Any]) -> bool:
        """Publish high-priority alert to SNS ChatOps topic for P1/P2 incidents."""
        event_type = inquiry_dict.get("event_type", "incident.escalated")
        priority = inquiry_dict.get("priority", "P3")

        # If SLACK_NOTIFICATION_POLICY is "ALL_INQUIRIES", allow all priorities (P1, P2, P3, P4).
        # Otherwise (enterprise default "CRITICAL_AND_SLA_ONLY"), restrict initial ingestion to P1/P2.
        # SLA warning and breach lifecycle events are alerted across all priorities when deadlines approach or breach.
        if event_type == "incident.escalated":
            if settings.SLACK_NOTIFICATION_POLICY != "ALL_INQUIRIES" and priority not in ["P1", "P2"]:
                return False
        alert_payload = {
            "event_type": event_type,
            "priority": priority,
            "inquiry_id": str(inquiry_dict.get("id")),
            "department": inquiry_dict.get("department"),
            "customer_email": inquiry_dict.get("customer_email"),
            "subject": inquiry_dict.get("subject"),
            "urgency": inquiry_dict.get("urgency"),
            "impact": inquiry_dict.get("impact"),
            "churn_risk": inquiry_dict.get("churn_risk"),
            "sla_deadline_at": str(inquiry_dict.get("sla_deadline_at")),
            "remaining_minutes": inquiry_dict.get("remaining_minutes"),
        }

        if settings.SLACK_WEBHOOK_URL:
            await self._dispatch_slack_webhook(alert_payload)

        if not self.alerts_topic_arn:
            logger.info(
                f"[Mock SNS ChatOps] Critical Alert: {priority} Incident {inquiry_dict.get('id')} - {inquiry_dict.get('subject')}"
            )
            return True

        try:
            self.client.publish(
                TopicArn=self.alerts_topic_arn,
                Subject=f"CRITICAL CHATOPS: {priority} Ticket {inquiry_dict.get('id')}",
                Message=json.dumps(alert_payload),
                MessageAttributes={
                    "Priority": {"DataType": "String", "StringValue": priority},
                },
            )
            return True
        except ClientError as exc:
            logger.warning(f"Failed to publish critical alert to SNS: {exc}")
            return False

    async def _dispatch_slack_webhook(self, alert: Dict[str, Any]) -> None:
        """Deliver formatted Slack Block Kit alert card directly to configured incoming webhook."""
        if not settings.SLACK_WEBHOOK_URL:
            return

        try:
            import httpx
            p = alert.get("priority", "P2")
            event_type = alert.get("event_type", "incident.escalated")
            is_p1 = p == "P1"
            inquiry_id = alert.get("inquiry_id", "")
            short_id = inquiry_id[:8] if inquiry_id else "N/A"

            if "warning" in event_type:
                title = f"⚠️ Proactive SLA Warning: Ticket #{short_id}"
                badge = f"⚠️ *[SLA IMPENDING DEADLINE - {alert.get('remaining_minutes', 10)}M REMAINING]*"
            elif "breach" in event_type:
                title = f"🚨 SLA Breach Escalation: Ticket #{short_id}"
                badge = "🚨 *[CONTRACTUAL SLA BREACH ESCALATED]*"
            else:
                title = f"{'🚨' if is_p1 else '⚠️'} Incident Escalated: {p} Ticket #{short_id}"
                badge = f"{'🚨 *[P1 CRITICAL OUTAGE]*' if is_p1 else '⚠️ *[P2 HIGH INCIDENT]*'}"

            blocks = [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": title,
                        "emoji": True,
                    },
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Ticket ID:*\n`#{short_id}`"},
                        {"type": "mrkdwn", "text": f"*Priority:*\n`{p}`"},
                        {"type": "mrkdwn", "text": f"*Department:*\n{alert.get('department', 'GENERAL')}"},
                        {"type": "mrkdwn", "text": f"*SLA Deadline:*\n{alert.get('sla_deadline_at', 'N/A')}"},
                        {"type": "mrkdwn", "text": f"*Customer:*\n{alert.get('customer_email', 'N/A')}"},
                        {"type": "mrkdwn", "text": f"*Churn Risk:*\n{'🔥 High Threat' if alert.get('churn_risk') else 'Normal'}"},
                    ],
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Subject:* {alert.get('subject', '(No Subject)')}",
                    },
                },
            ]

            payload = {
                "text": f"{badge} #{short_id}: {alert.get('subject', '')}",
                "blocks": blocks,
            }

            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(settings.SLACK_WEBHOOK_URL, json=payload)
                if resp.status_code == 200:
                    logger.info(f"ChatOps Slack alert delivered successfully for Ticket #{short_id}")
                else:
                    logger.warning(f"Slack webhook response error {resp.status_code}: {resp.text}")
        except Exception as exc:
            logger.warning(f"Failed to dispatch Slack webhook notification: {exc}")


_sns_service_instance: Optional[SNSService] = None


def get_sns_service() -> SNSService:
    """FastAPI dependency provider for SNSService."""
    global _sns_service_instance
    if _sns_service_instance is None:
        _sns_service_instance = SNSService()
    return _sns_service_instance
