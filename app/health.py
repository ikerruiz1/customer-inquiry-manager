"""Container health check probes: liveness and readiness."""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, status, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

logger = logging.getLogger("app.health")
router = APIRouter(tags=["Health & Probes"])


@router.get("/health/live", status_code=status.HTTP_200_OK)
async def liveness_probe():
    """Liveness probe: verifies process responsiveness for container restart decisions."""
    return {
        "status": "alive",
        "service": "customer-inquiry-manager",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/health/ready", status_code=status.HTTP_200_OK)
async def readiness_probe(response: Response, db: AsyncSession = Depends(get_db)):
    """Readiness probe: validates database connectivity before admitting traffic."""
    try:
        await db.execute(text("SELECT 1"))
        return {
            "status": "ready",
            "database": "connected",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        logger.warning(f"Readiness probe failed on database ping: {exc}")
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "unready",
            "database": "unreachable",
            "error": str(exc),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
