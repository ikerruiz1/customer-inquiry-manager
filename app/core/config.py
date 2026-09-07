"""Application runtime settings and environment parsing using Pydantic Settings v2."""
from typing import Optional, List
from pydantic import Field
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

    # Database connection (PostgreSQL 16 via asyncpg)
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/customer_inquiries",
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
        default="eu.anthropic.claude-sonnet-4-5-20250929-v1:0",
        description="High-reasoning Bedrock model for complex escalation drafting",
    )
    BEDROCK_GUARDRAIL_ID: Optional[str] = Field(
        default=None,
        description="Amazon Bedrock Guardrails identifier for prompt attack & PII DLP filtering",
    )
    BEDROCK_GUARDRAIL_VERSION: str = Field(
        default="DRAFT",
        description="Amazon Bedrock Guardrail version",
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

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


# Singleton settings instance
settings = Settings()
