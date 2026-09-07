"""Authentication and Software Token TOTP MFA schemas."""
from typing import Optional, List
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    """Initial username/password credentials submission."""

    username: str = Field(..., description="Cognito user email/username")
    password: str = Field(..., description="User password")


class MFAChallengeResponse(BaseModel):
    """Challenge issued when Cognito requires RFC 6238 Software Token TOTP MFA."""

    challenge_name: str = "SOFTWARE_TOKEN_MFA"
    session: str = Field(..., description="Ephemeral session token passed to verify challenge")
    message: str = "Multi-Factor Authentication required. Provide 6-digit TOTP token."


class MFAVerifyRequest(BaseModel):
    """TOTP verification code submission."""

    session: str = Field(..., description="Session string from login challenge")
    totp_code: str = Field(..., min_length=6, max_length=6, description="6-digit TOTP code")


class TokenResponse(BaseModel):
    """OAuth2 / OIDC token pair returned upon successful TOTP completion."""

    access_token: str
    id_token: str
    refresh_token: Optional[str] = None
    token_type: str = "Bearer"
    expires_in: int = 3600
    groups: List[str] = []
