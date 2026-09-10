"""SQLAlchemy ORM models for Customer Inquiries and SOC 2 Audit Logs."""
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy import (
    String,
    Text,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


def utc_now() -> datetime:
    """Return timezone-aware current UTC timestamp."""
    return datetime.now(timezone.utc)


class Inquiry(Base):
    """Authoritative Customer Inquiry & AI-Triaged Ticket model."""

    __tablename__ = "inquiries"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    channel: Mapped[str] = mapped_column(String(32), nullable=False, index=True)  # EMAIL, WEB_FORM, TRUSTPILOT, GOOGLE_REVIEWS, BILLING
    customer_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    # Operational status
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="UNASSIGNED", index=True)  # UNASSIGNED, CLAIMED, RESOLVED

    # AI Triage outputs
    department: Mapped[str] = mapped_column(String(32), nullable=False, index=True)  # BILLING, SECURITY, TECH_SUPPORT, ACCOUNTS, SALES, GENERAL
    priority: Mapped[str] = mapped_column(String(8), nullable=False, index=True)  # P1, P2, P3, P4
    urgency: Mapped[int] = mapped_column(Integer, nullable=False, default=1)  # 1 to 5
    impact: Mapped[int] = mapped_column(Integer, nullable=False, default=1)  # 1 to 3
    sentiment_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)  # -1.0 to 1.0
    churn_risk: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)

    # Key Entity Extraction (NER) stored in JSONB (PostgreSQL) / JSON (SQLite)
    entities: Mapped[Dict[str, Any]] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False, default=dict)

    # Copilot Suggested Response & Guidance
    suggested_strategy: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # DIRECT_RESOLUTION, CLARIFICATION_REQUEST, ESCALATION, EMPATHETIC_DEFUSING
    suggested_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    agent_copilot_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Temporal SLAs
    sla_deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    # Human-in-the-Loop Ownership & Resolution
    assigned_agent_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)  # Cognito Sub
    claimed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    human_reviewed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    @property
    def sla_remaining_seconds(self) -> Optional[int]:
        """Compute remaining seconds until SLA deadline with offset-safe datetime handling."""
        if not self.sla_deadline_at:
            return None
        now = datetime.now(timezone.utc)
        deadline = self.sla_deadline_at
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        return int((deadline - now).total_seconds())

    # Relationships
    audit_logs: Mapped[List["AuditLog"]] = relationship("AuditLog", back_populates="inquiry", cascade="all, delete-orphan")

    # High-Performance Partial Composite B-Tree Index for active queue lookups
    __table_args__ = (
        Index(
            "idx_active_triage_queue",
            priority.asc(),
            sla_deadline_at.asc(),
            postgresql_where=(status.in_(["UNASSIGNED", "CLAIMED"])),
        ),
        Index(
            "idx_inquiries_entities_gin",
            entities,
            postgresql_using="gin",
        ),
    )


class AuditLog(Base):
    """Immutable audit trail for MLOps calibration and SOC 2 / HIPAA compliance."""

    __tablename__ = "inquiry_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    inquiry_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)  # Cognito Sub
    action: Mapped[str] = mapped_column(String(64), nullable=False)  # CLAIM, RESOLVE, OVERRIDE_CATEGORY, OVERRIDE_PRIORITY
    previous_value: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    new_value: Mapped[Dict[str, Any]] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    # Relationships
    inquiry: Mapped["Inquiry"] = relationship("Inquiry", back_populates="audit_logs")
