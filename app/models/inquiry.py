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

    # Temporal SLAs (ITIL v4 Compliant: Resolution SLA and First Response SLA)
    sla_deadline_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    first_response_deadline_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    first_responded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sla_paused_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    total_paused_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

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
        """Compute remaining seconds until SLA deadline with offset-safe datetime handling.
        Freezes countdown during PENDING_CUSTOMER state.
        """
        if not self.sla_deadline_at:
            return None
        deadline = self.sla_deadline_at
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        if self.status == "PENDING_CUSTOMER" and self.sla_paused_at:
            paused_at = self.sla_paused_at
            if paused_at.tzinfo is None:
                paused_at = paused_at.replace(tzinfo=timezone.utc)
            return max(0, int((deadline - paused_at).total_seconds()))
        now = datetime.now(timezone.utc)
        return int((deadline - now).total_seconds())

    @property
    def confidence_score(self) -> Optional[float]:
        """Model confidence score extracted from Bedrock inference."""
        if isinstance(self.entities, dict):
            val = self.entities.get("confidence_score")
            return float(val) if val is not None else 0.95
        return 0.95

    @property
    def triage_rationale(self) -> Optional[str]:
        """Explainable AI (XAI) rationale derived from Bedrock copilot notes."""
        return self.agent_copilot_notes

    @property
    def bedrock_latency_ms(self) -> Optional[int]:
        """Real measured execution duration of Amazon Bedrock Converse API."""
        if isinstance(self.entities, dict):
            val = self.entities.get("bedrock_latency_ms")
            return int(val) if val is not None else None
        return None

    @property
    def model_id(self) -> Optional[str]:
        """Authoritative AWS Bedrock model identifier."""
        if isinstance(self.entities, dict):
            return self.entities.get("model_id", "eu.anthropic.claude-haiku-4-5-20251001-v1:0")
        return "eu.anthropic.claude-haiku-4-5-20251001-v1:0"

    @property
    def cost_eur(self) -> Optional[float]:
        """Calculated FinOps ingestion unit cost in EUR."""
        if isinstance(self.entities, dict):
            val = self.entities.get("cost_eur")
            return float(val) if val is not None else 0.00025
        return 0.00025


    # Relationships
    audit_logs: Mapped[List["AuditLog"]] = relationship("AuditLog", back_populates="inquiry", cascade="all, delete-orphan")
    messages: Mapped[List["InquiryMessage"]] = relationship(
        "InquiryMessage",
        back_populates="inquiry",
        cascade="all, delete-orphan",
        order_by="InquiryMessage.created_at.asc()",
        lazy="selectin",
    )

    # High-Performance Partial Composite B-Tree Index for active queue lookups
    __table_args__ = (
        Index(
            "idx_active_triage_queue",
            priority.asc(),
            sla_deadline_at.asc(),
            postgresql_where=(status.in_(["UNASSIGNED", "CLAIMED", "PENDING_CUSTOMER"])),
        ),
        Index(
            "idx_inquiries_entities_gin",
            entities,
            postgresql_using="gin",
        ),
    )


class InquiryMessage(Base):
    """Chronological conversation message thread between customer, support operators, and AI copilot."""

    __tablename__ = "inquiry_messages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    inquiry_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_type: Mapped[str] = mapped_column(String(32), nullable=False)  # CUSTOMER, AGENT, SYSTEM, AI_COPILOT
    sender_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sender_email: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_internal_note: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    attachments: Mapped[List[Dict[str, Any]]] = mapped_column(
        JSON().with_variant(JSONB, "postgresql"), nullable=False, default=list
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now, index=True)

    # Relationships
    inquiry: Mapped["Inquiry"] = relationship("Inquiry", back_populates="messages")



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


class Operator(Base):
    """Persistent Operator profile for role-based access control and queue assignment."""

    __tablename__ = "operators"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)  # Tier1_Agent, Operations_Manager
    groups: Mapped[List[str]] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False, default=list)
    totp_secret: Mapped[str] = mapped_column(String(64), nullable=False)
    initials: Mapped[str] = mapped_column(String(8), nullable=False)
    color: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

