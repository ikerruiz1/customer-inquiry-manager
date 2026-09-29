"""Pytest configuration and shared fixtures for async testing."""
import asyncio
from typing import AsyncGenerator, Dict, Any
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.database import Base, get_db
from app.core.security import get_current_user, require_tier1_agent, require_operations_manager
from app.main import app
from app.models.inquiry import Inquiry, AuditLog
from app.schemas.bedrock import BedrockTriageOutput, SuggestedStrategyEnum
from app.schemas.inquiry import DepartmentEnum
from app.services.bedrock_service import BedrockService, get_bedrock_service
from app.services.sns_service import SNSService, get_sns_service
from app.services.cognito_service import CognitoService, get_cognito_service
from app.services.s3_service import S3Service, get_s3_service
from app.core.config import settings

# Prevent background poller and SLA watcher daemons from auto-starting during generic tests
settings.SLA_WATCHER_ENABLED = False
settings.INBOUND_EMAIL_POLL_ENABLED = False

# Static mock credentials for deterministic test execution
TEST_AGENT_USER = {
    "sub": "agent-uuid-1111-2222-3333",
    "email": "tier1.agent@enterprise.com",
    "cognito:groups": ["Tier1_Agents"],
    "groups": ["Tier1_Agents"],
    "username": "tier1_agent",
}

TEST_OPS_MANAGER_USER = {
    "sub": "ops-manager-uuid-4444-5555-6666",
    "email": "ops.manager@enterprise.com",
    "cognito:groups": ["Operations_Managers", "Tier1_Agents"],
    "groups": ["Operations_Managers", "Tier1_Agents"],
    "username": "ops_manager",
}

TEST_TRIAGE_OUTPUT = BedrockTriageOutput(
    department=DepartmentEnum.TECH_SUPPORT,
    urgency_rating=4,
    impact_rating=3,
    confidence_score=0.96,
    sentiment_score=-0.75,
    churn_risk=True,
    key_entities={
        "account_id": "ACC-98213",
        "service_name": "CloudDB",
        "error_code": "ERR_503_SERVICE_UNAVAILABLE",
    },
    suggested_strategy=SuggestedStrategyEnum.EMPATHETIC_DEFUSING,
    suggested_response=(
        "Dear Customer, we sincerely apologize for the disruption to your CloudDB service. "
        "Our engineering team has identified the incident and active failover is underway."
    ),
    agent_copilot_notes="Customer reported production downtime. High churn probability. Handled under P1 SLA.",
    reasoning_summary="Downtime in production environment combined with financial loss risk warrants maximum urgency.",
)


class MockBedrockService(BedrockService):
    """Mock Bedrock service returning deterministic triage outputs without AWS API calls."""

    def __init__(self):
        pass

    async def triage_inquiry(self, channel: str, subject: str, body: str) -> BedrockTriageOutput:
        return TEST_TRIAGE_OUTPUT

    async def generate_action_draft(
        self,
        customer_name: str,
        subject: str,
        body: str,
        department: str,
        action_type: str = "REPLY",
        entities=None,
        conversation_history=None,
    ) -> str:
        """Return deterministic mock draft for test isolation without Bedrock API calls."""
        if action_type == "REQUEST_INFO":
            return (
                f"Hello {customer_name},\n\n"
                f"Could you please share the following details regarding \"{subject}\"?\n\n"
                "Best regards,\nSupport Team"
            )
        elif action_type == "INTERNAL_NOTE":
            return (
                f"CONFIDENTIAL COPILOT DIAGNOSIS:\n"
                f"Inquiry \"{subject}\" assigned to {department}. Customer: {customer_name}. "
                "Do NOT disclose internal details to customer."
            )
        
        # If there is an existing AGENT message in conversation history, generate a follow-up draft
        has_agent_reply = any(m.get("sender_type") == "AGENT" for m in (conversation_history or []))
        if has_agent_reply:
            return (
                f"Hello {customer_name},\n\n"
                f"Thank you for your response. To follow up on \"{subject}\", we have reviewed your inquiry.\n\n"
                "Best regards,\nSupport Team"
            )

        return (
            f"Hello {customer_name},\n\n"
            f"Thank you for contacting us regarding \"{subject}\". We have reviewed your inquiry and are working on a resolution.\n\n"
            "Best regards,\nSupport Team"
        )


class MockSNSService(SNSService):
    """Mock SNS service recording published events in memory."""

    def __init__(self):
        self.published_ticket_events = []
        self.published_ops_alerts = []

    async def publish_ticket_created(self, inquiry_dict: Dict[str, Any]) -> bool:
        self.published_ticket_events.append(inquiry_dict)
        return True

    async def publish_ops_alert(self, inquiry_dict: Dict[str, Any]) -> bool:
        self.published_ops_alerts.append(inquiry_dict)
        return True


class MockCognitoService(CognitoService):
    """Mock Cognito service validating deterministic authentication flows."""

    def __init__(self):
        pass

    async def initiate_auth(self, username: str, password: str) -> dict:
        if password == "WrongPassword123!":
            from botocore.exceptions import ClientError
            raise ClientError({"Error": {"Code": "NotAuthorizedException", "Message": "Incorrect username or password."}}, "InitiateAuth")
        if username == "mfa_user":
            return {
                "challenge_name": "SOFTWARE_TOKEN_MFA",
                "session": "mock-session-token-xyz-123",
                "challenge_parameters": {"USER_ID_FOR_SRP": "mfa_user"},
            }
        return {
            "access_token": "mock-access-token",
            "id_token": "mock-id-token",
            "refresh_token": "mock-refresh-token",
            "expires_in": 3600,
            "token_type": "Bearer",
        }

    async def verify_software_token_mfa(self, session: str, totp_code: str, username: str = None, **kwargs) -> dict:
        if totp_code != "123456":
            from botocore.exceptions import ClientError
            raise ClientError({"Error": {"Code": "CodeMismatchException", "Message": "Invalid verification code provided."}}, "RespondToAuthChallenge")
        return {
            "access_token": "mock-mfa-verified-access-token",
            "id_token": "mock-mfa-verified-id-token",
            "refresh_token": "mock-refresh-token",
            "expires_in": 3600,
            "token_type": "Bearer",
        }

    def register_operator(self, name: str, email: str, password: str, role: str) -> dict:
        return {
            "id": "mock-operator-uuid",
            "name": name,
            "email": email,
            "role": role,
            "groups": ["Operations_Managers", "Tier1_Agents"] if role == "Operations_Manager" else ["Tier1_Agents"],
            "totp_secret": "JBSWY3DPEHPK3PXP",
            "initials": "MO",
            "color": "#3b82f6",
        }

    async def respond_to_new_password(self, session: str, username: str, new_password: str) -> dict:
        return {
            "challenge_name": "SOFTWARE_TOKEN_MFA",
            "session": "mock-mfa-session-after-pwd",
            "message": "Permanent password established. Multi-Factor Authentication required.",
            "totp_secret": "JBSWY3DPEHPK3PXP",
            "otpauth_url": f"otpauth://totp/SupportPortal:{username}?secret=JBSWY3DPEHPK3PXP&issuer=SupportPortal",
            "email": username,
        }

    def invite_operator(self, name: str, email: str, role: str, temp_password: str) -> dict:
        return {
            "id": "mock-invited-operator-uuid",
            "name": name,
            "email": email,
            "role": role,
            "groups": ["Operations_Managers", "Tier1_Agents"] if role == "Operations_Manager" else ["Tier1_Agents"],
            "totp_secret": "JBSWY3DPEHPK3PXP",
            "initials": "IO",
            "color": "#10b981",
        }

    def get_operator(self, email: str):
        return {
            "id": "mock-operator-uuid",
            "name": "Mock Operator",
            "email": email,
            "role": "Tier1_Agent",
            "groups": ["Tier1_Agents"],
            "totp_secret": "JBSWY3DPEHPK3PXP",
            "initials": "MO",
            "color": "#3b82f6",
        }


class MockS3Service(S3Service):
    """Mock S3 service generating synthetic presigned URLs."""

    def __init__(self):
        self.bucket_name = "mock-attachments-bucket"

    def generate_presigned_upload_url(self, object_key: str, content_type: str = "application/octet-stream", expires_in: int = 900) -> dict:
        return {
            "upload_url": f"https://{self.bucket_name}.s3.amazonaws.com/{object_key}",
            "object_key": object_key,
            "bucket": self.bucket_name,
            "expires_in_seconds": expires_in,
        }

    def generate_presigned_download_url(self, object_key: str, expires_in: int = 900) -> str:
        return f"https://{self.bucket_name}.s3.amazonaws.com/{object_key}?signature=mock"


# Test database setup with in-memory SQLite
test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    echo=False,
)
TestSessionFactory = async_sessionmaker(bind=test_engine, expire_on_commit=False, class_=AsyncSession)


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide isolated database session with freshly initialized schema per test."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionFactory() as session:
        yield session
        await session.rollback()


@pytest.fixture(autouse=True)
def disable_live_aws_transports(monkeypatch):
    """Force EmailService onto its offline outbox so the suite never performs live AWS API calls."""
    from app.services.email_service import EmailService

    monkeypatch.setattr(EmailService, "_get_ses_client", lambda self: None)
    monkeypatch.setattr(EmailService, "_resolve_verified_sender", lambda self: self.from_email)


@pytest.fixture
def mock_bedrock() -> MockBedrockService:
    return MockBedrockService()


@pytest.fixture
def mock_sns() -> MockSNSService:
    return MockSNSService()


@pytest.fixture
def mock_cognito() -> MockCognitoService:
    return MockCognitoService()


@pytest.fixture
def mock_s3() -> MockS3Service:
    return MockS3Service()


@pytest_asyncio.fixture(scope="function")
async def client(
    db_session: AsyncSession,
    mock_bedrock: MockBedrockService,
    mock_sns: MockSNSService,
    mock_cognito: MockCognitoService,
    mock_s3: MockS3Service,
) -> AsyncGenerator[AsyncClient, None]:
    """Construct configured async test client with mock service dependency overrides."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_bedrock_service] = lambda: mock_bedrock
    app.dependency_overrides[get_sns_service] = lambda: mock_sns
    app.dependency_overrides[get_cognito_service] = lambda: mock_cognito
    app.dependency_overrides[get_s3_service] = lambda: mock_s3
    app.dependency_overrides[get_current_user] = lambda: TEST_AGENT_USER
    app.dependency_overrides[require_tier1_agent] = lambda: TEST_AGENT_USER
    app.dependency_overrides[require_operations_manager] = lambda: TEST_OPS_MANAGER_USER

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as async_client:
        yield async_client

    app.dependency_overrides.clear()
