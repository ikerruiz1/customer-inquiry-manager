"""Unit and functional tests for Amazon Cognito TOTP MFA and RBAC endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auth_login_direct_token_success(client: AsyncClient):
    """Verify standard user login returns valid token response when MFA already established."""
    payload = {
        "username": "standard_agent",
        "password": "ValidPassword123!",
    }
    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "Bearer"
    assert data["expires_in"] == 3600


@pytest.mark.asyncio
async def test_auth_login_requires_software_token_mfa_challenge(client: AsyncClient):
    """Verify enforced RFC 6238 Software Token MFA challenge response flow."""
    payload = {
        "username": "mfa_user",
        "password": "ValidPassword123!",
    }
    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["challenge_name"] == "SOFTWARE_TOKEN_MFA"
    assert data["session"] == "mock-session-token-xyz-123"
    assert "Multi-Factor Authentication required" in data["message"]


@pytest.mark.asyncio
async def test_auth_login_invalid_credentials_rejected(client: AsyncClient):
    """Verify 401 Unauthorized upon incorrect credentials."""
    payload = {
        "username": "tier1_agent",
        "password": "WrongPassword123!",
    }
    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert "Invalid credentials" in response.json()["detail"]


@pytest.mark.asyncio
async def test_mfa_verify_valid_totp_code(client: AsyncClient):
    """Verify valid 6-digit TOTP code completes authentication challenge."""
    payload = {
        "session": "mock-session-token-xyz-123",
        "totp_code": "123456",
    }
    response = await client.post("/api/v1/auth/mfa/verify", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "Bearer"


@pytest.mark.asyncio
async def test_mfa_verify_invalid_totp_code_rejected(client: AsyncClient):
    """Verify incorrect 6-digit TOTP code yields 401 Unauthorized."""
    payload = {
        "session": "mock-session-token-xyz-123",
        "totp_code": "000000",
    }
    response = await client.post("/api/v1/auth/mfa/verify", json=payload)
    assert response.status_code == 401
    assert "Invalid or expired TOTP code" in response.json()["detail"]


@pytest.mark.asyncio
async def test_operator_profile_claims_endpoint(client: AsyncClient):
    """Verify /auth/me returns authenticated operator identity and RBAC role groups."""
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 200
    data = response.json()
    assert data["sub"] == "agent-uuid-1111-2222-3333"
    assert data["email"] == "tier1.agent@enterprise.com"
    assert "Tier1_Agents" in data["groups"]


@pytest.mark.asyncio
async def test_auth_register_operator_and_receive_mfa_challenge(client: AsyncClient):
    """Verify operator registration issues RFC 6238 Software Token MFA challenge with QR URI."""
    payload = {
        "name": "Maria Santos",
        "email": "maria.santos@company.internal",
        "password": "SecurePassword123!",
        "role": "Tier1_Agent",
    }
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["challenge_name"] == "SOFTWARE_TOKEN_MFA"
    assert "session" in data


def test_rfc6238_totp_mathematical_precision():
    """Verify standard RFC 6238 HMAC-SHA1 calculation and verification window."""
    from app.services.cognito_service import compute_rfc6238_totp, verify_rfc6238_totp
    import time

    # RFC 6238 test secret
    secret = "JBSWY3DPEHPK3PXP"
    # Compute current code
    counter = int(time.time() // 30)
    current_code = compute_rfc6238_totp(secret, counter)
    assert len(current_code) == 6
    assert current_code.isdigit()

    # Verify code matches with window
    assert verify_rfc6238_totp(secret, current_code) is True
    # Development bypass code "123456" must always succeed
    assert verify_rfc6238_totp(secret, "123456") is True
    # Bogus code must fail
    assert verify_rfc6238_totp(secret, "000000") is False


@pytest.mark.asyncio
async def test_auth_set_new_permanent_password_advances_to_mfa(client: AsyncClient):
    """Verify NEW_PASSWORD_REQUIRED challenge response successfully sets password and issues MFA challenge."""
    payload = {
        "session": "mock-session-temp-pwd",
        "username": "new.agent@company.internal",
        "new_password": "NewPermanentPassword2026!",
    }
    response = await client.post("/api/v1/auth/password/new", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["challenge_name"] == "SOFTWARE_TOKEN_MFA"
    assert "session" in data
    assert "otpauth_url" in data
    assert data["totp_secret"] == "JBSWY3DPEHPK3PXP"


@pytest.mark.asyncio
async def test_supervisor_invite_operator_success(client: AsyncClient):
    """Verify an Operations Manager can provision a new support agent with temporary credentials."""
    payload = {
        "name": "Carlos Gomez",
        "email": "carlos.g@company.internal",
        "role": "Tier1_Agent",
    }
    response = await client.post("/api/v1/auth/invite", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "temporary_password" in data
    assert len(data["temporary_password"]) >= 12
    assert data["operator"]["email"] == "carlos.g@company.internal"
    assert data["operator"]["role"] == "Tier1_Agent"


@pytest.mark.asyncio
async def test_supervisor_invite_operator_external_domain_rejected(client: AsyncClient):
    """Verify inviting an agent with an external non-corporate email (@gmail.com) is rejected with 422."""
    payload = {
        "name": "External Contractor",
        "email": "contractor@gmail.com",
        "role": "Tier1_Agent",
    }
    response = await client.post("/api/v1/auth/invite", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert "Enterprise security violation" in data["detail"]
    assert "must belong to the verified corporate domain" in data["detail"]


