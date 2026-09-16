"""Pydantic v2 validation schemas for Customer Inquiries, Webhooks, and HITL Lifecycle."""
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from app.schemas.bedrock import DepartmentEnum, ResponseStrategyEnum


class ChannelEnum(str, Enum):
    """Inbound omnichannel sources."""
    EMAIL = "EMAIL"
    WEB_FORM = "WEB_FORM"
    TRUSTPILOT = "TRUSTPILOT"
    GOOGLE_REVIEWS = "GOOGLE_REVIEWS"
    BILLING = "BILLING"


class PriorityEnum(str, Enum):
    """ITIL Priority classification."""
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"


class InquiryStatusEnum(str, Enum):
    """Lifecycle state machine for inquiries."""
    UNASSIGNED = "UNASSIGNED"
    CLAIMED = "CLAIMED"
    PENDING_CUSTOMER = "PENDING_CUSTOMER"
    RESOLVED = "RESOLVED"


class MessageSenderEnum(str, Enum):
    """Authoritative sender identity for conversation messages."""
    CUSTOMER = "CUSTOMER"
    AGENT = "AGENT"
    SYSTEM = "SYSTEM"
    AI_COPILOT = "AI_COPILOT"


class MessageActionEnum(str, Enum):
    """Dispatch action taken by support operator."""
    REPLY = "REPLY"
    REQUEST_INFO = "REQUEST_INFO"  # Transitions ticket to PENDING_CUSTOMER & pauses SLA
    INTERNAL_NOTE = "INTERNAL_NOTE"  # Private team note


class InquiryMessageCreate(BaseModel):
    """Operator message submission payload."""
    body: str = Field(..., min_length=1, description="Message text content")
    action: MessageActionEnum = Field(default=MessageActionEnum.REPLY, description="Operator action mode")
    attachments: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Pre-signed S3 attachment references")


class CustomerReplyCreate(BaseModel):
    """Inbound reply from customer (via email thread, portal, or simulation)."""
    body: str = Field(..., min_length=1, description="Customer reply message text")
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    attachments: Optional[List[Dict[str, Any]]] = Field(default_factory=list)


class InquiryMessageResponse(BaseModel):
    """Serialized conversation message record."""
    id: UUID
    inquiry_id: UUID
    sender_type: str
    sender_name: str
    sender_email: str
    body: str
    is_internal_note: bool = False
    attachments: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)



class InquiryCreate(BaseModel):
    """Canonical normalization schema into which all external webhooks are transformed."""

    channel: ChannelEnum = Field(..., description="Inbound communication channel")
    customer_email: EmailStr = Field(..., description="Customer contact email address")
    customer_name: str = Field(..., min_length=1, max_length=255, description="Full customer name")
    subject: str = Field(..., min_length=1, max_length=255, description="Inquiry subject or title")
    body: str = Field(..., min_length=1, description="Unstructured customer inquiry text")


class InquiryClaim(BaseModel):
    """Atomic claim request by an authenticated support agent."""
    pass


class InquiryResolve(BaseModel):
    """Human-in-the-Loop ticket resolution submission."""

    resolution_text: str = Field(..., min_length=5, description="Final response dispatched to customer")
    notes: Optional[str] = Field(None, description="Optional internal closing notes")


class InquiryOverride(BaseModel):
    """Agent override for machine learning continuous calibration and audit trail."""

    new_department: Optional[DepartmentEnum] = None
    new_priority: Optional[PriorityEnum] = None
    reason: str = Field(..., min_length=10, description="Mandatory engineering rationale for override")


class AuditLogResponse(BaseModel):
    """Audit log record for traceability."""

    id: UUID
    inquiry_id: UUID
    agent_id: str
    action: str
    previous_value: Optional[Dict[str, Any]] = None
    new_value: Dict[str, Any]
    reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InquiryResponse(BaseModel):
    """Complete ticket representation returned to the Operations Console."""

    id: UUID
    channel: ChannelEnum
    customer_email: str
    customer_name: str
    subject: str
    body: str
    status: InquiryStatusEnum

    # Triage Attributes
    department: DepartmentEnum
    priority: PriorityEnum
    urgency: int
    impact: int
    sentiment_score: float
    churn_risk: bool
    entities: Dict[str, Any]

    # Copilot Drafting & Explainable AI
    suggested_strategy: Optional[ResponseStrategyEnum] = None
    suggested_response: Optional[str] = None
    agent_copilot_notes: Optional[str] = None
    confidence_score: Optional[float] = None
    triage_rationale: Optional[str] = None
    bedrock_latency_ms: Optional[int] = None
    model_id: Optional[str] = None
    cost_eur: Optional[float] = None


    # Temporal SLAs (ITIL v4 Compliant)
    sla_deadline_at: datetime
    sla_remaining_seconds: Optional[int] = None
    first_response_deadline_at: Optional[datetime] = None
    first_responded_at: Optional[datetime] = None
    sla_paused_at: Optional[datetime] = None
    total_paused_seconds: int = 0

    # Ownership
    assigned_agent_id: Optional[str] = None
    claimed_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    resolution_text: Optional[str] = None
    human_reviewed: bool

    # Conversation thread
    messages: Optional[List[InquiryMessageResponse]] = None

    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InquiryListResponse(BaseModel):
    """Paginated inquiry list response."""

    items: List[InquiryResponse]
    total: int
    page: int
    page_size: int
