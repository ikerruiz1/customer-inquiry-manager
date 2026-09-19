"""Application runtime settings and environment parsing using Pydantic Settings v2."""
from typing import Optional, List, Dict, Any, Literal
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Immutable application settings container loaded from environment variables."""

    # Project metadata
    PROJECT_NAME: str = "Customer Inquiry Manager"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = Field(default="dev", description="Runtime environment: dev, staging, prod")
    DEBUG: bool = False

    # Server configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: List[str] = ["*"]

    # Database connection (SQLite on-disk for local dev, PostgreSQL 16 via asyncpg in cloud/prod)
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///customer_inquiries.db",
        description="Async SQLAlchemy database connection string",
    )
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30

    # AWS Infrastructure & Region
    AWS_REGION: str = Field(default="eu-west-1", description="Target AWS region")
    AWS_DEFAULT_REGION: str = "eu-west-1"

    # Amazon Bedrock Foundation Models (Verified Live 2026 Fleet)
    BEDROCK_MODEL_ID: str = Field(
        default="eu.anthropic.claude-haiku-4-5-20251001-v1:0",
        description="Primary fast Bedrock model ID for triage and classification",
    )
    BEDROCK_GUARDRAIL_ID: Optional[str] = Field(
        default=None,
        description="Amazon Bedrock Guardrails identifier for prompt attack & PII DLP filtering",
    )
    BEDROCK_GUARDRAIL_VERSION: str = Field(
        default="DRAFT",
        description="Amazon Bedrock Guardrail version",
    )
    BEDROCK_OFFLINE_MODE: Optional[bool] = Field(
        default=None,
        description="When true, bypasses live AWS Bedrock API calls and executes local heuristic triage engine. Automatically defaults to True in 'dev' and False in 'prod'/'staging'.",
    )

    # Amazon Cognito Identity & RBAC
    COGNITO_USER_POOL_ID: Optional[str] = None
    COGNITO_APP_CLIENT_ID: Optional[str] = None
    COGNITO_JWKS_URL: Optional[str] = None

    # Amazon S3 Multi-Tier Storage
    S3_ATTACHMENTS_BUCKET: str = "customer-inquiry-attachments-dev"
    S3_PRESIGNED_EXPIRATION_SECONDS: int = 900  # 15 minutes

    # Amazon SNS Event Notification Topics
    SNS_ALERTS_TOPIC_ARN: Optional[str] = None
    SNS_CUSTOMER_RECEIPTS_TOPIC_ARN: Optional[str] = None

    # Amazon SQS FIFO Decoupled Ingestion Buffer & Dead-Letter Queue
    SQS_INQUIRIES_QUEUE_URL: Optional[str] = None
    SQS_INQUIRIES_DLQ_URL: Optional[str] = None
    SQS_CONSUMER_ENABLED: bool = True
    SQS_CONSUMER_BATCH_SIZE: int = 10
    SQS_CONSUMER_POLL_INTERVAL_SECONDS: float = 1.0

    # Inbound Omnichannel Webhook Secrets
    TRUSTPILOT_WEBHOOK_SECRET: Optional[str] = "dev-trustpilot-webhook-secret"
    GOOGLE_REVIEWS_WEBHOOK_SECRET: Optional[str] = "dev-google-reviews-webhook-secret"
    STRIPE_WEBHOOK_SECRET: Optional[str] = "dev-stripe-webhook-secret"

    # Telemetry & Distributed Tracing
    XRAY_ENABLED: bool = False

    # Grounding Document Path
    GROUNDING_CONTEXT_PATH: str = "company_profile.json"

    # Inbound Support Email & Company Metadata (Dynamically loaded from company_profile.json)
    SUPPORT_EMAIL: str = Field(
        default="support@company.internal",
        description="Authoritative customer support inbound email address parsed from company profile",
    )
    COMPANY_NAME: str = Field(
        default="ExampleCorp Technologies",
        description="Authoritative company name parsed from company profile",
    )
    COMPANY_DOMAIN: str = Field(
        default="company.internal",
        description="Authoritative company domain parsed from company profile",
    )

    # Optional Outbound SMTP Settings (Can be set via env vars or company_profile.json)
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_USE_TLS: bool = True

    # Optional Inbound IMAP Poller Settings (Can be set via env vars or company_profile.json)
    IMAP_HOST: Optional[str] = None
    IMAP_PORT: int = 993
    IMAP_USER: Optional[str] = None
    IMAP_PASSWORD: Optional[str] = None
    IMAP_USE_SSL: bool = True
    INBOUND_EMAIL_POLL_ENABLED: bool = False
    INBOUND_EMAIL_POLL_INTERVAL_SECONDS: int = 5

    # Automated Background SLA Breach Watcher & Executive Escalation Settings
    SLA_WATCHER_ENABLED: bool = True
    SLA_WATCHER_INTERVAL_SECONDS: int = 30
    SLA_TARGET_COMPLIANCE_THRESHOLD: float = 95.0
    SLA_PROACTIVE_WARNING_MINUTES: int = 10
    EXECUTIVE_ESCALATION_COOLDOWN_SECONDS: int = 900  # 15-minute anti-fatigue cooldown
    OPERATIONS_MANAGER_EMAIL: str = "ops-manager@example-corp.tech"
    OPERATIONAL_AUTH_TOKEN: str = "cim-operational-secret-token"
    SLACK_WEBHOOK_URL: Optional[str] = None
    SLACK_NOTIFICATION_POLICY: Literal["CRITICAL_AND_SLA_ONLY", "ALL_INQUIRIES"] = "CRITICAL_AND_SLA_ONLY"

    # Inbound Customer Verification & Identity Policy (Parsed from company_profile.json)
    CUSTOMER_ACCESS_POLICY: Dict[str, Any] = Field(
        default_factory=lambda: {
            "require_registered_account": False,
            "verification_mode": "FLAG_UNVERIFIED",
            "unregistered_customer_handling": "ACCEPT_WITH_UNVERIFIED_BADGE",
            "quarantine_unregistered": False,
        },
        description="Declarative customer access policy governing whether inquiries must originate from registered accounts",
    )

    # AWS Secrets Manager DB Credentials (Injected dynamically into ECS container)
    DB_CREDENTIALS: Optional[str] = Field(
        default=None,
        description="JSON string injected by AWS ECS from AWS Secrets Manager containing RDS master credentials",
    )

    @model_validator(mode="after")
    def assemble_db_url_and_profile(self) -> "Settings":
        """Assemble asyncpg DATABASE_URL from AWS Secrets Manager and load support_email and access policy from profile."""
        if self.DB_CREDENTIALS:
            try:
                import json
                creds = json.loads(self.DB_CREDENTIALS)
                user = creds.get("username", "postgres")
                password = creds.get("password", "")
                host = creds.get("host", "localhost")
                port = creds.get("port", 5432)
                db = creds.get("database", "inquirydb")
                self.DATABASE_URL = f"postgresql+asyncpg://{user}:{password}@{host}:{port}/{db}"
            except Exception:
                pass

        import os, json
        if os.path.exists(self.GROUNDING_CONTEXT_PATH):
            try:
                with open(self.GROUNDING_CONTEXT_PATH, "r", encoding="utf-8") as f:
                    profile_data = json.load(f)
                    if "company_name" in profile_data:
                        self.COMPANY_NAME = profile_data["company_name"]
                    if "domain" in profile_data:
                        self.COMPANY_DOMAIN = profile_data["domain"]
                    if "support_email" in profile_data:
                        self.SUPPORT_EMAIL = profile_data["support_email"]
                    if "operations_manager_email" in profile_data:
                        self.OPERATIONS_MANAGER_EMAIL = profile_data["operations_manager_email"]
                    if "sla_proactive_warning_minutes" in profile_data:
                        self.SLA_PROACTIVE_WARNING_MINUTES = int(profile_data["sla_proactive_warning_minutes"])
                    if "slack_webhook_url" in profile_data and not self.SLACK_WEBHOOK_URL:
                        self.SLACK_WEBHOOK_URL = profile_data["slack_webhook_url"] or None
                    if "slack_notification_policy" in profile_data:
                        policy_val = str(profile_data["slack_notification_policy"]).strip()
                        if policy_val in ("CRITICAL_AND_SLA_ONLY", "ALL_INQUIRIES"):
                            self.SLACK_NOTIFICATION_POLICY = policy_val  # type: ignore[assignment]
                    if "customer_access_policy" in profile_data:
                        self.CUSTOMER_ACCESS_POLICY = profile_data["customer_access_policy"]
                    
                    # Optional SMTP config from company profile if not already set by env vars
                    smtp_conf = profile_data.get("outbound_email_delivery", {})
                    if not self.SMTP_HOST and smtp_conf.get("smtp_host"):
                        self.SMTP_HOST = smtp_conf["smtp_host"]
                    if smtp_conf.get("smtp_port"):
                        self.SMTP_PORT = int(smtp_conf["smtp_port"])
                    if not self.SMTP_USER and smtp_conf.get("smtp_user"):
                        self.SMTP_USER = smtp_conf["smtp_user"]
                    if not self.SMTP_PASSWORD and smtp_conf.get("smtp_password"):
                        self.SMTP_PASSWORD = smtp_conf["smtp_password"]
                    if "use_tls" in smtp_conf:
                        self.SMTP_USE_TLS = bool(smtp_conf["use_tls"])

                    # Optional IMAP config from company profile if not already set by env vars
                    imap_conf = profile_data.get("inbound_email_account", {})
                    if not self.IMAP_HOST and imap_conf.get("imap_host"):
                        self.IMAP_HOST = imap_conf["imap_host"]
                    if imap_conf.get("imap_port"):
                        self.IMAP_PORT = int(imap_conf["imap_port"])
                    if not self.IMAP_USER and imap_conf.get("imap_user"):
                        self.IMAP_USER = imap_conf["imap_user"]
                    if not self.IMAP_PASSWORD and imap_conf.get("imap_password"):
                        self.IMAP_PASSWORD = imap_conf["imap_password"]
                    if "use_ssl" in imap_conf:
                        self.IMAP_USE_SSL = bool(imap_conf["use_ssl"])
                    if "poll_enabled" in imap_conf:
                        self.INBOUND_EMAIL_POLL_ENABLED = bool(imap_conf["poll_enabled"])
                    elif self.IMAP_HOST and self.IMAP_USER and self.IMAP_PASSWORD:
                        self.INBOUND_EMAIL_POLL_ENABLED = True
            except Exception:
                pass

        # Environment-aware offline mode: default to True in local 'dev' (zero spend), False in cloud ('prod' / 'staging')
        if self.BEDROCK_OFFLINE_MODE is None:
            self.BEDROCK_OFFLINE_MODE = (self.ENVIRONMENT.lower() == "dev")

        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


# Singleton settings instance
settings = Settings()
