"""Amazon Cognito authentication and RFC 6238 Software Token TOTP MFA endpoints."""
import logging
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_operations_manager
from app.core.config import settings
from app.models.inquiry import Operator
from app.schemas.auth import (
    LoginRequest,
    MFAChallengeResponse,
    MFAVerifyRequest,
    RegisterRequest,
    NewPasswordRequest,
    InviteOperatorRequest,
    InviteOperatorResponse,
    TokenResponse,
    OperatorProfileResponse,
)
from app.services.cognito_service import CognitoService, get_cognito_service

logger = logging.getLogger("app.api.v1.auth")
router = APIRouter()


@router.post("/register", response_model=MFAChallengeResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
    cognito: CognitoService = Depends(get_cognito_service),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Register a new operator and initiate RFC 6238 Software Token TOTP MFA enrollment.
    
    In production environments, user provisioning is restricted strictly to authenticated Operations Managers.
    """
    if settings.ENVIRONMENT != "dev":
        user_groups = current_user.get("cognito:groups", [])
        if "Operations_Managers" not in user_groups:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Administrative privilege required: only Operations Managers may provision new operators in production.",
            )
    try:
        operator = cognito.register_operator(
            name=payload.name,
            email=payload.email,
            password=payload.password,
            role=payload.role,
        )

        # Persist operator to relational database for durability across service restarts
        db_op = Operator(
            id=operator["id"],
            name=operator["name"],
            email=operator["email"],
            password_hash=operator.get("password") or payload.password,
            role=operator["role"],
            groups=operator.get("groups", []),
            totp_secret=operator.get("totp_secret", "JBSWY3DPEHPK3PXP"),
            initials=operator.get("initials", "OP"),
            color=operator.get("color", "#3b82f6"),
        )
        db.add(db_op)
        await db.flush()

        result = await cognito.initiate_auth(payload.email, payload.password)
        session = result.get("session", f"session-{payload.email}")
        totp_secret = result.get("totp_secret") or (operator.get("totp_secret") if operator else None)
        otpauth_url = result.get("otpauth_url") or (
            f"otpauth://totp/SupportPortal:{payload.email}?secret={totp_secret}&issuer=SupportPortal" if totp_secret else None
        )
        return MFAChallengeResponse(
            challenge_name="SOFTWARE_TOKEN_MFA",
            session=session,
            message="Operator registered successfully. Multi-Factor Authentication required.",
            totp_secret=totp_secret,
            otpauth_url=otpauth_url,
            email=payload.email,
        )
    except Exception as exc:
        logger.warning(f"Registration failed for {payload.email}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc) if "already exists" in str(exc) else "Operator registration failed",
        )


@router.post("/invite", response_model=InviteOperatorResponse, status_code=status.HTTP_201_CREATED)
async def invite_operator(
    payload: InviteOperatorRequest,
    db: AsyncSession = Depends(get_db),
    cognito: CognitoService = Depends(get_cognito_service),
    current_user: Dict[str, Any] = Depends(require_operations_manager),
):
    """Supervisor invitation endpoint: Allows Operations Managers to onboard new agents.
    
    Generates an enterprise temporary password and enforces password rotation and TOTP MFA on first login.
    """
    # Enforce strict enterprise corporate domain binding
    corporate_domain = (settings.COMPANY_DOMAIN or "company.internal").lower()
    allowed_domains = {corporate_domain, "company.internal", "company.local"}
    email_domain = payload.email.lower().split("@")[-1]

    if email_domain not in allowed_domains:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Enterprise security violation: Operator identity '{payload.email}' must belong to "
                f"the verified corporate domain '@{corporate_domain}'. Public and unverified email domains are strictly prohibited."
            ),
        )

    from app.core.security import generate_secure_temporary_password
    temp_password = generate_secure_temporary_password(14)

    try:
        operator = cognito.invite_operator(
            name=payload.name,
            email=payload.email,
            role=payload.role,
            temp_password=temp_password,
        )

        # Persist operator to relational database for durability
        db_op = Operator(
            id=operator["id"],
            name=operator["name"],
            email=operator["email"],
            password_hash=temp_password,
            role=operator["role"],
            groups=operator.get("groups", ["Tier1_Agents"]),
            totp_secret=operator.get("totp_secret", "JBSWY3DPEHPK3PXP"),
            initials=operator.get("initials", "OP"),
            color=operator.get("color", "#3b82f6"),
        )
        db.add(db_op)
        await db.flush()

        return InviteOperatorResponse(
            message="Operator provisioned successfully. Share temporary credentials with the operator.",
            temporary_password=temp_password,
            operator={
                "id": operator["id"],
                "name": operator["name"],
                "email": operator["email"],
                "role": operator["role"],
            },
        )
    except Exception as exc:
        logger.warning(f"Invitation failed for {payload.email}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc) if "already exists" in str(exc) else "Failed to invite operator",
        )


@router.post("/login", status_code=status.HTTP_200_OK)
async def login(
    credentials: LoginRequest,
    cognito: CognitoService = Depends(get_cognito_service),
):
    """Initial username/password authentication challenge."""
    try:
        result = await cognito.initiate_auth(credentials.username, credentials.password)
        if result.get("challenge_name") in ("SOFTWARE_TOKEN_MFA", "NEW_PASSWORD_REQUIRED"):
            default_msg = (
                "Initial login detected with temporary password. You must set a permanent password."
                if result.get("challenge_name") == "NEW_PASSWORD_REQUIRED"
                else "Multi-Factor Authentication required. Enter 6-digit TOTP code."
            )
            return MFAChallengeResponse(
                challenge_name=result["challenge_name"],
                session=result["session"],
                message=result.get("message", default_msg),
                totp_secret=result.get("totp_secret"),
                otpauth_url=result.get("otpauth_url"),
                email=result.get("email", credentials.username),
            )
        return TokenResponse(**result)
    except Exception as exc:
        logger.warning(f"Login failed for {credentials.username}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials or authentication challenge failed",
        )


@router.post("/password/new", response_model=MFAChallengeResponse, status_code=status.HTTP_200_OK)
async def set_new_permanent_password(
    payload: NewPasswordRequest,
    cognito: CognitoService = Depends(get_cognito_service),
):
    """Establish permanent password in response to NEW_PASSWORD_REQUIRED challenge and advance to Software Token MFA."""
    try:
        result = await cognito.respond_to_new_password(
            session=payload.session,
            username=payload.username,
            new_password=payload.new_password,
        )
        return MFAChallengeResponse(
            challenge_name=result.get("challenge_name", "SOFTWARE_TOKEN_MFA"),
            session=result["session"],
            message=result.get("message", "Permanent password set. Multi-Factor Authentication required."),
            totp_secret=result.get("totp_secret"),
            otpauth_url=result.get("otpauth_url"),
            email=result.get("email", payload.username),
        )
    except Exception as exc:
        logger.warning(f"Setting new password failed for {payload.username}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc) if "Password" in str(exc) or "expired" in str(exc).lower() else "Password update challenge failed",
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
            username=mfa_payload.username,
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
    cognito: CognitoService = Depends(get_cognito_service),
):
    """Return identity and RBAC authorization claims of the authenticated support agent."""
    user_email = current_user.get("email", "")
    operator = cognito.get_operator(user_email) if user_email else None
    user_groups = current_user.get("cognito:groups") or current_user.get("groups", [])
    role = current_user.get("role") or (
        "Operations_Manager" if "Operations_Managers" in user_groups else "Tier1_Agent"
    )
    return {
        "id": current_user.get("sub"),
        "sub": current_user.get("sub"),
        "email": current_user.get("email"),
        "name": current_user.get("name") or (operator.get("name") if operator else current_user.get("email")),
        "role": role,
        "groups": user_groups,
        "initials": operator.get("initials") if operator else "OP",
        "color": operator.get("color") if operator else "#3b82f6",
        "token_use": current_user.get("token_use"),
    }


@router.get("/operators", response_model=List[OperatorProfileResponse])
async def list_operators(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List all registered operators for queue assignment and live profile resolution."""
    stmt = select(Operator).order_by(Operator.name.asc())
    res = await db.execute(stmt)
    operators = res.scalars().all()
    if not operators:
        from app.services.cognito_service import _OPERATOR_REGISTRY
        # Return default operators if DB table is unseeded
        seen = set()
        default_list = []
        for op_data in _OPERATOR_REGISTRY.values():
            if op_data["email"] not in seen and not op_data["email"].endswith(".local"):
                seen.add(op_data["email"])
                default_list.append(
                    OperatorProfileResponse(
                        id=op_data["id"],
                        name=op_data["name"],
                        email=op_data["email"],
                        role=op_data["role"],
                        initials=op_data["initials"],
                        color=op_data["color"],
                    )
                )
        return default_list

    return [
        OperatorProfileResponse(
            id=op.id,
            name=op.name,
            email=op.email,
            role=op.role,
            initials=op.initials,
            color=op.color,
        )
        for op in operators
    ]


