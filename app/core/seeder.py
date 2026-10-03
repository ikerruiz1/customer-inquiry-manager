"""Canonical database seeder and operator registry for Customer Inquiry Manager.

Provides idempotent schema initialization, pre-provisioned enterprise operator profiles,
and zero hardcoded customer inquiries for clean live demonstration.
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy import select, func

from app.core.database import Base, engine, AsyncSessionLocal
from app.models.inquiry import Inquiry, Operator, InquiryMessage
from app.core.config import settings

logger = logging.getLogger("app.core.seeder")

CANONICAL_OPERATORS: List[Dict[str, Any]] = [
    {
        "id": "00000000-0000-0000-0000-000000000001",
        "name": getattr(settings, "INITIAL_OPERATOR_NAME", "Cloud Administrator"),
        "email": settings.INITIAL_OPERATOR_EMAIL,
        "password": settings.INITIAL_OPERATOR_PASSWORD,
        "role": "Operations_Manager",
        "groups": ["Operations_Managers", "Tier1_Agents"],
        "totp_secret": "JBSWY3DPEHPK3PXP",
        "initials": "".join([part[0] for part in getattr(settings, "INITIAL_OPERATOR_NAME", "Cloud Administrator").split()][:2]).upper() or "CA",
        "color": "#3b82f6",
    },
]


def build_canonical_operator_registry() -> Dict[str, Dict[str, Any]]:
    """Build canonical operator registry keyed by email with backwards-compatible aliases."""
    registry: Dict[str, Dict[str, Any]] = {}
    for op in CANONICAL_OPERATORS:
        registry[op["email"]] = {**op}
    primary_email = CANONICAL_OPERATORS[0]["email"]
    registry["employer1@company.local"] = registry[primary_email]
    registry["employer1@company.internal"] = registry[primary_email]
    registry["carlos.m@company.internal"] = registry[primary_email]
    registry["carlos.m@company.local"] = registry[primary_email]
    return registry


def build_canonical_sample_inquiries(reference_time: Optional[datetime] = None) -> List[Inquiry]:
    """Return zero hardcoded customer inquiries for clean operational environment."""
    return []


async def ensure_schema_extensions() -> None:
    """Idempotently add columns and indexes introduced after the initial schema release.

    create_all() only provisions missing tables, so pre-existing deployments require an
    explicit additive migration. Every statement is guarded and safe to run on each boot.
    """
    try:
        from sqlalchemy import inspect, text

        def _apply_extensions(sync_conn):
            inspector = inspect(sync_conn)
            if "inquiry_messages" not in set(inspector.get_table_names()):
                return
            existing_columns = {col["name"] for col in inspector.get_columns("inquiry_messages")}
            if "provider_message_id" not in existing_columns:
                sync_conn.execute(
                    text("ALTER TABLE inquiry_messages ADD COLUMN provider_message_id VARCHAR(255)")
                )
            sync_conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS ix_inquiry_messages_provider_message_id "
                    "ON inquiry_messages (provider_message_id)"
                )
            )

        async with engine.begin() as conn:
            await conn.run_sync(_apply_extensions)
    except Exception as exc:
        logger.warning(f"Additive schema migration skipped or failed: {exc}")


async def init_db_and_seed() -> None:
    """Initialize database tables and idempotently seed operator registry."""
    try:
        from app.services.cognito_service import _OPERATOR_REGISTRY

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with AsyncSessionLocal() as session:
            op_count_res = await session.execute(select(func.count()).select_from(Operator))
            if op_count_res.scalar_one() == 0:
                canonical_operators = [
                    Operator(
                        id=op["id"],
                        name=op["name"],
                        email=op["email"],
                        password_hash=op["password"],
                        role=op["role"],
                        groups=op["groups"],
                        totp_secret=op["totp_secret"],
                        initials=op["initials"],
                        color=op["color"],
                    )
                    for op in CANONICAL_OPERATORS
                ]
                session.add_all(canonical_operators)
                await session.commit()
                logger.info("Pre-seeded canonical operators into persistent database.")

            # Synchronize database operators into in-memory registry for instant auth lookup
            all_ops_res = await session.execute(select(Operator))
            for op in all_ops_res.scalars().all():
                _OPERATOR_REGISTRY[op.email] = {
                    "id": op.id,
                    "name": op.name,
                    "email": op.email,
                    "password": op.password_hash,
                    "role": op.role,
                    "groups": op.groups,
                    "totp_secret": op.totp_secret,
                    "initials": op.initials,
                    "color": op.color,
                }
    except Exception as exc:
        logger.warning(f"Database schema initialization skipped or failed: {exc}")
