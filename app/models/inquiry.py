"""SQLAlchemy ORM models for Customer Inquiries and SOC 2 Audit Logs."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Column,
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
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now() -> datetime:
    """Return timezone-aware current UTC timestamp."""
    return datetime.now(timezone.utc)


class Inquiry(Base):
    """Authoritative Customer Inquiry & AI-Triaged Ticket model."""

    __tablename__ = "inquiries"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    channel = Column(String(32), nullable=False, index=True)  # EMAIL, WEB_FORM, TRUSTPILOT, GOOGLE_REVIEWS, BILLING
    customer_email = Column(String(255), nullable=False, index=True)
    customer_name = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)

    # Operational status
    status = Column(String(32), nullable=False, default="UNASSIGNED", index=True)  # UNASSIGNED, CLAIMED, RESOLVED

    # AI Triage outputs
    department = Column(String(32), nullable=False, index=True)  # BILLING, SECURITY, TECH_SUPPORT, ACCOUNTS, SALES, GENERAL
    priority = Column(String(8), nullable=False, index=True)  # P1, P2, P3, P4
    urgency = Column(Integer, nullable=False, default=1)  # 1 to 5
    impact = Column(Integer, nullable=False, default=1)  # 1 to 3
    sentiment_score = Column(Float, nullable=False, default=0.0)  # -1.0 to 1.0
    churn_risk = Column(Boolean, nullable=False, default=False, index=True)

    # Key Entity Extraction (NER) stored in JSONB (PostgreSQL) / JSON (SQLite)
    entities = Column(JSON().with_variant(JSONB, "postgresql"), nullable=False, default=dict)

    # Copilot Suggested Response & Guidance
    suggested_strategy = Column(String(64), nullable=True)  # DIRECT_RESOLUTION, CLARIFICATION_REQUEST, ESCALATION, EMPATHETIC_DEFUSING
    suggested_response = Column(Text, nullable=True)
    agent_copilot_notes = Column(Text, nullable=True)

    # Temporal SLAs
    sla_deadline_at = Column(DateTime(timezone=True), nullable=False, index=True)

    # Human-in-the-Loop Ownership & Resolution
    assigned_agent_id = Column(String(128), nullable=True, index=True)  # Cognito Sub
    claimed_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_text = Column(Text, nullable=True)
    human_reviewed = Column(Boolean, nullable=False, default=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

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
    audit_logs = relationship("AuditLog", back_populates="inquiry", cascade="all, delete-orphan")

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

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    inquiry_id = Column(Uuid, ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id = Column(String(128), nullable=False, index=True)  # Cognito Sub
    action = Column(String(64), nullable=False)  # CLAIM, RESOLVE, OVERRIDE_CATEGORY, OVERRIDE_PRIORITY
    previous_value = Column(JSON().with_variant(JSONB, "postgresql"), nullable=True)
    new_value = Column(JSON().with_variant(JSONB, "postgresql"), nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utc_now)

    # Relationships
    inquiry = relationship("Inquiry", back_populates="audit_logs")
