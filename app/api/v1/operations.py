"""Operational and Automation Endpoints for Cloud-Native Scheduling & SRE Lifecycle."""
import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.services.sla_breach_watcher import get_sla_breach_watcher

logger = logging.getLogger("app.api.v1.operations")
router = APIRouter()


def verify_operational_token(x_operational_token: Optional[str] = Header(None, alias="X-Operational-Token")) -> None:
    """Validate operational bearer token for EventBridge Scheduler or automated webhook execution."""
    expected_token = settings.OPERATIONAL_AUTH_TOKEN

    # In production environments, operational authentication is mandatory
    if settings.ENVIRONMENT.lower() != "dev":
        if not x_operational_token or x_operational_token != expected_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized: Invalid or missing X-Operational-Token header for operational endpoint.",
            )
    else:
        # In local development, if a token is provided, it must match
        if x_operational_token and x_operational_token != expected_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized: Provided X-Operational-Token is invalid.",
            )


@router.post(
    "/audit-sla-lifecycle",
    summary="Trigger Cloud-Native SLA Lifecycle & Compliance Audit",
    description=(
        "Idempotent operational hook invoked by AWS EventBridge Scheduler every 1 minute. "
        "Audits impending SLA deadlines (issuing T-10m proactive warnings), detects breaches "
        "(issuing high-priority escalations), and verifies queue-wide compliance against contractual thresholds."
    ),
    response_model=Dict[str, Any],
)
async def audit_sla_lifecycle(
    _: None = Depends(verify_operational_token),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Execute decoupled SLA lifecycle audit cycle."""
    watcher = get_sla_breach_watcher()
    results = await watcher.audit_breaches_and_compliance(db=db)
    return {
        "status": "success",
        **results,
    }
