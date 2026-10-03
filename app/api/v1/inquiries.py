"""Customer Inquiries and AI-Powered Triage endpoints."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_tier1_agent, require_operations_manager
from app.core.telemetry import emit_emf_metric
from app.models.inquiry import Inquiry, AuditLog, InquiryMessage
from app.schemas.inquiry import (
    InquiryCreate,
    InquiryResponse,
    InquiryResolve,
    InquiryOverride,
    InquiryListResponse,
    AuditLogResponse,
    InquiryStatusEnum,
    DepartmentEnum,
    PriorityEnum,
    InquiryMessageCreate,
    InquiryMessageResponse,
    CustomerReplyCreate,
    MessageActionEnum,
    MessageSenderEnum,
)
from app.services.bedrock_service import BedrockService, get_bedrock_service
from app.services.sns_service import SNSService, get_sns_service
from app.services.email_service import EmailService, get_email_service
from app.services.email_filter import is_automated_delivery_failure_or_loop, extract_customer_name_from_body

logger = logging.getLogger("app.api.v1.inquiries")
router = APIRouter()


async def _latest_outbound_message_id(db: AsyncSession, inquiry_id: UUID) -> Optional[str]:
    """Return the RFC 5322 Message-ID of the most recent customer-facing email for this ticket.

    Used to chain In-Reply-To / References headers so customer mail clients thread the
    conversation natively and inbound replies can be correlated without subject parsing.
    """
    res = await db.execute(
        select(InquiryMessage.provider_message_id)
        .where(
            InquiryMessage.inquiry_id == inquiry_id,
            InquiryMessage.sender_type == "AGENT",
            InquiryMessage.is_internal_note.is_(False),
            InquiryMessage.provider_message_id.is_not(None),
        )
        .order_by(InquiryMessage.created_at.desc())
        .limit(1)
    )
    return res.scalars().first()


def calculate_sla(
    urgency: int, impact: int, churn_risk: bool, reference_time: Optional[datetime] = None
) -> tuple[str, datetime, datetime]:
    """Compute ITIL priority classification, resolution deadline, and First Response Time (FRT) deterministically."""
    now = reference_time or datetime.now(timezone.utc)

    if urgency >= 4 and impact >= 3:
        priority = "P1"
        resolution_hours = 1
        frt_minutes = 15
    elif urgency >= 3 and impact >= 2:
        priority = "P2"
        resolution_hours = 4
        frt_minutes = 60
    elif urgency >= 2 and impact >= 1:
        priority = "P3"
        resolution_hours = 12
        frt_minutes = 240
    else:
        priority = "P4"
        resolution_hours = 24
        frt_minutes = 480

    # 2. Churn Risk Priority Escalation Guardrail
    if churn_risk and priority in ["P3", "P4"]:
        logger.info(f"Escalating priority from {priority} to P2 due to high churn risk factor.")
        priority = "P2"
        resolution_hours = 4
        frt_minutes = 60

    resolution_deadline = now + timedelta(hours=resolution_hours)
    frt_deadline = now + timedelta(minutes=frt_minutes)
    return priority, resolution_deadline, frt_deadline


async def process_and_persist_inquiry(
    inquiry_in: InquiryCreate,
    db: AsyncSession,
    bedrock: BedrockService,
    sns: SNSService,
) -> Inquiry:
    """Core domain pipeline: Bedrock triage, ITIL SLA calculation, PostgreSQL persistence, and SNS dispatch."""
    # 0. Defensive Guardrail: Filter out automated bounce, NDR, or mailer-daemon loops
    is_filtered, reason = is_automated_delivery_failure_or_loop(
        sender_email=inquiry_in.customer_email,
        subject=inquiry_in.subject,
        body=inquiry_in.body,
    )
    if is_filtered:
        logger.warning(
            f"Inbound inquiry rejected by NDR/bounce filter: sender '{inquiry_in.customer_email}' - Reason: {reason}"
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Inbound inquiry suppressed: Automated delivery failure / NDR notification detected ({reason}).",
        )

    triage_result = await bedrock.triage_inquiry(
        channel=inquiry_in.channel.value,
        subject=inquiry_in.subject,
        body=inquiry_in.body,
    )

    priority, sla_deadline, frt_deadline = calculate_sla(
        urgency=triage_result.urgency_rating,
        impact=triage_result.impact_rating,
        churn_risk=triage_result.churn_risk,
    )

    policy = settings.CUSTOMER_ACCESS_POLICY or {}
    require_registered = policy.get("require_registered_account", False)
    verification_mode = policy.get("verification_mode", "FLAG_UNVERIFIED")

    existing_inquiry_query = await db.execute(
        select(Inquiry.id).where(Inquiry.customer_email == inquiry_in.customer_email).limit(1)
    )
    is_registered_customer = existing_inquiry_query.scalar_one_or_none() is not None

    if require_registered and not is_registered_customer:
        logger.warning(
            f"Inbound inquiry rejected by access policy: sender {inquiry_in.customer_email} is not registered."
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inbound inquiry rejected: Sender email is not registered under company access policy.",
        )

    entities = dict(triage_result.key_entities or {})
    entities["sender_verification"] = "VERIFIED_CUSTOMER" if is_registered_customer else "UNVERIFIED_SENDER"
    entities["confidence_score"] = triage_result.confidence_score
    entities["bedrock_latency_ms"] = triage_result.latency_ms
    entities["model_id"] = triage_result.model_id
    entities["input_tokens"] = triage_result.input_tokens
    entities["output_tokens"] = triage_result.output_tokens
    entities["cost_eur"] = triage_result.cost_eur

    agent_notes = triage_result.agent_copilot_notes or ""
    if verification_mode == "FLAG_UNVERIFIED" and not is_registered_customer:
        policy_notice = "[SECURITY POLICY WARNING] Inbound sender not found in verified account registry. Verify identity before releasing account telemetry."
        agent_notes = f"{policy_notice}\n\n{agent_notes}" if agent_notes else policy_notice

    resolved_customer_name = extract_customer_name_from_body(
        body=inquiry_in.body,
        fallback_name=inquiry_in.customer_name,
        sender_email=inquiry_in.customer_email,
    )

    inquiry = Inquiry(
        channel=inquiry_in.channel.value,
        customer_email=inquiry_in.customer_email,
        customer_name=resolved_customer_name,
        subject=inquiry_in.subject,
        body=inquiry_in.body,
        status="UNASSIGNED",
        department=triage_result.department.value,
        priority=priority,
        urgency=triage_result.urgency_rating,
        impact=triage_result.impact_rating,
        sentiment_score=triage_result.sentiment_score,
        churn_risk=triage_result.churn_risk,
        entities=entities,
        suggested_strategy=triage_result.suggested_strategy.value,
        suggested_response=triage_result.suggested_response,
        agent_copilot_notes=agent_notes,
        sla_deadline_at=sla_deadline,
        first_response_deadline_at=frt_deadline,
    )

    db.add(inquiry)
    await db.flush()

    opening_msg = InquiryMessage(
        inquiry_id=inquiry.id,
        sender_type="CUSTOMER",
        sender_name=inquiry.customer_name,
        sender_email=inquiry.customer_email,
        body=inquiry.body,
        is_internal_note=False,
        attachments=[],
        created_at=inquiry.created_at,
    )
    db.add(opening_msg)
    await db.flush()
    fetch_stmt = select(Inquiry).options(selectinload(Inquiry.messages)).where(Inquiry.id == inquiry.id)
    fetch_res = await db.execute(fetch_stmt)
    inquiry = fetch_res.scalar_one()

    inquiry_dict = {
        "id": str(inquiry.id),
        "customer_email": inquiry.customer_email,
        "subject": inquiry.subject,
        "priority": inquiry.priority,
        "department": inquiry.department,
        "urgency": inquiry.urgency,
        "impact": inquiry.impact,
        "churn_risk": inquiry.churn_risk,
        "sla_deadline_at": inquiry.sla_deadline_at.isoformat(),
    }
    await sns.publish_ticket_created(inquiry_dict)
    if settings.SLACK_NOTIFICATION_POLICY == "ALL_INQUIRIES" or priority in ["P1", "P2"]:
        await sns.publish_ops_alert(inquiry_dict)

    emit_emf_metric(
        metric_name="TicketsTriaged",
        value=1.0,
        dimensions={"Department": inquiry.department, "Priority": inquiry.priority},
    )

    return inquiry


@router.post("/", response_model=InquiryResponse, status_code=status.HTTP_201_CREATED)
async def create_inquiry(
    inquiry_in: InquiryCreate,
    db: AsyncSession = Depends(get_db),
    bedrock: BedrockService = Depends(get_bedrock_service),
    sns: SNSService = Depends(get_sns_service),
):
    """Direct API intake: receives inquiry, runs Bedrock triage, computes SLA, and queues for agents."""
    inquiry = await process_and_persist_inquiry(inquiry_in, db, bedrock, sns)
    return inquiry


@router.get("/", response_model=InquiryListResponse)
async def list_inquiries(
    status_filter: Optional[InquiryStatusEnum] = Query(None, alias="status"),
    department: Optional[DepartmentEnum] = None,
    priority: Optional[PriorityEnum] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_tier1_agent),
):
    """Retrieve prioritized queue utilizing partial index on (priority ASC, sla_deadline_at ASC)."""
    base_query = select(Inquiry)

    if status_filter:
        base_query = base_query.where(Inquiry.status == status_filter.value)
    if department:
        base_query = base_query.where(Inquiry.department == department.value)
    if priority:
        base_query = base_query.where(Inquiry.priority == priority.value)

    count_stmt = select(func.count()).select_from(base_query.subquery())
    total_res = await db.execute(count_stmt)
    total = total_res.scalar_one()

    # Order by ITIL priority, then nearest SLA deadline (Tie-breaking algorithm)
    stmt = (
        base_query.options(selectinload(Inquiry.messages))
        .order_by(Inquiry.priority.asc(), Inquiry.sla_deadline_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    items = result.scalars().all()

    inquiry_responses = [InquiryResponse.model_validate(item) for item in items]

    return InquiryListResponse(
        items=inquiry_responses,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{inquiry_id}", response_model=InquiryResponse)
async def get_inquiry(
    inquiry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_tier1_agent),
):
    """Retrieve a single inquiry by ID with computed SLA countdown and messages."""
    stmt = select(Inquiry).options(selectinload(Inquiry.messages)).where(Inquiry.id == inquiry_id)
    result = await db.execute(stmt)
    inquiry = result.scalar_one_or_none()

    if not inquiry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inquiry not found")

    return inquiry


@router.patch("/{inquiry_id}/claim", response_model=InquiryResponse)
async def claim_inquiry(
    inquiry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_tier1_agent),
):
    """Atomic SQL claim: assigns inquiry to the authenticated agent preventing race conditions."""
    agent_id = current_user.get("sub", "unknown-agent")
    now = datetime.now(timezone.utc)

    # Atomic conditional update: only claim if currently UNASSIGNED
    stmt = (
        update(Inquiry)
        .where(Inquiry.id == inquiry_id, Inquiry.status == "UNASSIGNED")
        .values(
            status="CLAIMED",
            assigned_agent_id=agent_id,
            claimed_at=now,
        )
        .returning(Inquiry.id)
    )

    result = await db.execute(stmt)
    updated_id = result.scalar_one_or_none()

    if not updated_id:
        check_stmt = select(Inquiry).where(Inquiry.id == inquiry_id)
        check_res = await db.execute(check_stmt)
        existing = check_res.scalar_one_or_none()
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inquiry not found")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Inquiry is already claimed by agent {existing.assigned_agent_id}",
        )

    audit = AuditLog(
        inquiry_id=inquiry_id,
        agent_id=agent_id,
        action="CLAIM",
        previous_value={"status": "UNASSIGNED", "assigned_agent_id": None},
        new_value={"status": "CLAIMED", "assigned_agent_id": agent_id},
        reason="Agent claimed ticket from queue",
    )
    db.add(audit)
    await db.flush()

    fetch_stmt = select(Inquiry).options(selectinload(Inquiry.messages)).where(Inquiry.id == inquiry_id)
    fetch_res = await db.execute(fetch_stmt)
    return fetch_res.scalar_one()


@router.patch("/{inquiry_id}/resolve", response_model=InquiryResponse)
async def resolve_inquiry(
    inquiry_id: UUID,
    payload: InquiryResolve,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_tier1_agent),
):
    """Human-in-the-Loop ticket resolution: closes inquiry and captures auditor identity."""
    agent_id = current_user.get("sub", "unknown-agent")
    agent_name = current_user.get("name") or current_user.get("preferred_username") or "Support Agent"
    agent_email = current_user.get("email", "agent@company.com")
    now = datetime.now(timezone.utc)

    stmt = select(Inquiry).options(selectinload(Inquiry.messages)).where(Inquiry.id == inquiry_id)
    res = await db.execute(stmt)
    inquiry = res.scalar_one_or_none()

    if not inquiry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inquiry not found")

    prev_status = inquiry.status

    # If resolving while in PENDING_CUSTOMER, unpause and extend deadline
    if inquiry.status == "PENDING_CUSTOMER" and inquiry.sla_paused_at:
        paused_at = inquiry.sla_paused_at
        if paused_at.tzinfo is None:
            paused_at = paused_at.replace(tzinfo=timezone.utc)
        pause_delta = max(0, int((now - paused_at).total_seconds()))
        inquiry.sla_deadline_at = inquiry.sla_deadline_at + timedelta(seconds=pause_delta)
        inquiry.total_paused_seconds += pause_delta
        inquiry.sla_paused_at = None

    if inquiry.first_responded_at is None:
        inquiry.first_responded_at = now

    inquiry.status = "RESOLVED"
    inquiry.resolution_text = payload.resolution_text
    inquiry.resolved_at = now
    inquiry.human_reviewed = True

    audit = AuditLog(
        inquiry_id=inquiry_id,
        agent_id=agent_id,
        action="RESOLVE",
        previous_value={"status": prev_status},
        new_value={"status": "RESOLVED", "resolution_text": payload.resolution_text},
        reason=payload.notes or "Ticket resolved by support agent",
    )
    db.add(audit)

    resolution_msg = InquiryMessage(
        inquiry_id=inquiry.id,
        sender_type="AGENT",
        sender_name=agent_name,
        sender_email=agent_email,
        body=payload.resolution_text,
        is_internal_note=False,
        attachments=[],
        created_at=now,
    )
    db.add(resolution_msg)

    try:
        email_svc = get_email_service()
        prior_message_id = await _latest_outbound_message_id(db, inquiry.id)
        delivery = await email_svc.send_customer_notification(
            customer_email=inquiry.customer_email,
            customer_name=inquiry.customer_name,
            ticket_id=str(inquiry.id),
            ticket_subject=inquiry.subject,
            message_body=f"Your support ticket has been resolved.\n\n{payload.resolution_text}",
            action_type="REPLY",
            agent_name=agent_name,
            in_reply_to=prior_message_id,
            references=prior_message_id,
        )
        resolution_msg.provider_message_id = delivery.get("message_id")
    except Exception as exc:
        logger.warning(f"Failed to dispatch resolution email notification: {exc}")

    await db.flush()

    fetch_stmt = select(Inquiry).options(selectinload(Inquiry.messages)).where(Inquiry.id == inquiry_id)
    fetch_res = await db.execute(fetch_stmt)
    return fetch_res.scalar_one()


@router.patch("/{inquiry_id}/override", response_model=InquiryResponse)
async def override_inquiry_classification(
    inquiry_id: UUID,
    override_in: InquiryOverride,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_operations_manager),
):
    """MLOps audit log calibration: override AI department or priority classification with audit reasoning."""
    agent_id = current_user.get("sub", "unknown-agent")

    stmt = select(Inquiry).options(selectinload(Inquiry.messages)).where(Inquiry.id == inquiry_id)
    res = await db.execute(stmt)
    inquiry = res.scalar_one_or_none()

    if not inquiry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inquiry not found")

    prev_state = {"department": inquiry.department, "priority": inquiry.priority}

    if override_in.new_department:
        inquiry.department = override_in.new_department.value
    if override_in.new_priority:
        inquiry.priority = override_in.new_priority.value

    new_state = {"department": inquiry.department, "priority": inquiry.priority}

    audit = AuditLog(
        inquiry_id=inquiry_id,
        agent_id=agent_id,
        action="OVERRIDE_CLASSIFICATION",
        previous_value=prev_state,
        new_value=new_state,
        reason=override_in.reason,
    )
    db.add(audit)
    await db.flush()

    fetch_stmt = select(Inquiry).options(selectinload(Inquiry.messages)).where(Inquiry.id == inquiry_id)
    fetch_res = await db.execute(fetch_stmt)
    return fetch_res.scalar_one()


@router.get("/{inquiry_id}/messages", response_model=List[InquiryMessageResponse])
async def list_inquiry_messages(
    inquiry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_tier1_agent),
):
    """Retrieve chronological conversation thread for a ticket."""
    stmt = (
        select(InquiryMessage)
        .where(InquiryMessage.inquiry_id == inquiry_id)
        .order_by(InquiryMessage.created_at.asc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/{inquiry_id}/messages", response_model=InquiryMessageResponse, status_code=status.HTTP_201_CREATED)
async def post_inquiry_message(
    inquiry_id: UUID,
    payload: InquiryMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_tier1_agent),
):
    """Send an agent reply, ask customer for info (pausing SLA), or append an internal note."""
    agent_id = current_user.get("sub", "unknown-agent")
    agent_name = current_user.get("name") or current_user.get("preferred_username") or "Support Agent"
    agent_email = current_user.get("email", "agent@company.com")
    now = datetime.now(timezone.utc)

    stmt = select(Inquiry).where(Inquiry.id == inquiry_id)
    res = await db.execute(stmt)
    inquiry = res.scalar_one_or_none()
    if not inquiry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inquiry not found")

    is_internal = payload.action == MessageActionEnum.INTERNAL_NOTE

    if not is_internal and inquiry.first_responded_at is None:
        inquiry.first_responded_at = now

    if payload.action == MessageActionEnum.REQUEST_INFO:
        prev_status = inquiry.status
        inquiry.status = "PENDING_CUSTOMER"
        inquiry.sla_paused_at = now

        audit = AuditLog(
            inquiry_id=inquiry_id,
            agent_id=agent_id,
            action="PAUSE_SLA_PENDING_CUSTOMER",
            previous_value={"status": prev_status, "sla_paused_at": None},
            new_value={"status": "PENDING_CUSTOMER", "sla_paused_at": now.isoformat()},
            reason="Agent requested additional information from customer; SLA clock frozen.",
        )
        db.add(audit)
    elif payload.action == MessageActionEnum.REPLY:
        audit = AuditLog(
            inquiry_id=inquiry_id,
            agent_id=agent_id,
            action="AGENT_REPLY",
            previous_value={"status": inquiry.status},
            new_value={"status": inquiry.status},
            reason="Agent replied to customer.",
        )
        db.add(audit)
    else:
        audit = AuditLog(
            inquiry_id=inquiry_id,
            agent_id=agent_id,
            action="INTERNAL_NOTE",
            previous_value=None,
            new_value={"is_internal_note": True},
            reason="Internal operator note appended to inquiry thread.",
        )
        db.add(audit)

    msg = InquiryMessage(
        inquiry_id=inquiry_id,
        sender_type="AGENT",
        sender_name=agent_name,
        sender_email=agent_email,
        body=payload.body,
        is_internal_note=is_internal,
        attachments=payload.attachments or [],
        created_at=now,
    )
    db.add(msg)
    await db.flush()
    await db.refresh(msg)

    if not is_internal and payload.action in [MessageActionEnum.REPLY, MessageActionEnum.REQUEST_INFO]:
        try:
            email_svc = get_email_service()
            prior_message_id = await _latest_outbound_message_id(db, inquiry_id)
            delivery = await email_svc.send_customer_notification(
                customer_email=inquiry.customer_email,
                customer_name=inquiry.customer_name,
                ticket_id=str(inquiry.id),
                ticket_subject=inquiry.subject,
                message_body=payload.body,
                action_type=payload.action.value,
                agent_name=agent_name,
                in_reply_to=prior_message_id,
                references=prior_message_id,
            )
            msg.provider_message_id = delivery.get("message_id")
        except Exception as exc:
            logger.warning(f"Failed to dispatch customer outbound email notification: {exc}")

    return msg


@router.post("/{inquiry_id}/customer-reply", response_model=InquiryMessageResponse, status_code=status.HTTP_201_CREATED)
async def post_customer_reply(
    inquiry_id: UUID,
    payload: CustomerReplyCreate,
    db: AsyncSession = Depends(get_db),
):
    """Receive customer reply. If ticket was PENDING_CUSTOMER, dynamically extends SLA deadline and resumes queue."""
    now = datetime.now(timezone.utc)

    stmt = select(Inquiry).where(Inquiry.id == inquiry_id)
    res = await db.execute(stmt)
    inquiry = res.scalar_one_or_none()
    if not inquiry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inquiry not found")

    if inquiry.status == "PENDING_CUSTOMER":
        paused_at = inquiry.sla_paused_at or inquiry.updated_at
        if paused_at.tzinfo is None:
            paused_at = paused_at.replace(tzinfo=timezone.utc)
        pause_delta = max(0, int((now - paused_at).total_seconds()))

        old_deadline = inquiry.sla_deadline_at
        inquiry.sla_deadline_at = inquiry.sla_deadline_at + timedelta(seconds=pause_delta)
        inquiry.total_paused_seconds += pause_delta
        inquiry.sla_paused_at = None

        resumed_status = "CLAIMED" if inquiry.assigned_agent_id else "UNASSIGNED"
        inquiry.status = resumed_status

        audit = AuditLog(
            inquiry_id=inquiry_id,
            agent_id="customer",
            action="RESUME_SLA_CUSTOMER_REPLY",
            previous_value={"status": "PENDING_CUSTOMER", "sla_deadline_at": old_deadline.isoformat()},
            new_value={
                "status": resumed_status,
                "sla_deadline_at": inquiry.sla_deadline_at.isoformat(),
                "total_paused_seconds": inquiry.total_paused_seconds,
            },
            reason=f"Customer responded. SLA clock resumed and deadline extended by {pause_delta} seconds.",
        )
        db.add(audit)

    msg = InquiryMessage(
        inquiry_id=inquiry_id,
        sender_type="CUSTOMER",
        sender_name=payload.customer_name or inquiry.customer_name,
        sender_email=payload.customer_email or inquiry.customer_email,
        body=payload.body,
        is_internal_note=False,
        attachments=payload.attachments or [],
        created_at=now,
    )
    db.add(msg)
    await db.flush()
    await db.refresh(msg)
    return msg


@router.get("/{inquiry_id}/copilot-draft")
async def get_copilot_draft(
    inquiry_id: UUID,
    action_type: MessageActionEnum = Query(MessageActionEnum.REPLY),
    db: AsyncSession = Depends(get_db),
    bedrock: BedrockService = Depends(get_bedrock_service),
    current_user: dict = Depends(require_tier1_agent),
):
    """Generate tailored AI Copilot draft dynamically based on selected action mode (REPLY, REQUEST_INFO, INTERNAL_NOTE)."""
    stmt = select(Inquiry).options(selectinload(Inquiry.messages)).where(Inquiry.id == inquiry_id)
    res = await db.execute(stmt)
    inquiry = res.scalar_one_or_none()
    if not inquiry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inquiry not found")

    conv_history = [
        {
            "sender_type": m.sender_type,
            "sender_name": m.sender_name,
            "body": m.body,
            "is_internal_note": m.is_internal_note,
        }
        for m in (inquiry.messages or [])
    ]

    draft = await bedrock.generate_action_draft(
        customer_name=inquiry.customer_name,
        subject=inquiry.subject,
        body=inquiry.body,
        department=inquiry.department,
        action_type=action_type.value,
        entities=inquiry.entities,
        conversation_history=conv_history,
    )
    return {"action_type": action_type.value, "draft": draft}


@router.get("/{inquiry_id}/audit-logs", response_model=List[AuditLogResponse])
async def get_inquiry_audit_logs(
    inquiry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_tier1_agent),
):
    """Retrieve full audit history for compliance and verification."""
    stmt = select(AuditLog).where(AuditLog.inquiry_id == inquiry_id).order_by(AuditLog.created_at.asc())
    res = await db.execute(stmt)
    logs = res.scalars().all()
    return logs


@router.delete("/{inquiry_id}", status_code=status.HTTP_200_OK)
async def delete_inquiry(
    inquiry_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_tier1_agent),
):
    """Delete a specific ticket, its conversation messages, and associated audit logs."""
    from sqlalchemy import delete
    stmt = select(Inquiry).where(Inquiry.id == inquiry_id)
    res = await db.execute(stmt)
    inquiry = res.scalar_one_or_none()
    if not inquiry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inquiry not found")

    await db.execute(delete(AuditLog).where(AuditLog.inquiry_id == inquiry_id))
    await db.execute(delete(InquiryMessage).where(InquiryMessage.inquiry_id == inquiry_id))
    await db.execute(delete(Inquiry).where(Inquiry.id == inquiry_id))
    await db.commit()
    return {"message": f"Ticket #{str(inquiry_id)[:8].upper()} deleted successfully", "id": str(inquiry_id)}


@router.post("/reset-demo-data", status_code=status.HTTP_200_OK)
async def reset_demo_inquiries(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_tier1_agent),
):
    """Zero-manual reset: restores canonical dev inquiries and clears audit logs.
    Strictly restricted to 'dev' environments to prevent production data corruption.
    """
    from app.core.config import settings

    if settings.ENVIRONMENT.lower() != "dev":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Resetting demo inquiries is strictly prohibited in non-development environments.",
        )

    from app.core.seeder import build_canonical_sample_inquiries
    from sqlalchemy import delete

    await db.execute(delete(AuditLog))
    await db.execute(delete(Inquiry))
    canonical_items = build_canonical_sample_inquiries()
    db.add_all(canonical_items)
    await db.commit()
    return {"message": "Demo inquiries successfully reset", "total_inquiries": len(canonical_items)}


