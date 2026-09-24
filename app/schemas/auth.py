"""Authentication and Software Token TOTP MFA schemas."""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, EmailStr


class RegisterRequest(BaseModel):
    """New support operator registration."""

    name: str = Field(..., min_length=2, max_length=100, description="Full operator name")
    email: EmailStr = Field(..., description="Corporate operator email")
    password: str = Field(..., min_length=6, description="Account password")
    role: str = Field(default="Tier1_Agent", description="RBAC role: Tier1_Agent or Operations_Manager")


class LoginRequest(BaseModel):
    """Initial username/password credentials submission."""

    username: str = Field(..., description="Cognito user email/username")
    password: str = Field(..., description="User password")


class MFAChallengeResponse(BaseModel):
    """Challenge issued when Cognito requires RFC 6238 Software Token TOTP MFA or mandatory password change."""

    challenge_name: str = "SOFTWARE_TOKEN_MFA"
    session: str = Field(..., description="Ephemeral session token passed to verify challenge")
    message: str = "Multi-Factor Authentication required. Provide 6-digit TOTP token."
    totp_secret: Optional[str] = Field(None, description="Base32 TOTP secret for manual authenticator app setup")
    otpauth_url: Optional[str] = Field(None, description="Standard otpauth:// URI for Google/Microsoft Authenticator QR scanning")
    email: Optional[str] = Field(None, description="Account email being verified")


class NewPasswordRequest(BaseModel):
    """Submission of new permanent password in response to NEW_PASSWORD_REQUIRED challenge."""

    session: str = Field(..., description="Ephemeral session token from login challenge")
    username: str = Field(..., description="Corporate operator email")
    new_password: str = Field(..., min_length=8, description="New permanent password meeting complexity policy")


class InviteOperatorRequest(BaseModel):
    """Supervisor invitation payload to onboard a new support agent."""

    name: str = Field(..., min_length=2, max_length=100, description="Full operator name")
    email: EmailStr = Field(..., description="Corporate operator email")
    role: str = Field(default="Tier1_Agent", description="Assigned RBAC role: Tier1_Agent or Operations_Manager")


class InviteOperatorResponse(BaseModel):
    """Supervisor invitation response containing generated temporary password and account metadata."""

    message: str
    temporary_password: str
    operator: Dict[str, Any]


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
    user: Optional[Dict[str, Any]] = None


class OperatorProfileResponse(BaseModel):
    """Operator identity and visual profile for ticket assignments."""

    id: str
    name: str
    email: str
    role: str
    initials: str
    color: str


