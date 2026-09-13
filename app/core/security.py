"""Zero-Trust Cognito JWT verification and Role-Based Access Control (RBAC) dependencies."""
import logging
from typing import Dict, Any, List, Optional
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import settings

logger = logging.getLogger("app.core.security")

# HTTP Bearer token scheme for OpenAPI docs
security_scheme = HTTPBearer(auto_error=False)

# In-memory JWKS cache to minimize network calls to Cognito
_jwks_cache: Dict[str, Any] = {}


async def get_cognito_jwks() -> Dict[str, Any]:
    """Retrieve and cache the JSON Web Key Set (JWKS) from Amazon Cognito over PrivateLink or HTTPS."""
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache

    if not settings.COGNITO_JWKS_URL and settings.COGNITO_USER_POOL_ID:
        jwks_url = f"https://cognito-idp.{settings.AWS_REGION}.amazonaws.com/{settings.COGNITO_USER_POOL_ID}/.well-known/jwks.json"
    else:
        jwks_url = settings.COGNITO_JWKS_URL

    if not jwks_url:
        return {}

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(jwks_url)
            response.raise_for_status()
            _jwks_cache = response.json()
            return _jwks_cache
    except Exception as exc:
        logger.warning(f"Failed to fetch Cognito JWKS from {jwks_url}: {exc}")
        return {}


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
) -> Dict[str, Any]:
    """Validate Cognito JWT access token and return parsed claims."""
    # Development bypass when running locally without active Cognito credentials
    if settings.ENVIRONMENT == "dev" and (not credentials or credentials.credentials == "dev-token"):
        return {
            "sub": "00000000-0000-0000-0000-000000000001",
            "email": "lead.agent@company.internal",
            "cognito:groups": ["Operations_Managers", "Tier1_Agents"],
            "token_use": "access",
        }

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization Bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # Attempt to verify token with Cognito JWKS
    jwks = await get_cognito_jwks()
    if jwks and "keys" in jwks:
        try:
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get("kid")
            key = next((k for k in jwks["keys"] if k["kid"] == kid), None)
            if not key:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token key ID")

            claims = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                audience=settings.COGNITO_APP_CLIENT_ID,
                issuer=f"https://cognito-idp.{settings.AWS_REGION}.amazonaws.com/{settings.COGNITO_USER_POOL_ID}",
            )
            return claims
        except JWTError as exc:
            logger.warning(f"JWT signature verification failed: {exc}")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    # In production, signature verification against Cognito JWKS is strictly mandatory
    if settings.ENVIRONMENT != "dev":
        logger.error("Cognito JWKS verification failed or JWKS unavailable in production")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token signature verification failed: Cognito JWKS unavailable or untrusted signature",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fallback to unverified claims strictly in local dev/testing environments
    try:
        claims = jwt.get_unverified_claims(token)
        return claims
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Malformed token: {exc}")


def require_roles(allowed_groups: List[str]):
    """Higher-order dependency enforcing Role-Based Access Control (RBAC)."""
    async def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_groups = current_user.get("cognito:groups", [])
        if not any(group in allowed_groups for group in user_groups):
            logger.warning(
                f"User {current_user.get('sub')} with groups {user_groups} denied access. Required: {allowed_groups}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires membership in one of {allowed_groups}",
            )
        return current_user

    return role_checker


# RBAC Role Dependencies
require_tier1_agent = require_roles(["Tier1_Agents", "Operations_Managers"])
require_operations_manager = require_roles(["Operations_Managers"])
