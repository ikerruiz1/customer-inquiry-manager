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
        priority = inquiry_dict.get("priority")
        if priority not in ["P1", "P2"]:
            return False

        if not self.alerts_topic_arn:
            logger.info(
                f"[Mock SNS ChatOps] Critical Alert: {priority} Incident {inquiry_dict.get('id')} - {inquiry_dict.get('subject')}"
            )
            return True

        alert_payload = {
            "event_type": "incident.escalated",
            "priority": priority,
            "inquiry_id": str(inquiry_dict.get("id")),
            "department": inquiry_dict.get("department"),
            "customer_email": inquiry_dict.get("customer_email"),
            "subject": inquiry_dict.get("subject"),
            "urgency": inquiry_dict.get("urgency"),
            "impact": inquiry_dict.get("impact"),
            "churn_risk": inquiry_dict.get("churn_risk"),
            "sla_deadline_at": str(inquiry_dict.get("sla_deadline_at")),
        }

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


_sns_service_instance: Optional[SNSService] = None


def get_sns_service() -> SNSService:
    """FastAPI dependency provider for SNSService."""
    global _sns_service_instance
    if _sns_service_instance is None:
        _sns_service_instance = SNSService()
    return _sns_service_instance
