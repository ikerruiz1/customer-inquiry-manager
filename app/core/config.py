"""Application runtime settings and environment parsing using Pydantic Settings v2."""
from typing import Optional, List, Dict, Any
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
    BEDROCK_HIGH_REASONING_MODEL_ID: str = Field(
        default="eu.anthropic.claude-haiku-4-5-20251001-v1:0",
        description="Bedrock model ID for triage and escalation drafting (Claude Haiku 4.5)",
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

    # Inbound Omnichannel Webhook Secrets
    TRUSTPILOT_WEBHOOK_SECRET: Optional[str] = "dev-trustpilot-webhook-secret"
    GOOGLE_REVIEWS_WEBHOOK_SECRET: Optional[str] = "dev-google-reviews-webhook-secret"
    STRIPE_WEBHOOK_SECRET: Optional[str] = "dev-stripe-webhook-secret"

    # Telemetry & Distributed Tracing
    XRAY_ENABLED: bool = False

    # Grounding Document Path
    GROUNDING_CONTEXT_PATH: str = "company_profile.json"

    # Inbound Support Email (Dynamically loaded from company_profile.json)
    SUPPORT_EMAIL: str = Field(
        default="support@company.internal",
        description="Authoritative customer support inbound email address parsed from company profile",
    )

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
                    if "support_email" in profile_data:
                        self.SUPPORT_EMAIL = profile_data["support_email"]
                    if "customer_access_policy" in profile_data:
                        self.CUSTOMER_ACCESS_POLICY = profile_data["customer_access_policy"]
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
