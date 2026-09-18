"""Business logic and AWS service integrations package."""
from app.services.bedrock_service import BedrockService, get_bedrock_service
from app.services.s3_service import S3Service, get_s3_service
from app.services.sns_service import SNSService, get_sns_service
from app.services.cognito_service import CognitoService, get_cognito_service

from app.services.email_service import EmailService, get_email_service
from app.services.inbound_email_poller import InboundEmailPoller, get_inbound_email_poller
from app.services.sla_breach_watcher import SLABreachWatcherDaemon, get_sla_breach_watcher

__all__ = [
    "BedrockService",
    "get_bedrock_service",
    "S3Service",
    "get_s3_service",
    "SNSService",
    "get_sns_service",
    "CognitoService",
    "get_cognito_service",
    "EmailService",
    "get_email_service",
    "InboundEmailPoller",
    "get_inbound_email_poller",
    "SLABreachWatcherDaemon",
    "get_sla_breach_watcher",
]
