"""Amazon Cognito authentication and RFC 6238 Software Token TOTP MFA endpoints."""
import logging
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.schemas.auth import (
    LoginRequest,
    MFAChallengeResponse,
    MFAVerifyRequest,
    TokenResponse,
)
from app.services.cognito_service import CognitoService, get_cognito_service

logger = logging.getLogger("app.api.v1.auth")
router = APIRouter()


@router.post("/login", status_code=status.HTTP_200_OK)
async def login(
    credentials: LoginRequest,
    cognito: CognitoService = Depends(get_cognito_service),
):
    """Initial username/password authentication challenge."""
    try:
        result = await cognito.initiate_auth(credentials.username, credentials.password)
        if result.get("challenge_name") == "SOFTWARE_TOKEN_MFA":
            return MFAChallengeResponse(
                challenge_name="SOFTWARE_TOKEN_MFA",
                session=result["session"],
                message="Multi-Factor Authentication required. Enter 6-digit TOTP code.",
            )
        return TokenResponse(**result)
    except Exception as exc:
        logger.warning(f"Login failed for {credentials.username}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials or authentication challenge failed",
        )


@router.post("/mfa/verify", response_model=TokenResponse)
async def verify_mfa(
    mfa_payload: MFAVerifyRequest,
    cognito: CognitoService = Depends(get_cognito_service),
):
    """Verify 6-digit Software Token TOTP MFA code and issue OAuth2 token pair."""
    try:
        tokens = await cognito.verify_software_token_mfa(
            session=mfa_payload.session,
            totp_code=mfa_payload.totp_code,
        )
        return TokenResponse(**tokens)
    except Exception as exc:
        logger.warning(f"TOTP MFA verification failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired TOTP code",
        )


@router.get("/me")
async def get_current_operator_profile(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Return identity and RBAC authorization claims of the authenticated support agent."""
    return {
        "sub": current_user.get("sub"),
        "email": current_user.get("email"),
        "groups": current_user.get("cognito:groups") or current_user.get("groups", []),
        "token_use": current_user.get("token_use"),
    }
