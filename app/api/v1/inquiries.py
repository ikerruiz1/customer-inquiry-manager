"""Customer Inquiries and AI-Powered Triage endpoints."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_tier1_agent, require_operations_manager
from app.core.telemetry import emit_emf_metric
from app.models.inquiry import Inquiry, AuditLog
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
)
from app.services.bedrock_service import BedrockService, get_bedrock_service
from app.services.sns_service import SNSService, get_sns_service

logger = logging.getLogger("app.api.v1.inquiries")
router = APIRouter()


def calculate_sla(urgency: int, impact: int, churn_risk: bool) -> tuple[str, datetime]:
    """Compute ITIL priority classification and temporal resolution deadline deterministically."""
    now = datetime.now(timezone.utc)

    # 1. ITIL Matrix Calculation
    if urgency >= 4 and impact >= 3:
        priority = "P1"
        hours = 1
    elif urgency >= 3 and impact >= 2:
        priority = "P2"
        hours = 4
    elif urgency >= 2 and impact >= 1:
        priority = "P3"
        hours = 12
    else:
        priority = "P4"
        hours = 24

    # 2. Churn Risk Priority Escalation Guardrail
    if churn_risk and priority in ["P3", "P4"]:
        logger.info(f"Escalating priority from {priority} to P2 due to high churn risk factor.")
        priority = "P2"
        hours = 4

    deadline = now + timedelta(hours=hours)
    return priority, deadline


async def process_and_persist_inquiry(
    inquiry_in: InquiryCreate,
    db: AsyncSession,
    bedrock: BedrockService,
    sns: SNSService,
) -> Inquiry:
    """Core domain pipeline: Bedrock triage, ITIL SLA calculation, PostgreSQL persistence, and SNS dispatch."""
    # 1. Execute Bedrock single-pass triage
    triage_result = await bedrock.triage_inquiry(
        channel=inquiry_in.channel.value,
        subject=inquiry_in.subject,
        body=inquiry_in.body,
    )

    # 2. Compute ITIL SLA deadline
    priority, sla_deadline = calculate_sla(
        urgency=triage_result.urgency_rating,
        impact=triage_result.impact_rating,
        churn_risk=triage_result.churn_risk,
    )

    # 3. Evaluate Inbound Customer Verification & Identity Policy
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

    # 4. Instantiate and persist ORM model
    inquiry = Inquiry(
        channel=inquiry_in.channel.value,
        customer_email=inquiry_in.customer_email,
        customer_name=inquiry_in.customer_name,
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
    )

    db.add(inquiry)
    await db.flush()
    await db.refresh(inquiry)

    # 4. Asynchronous Outbound SNS Dispatch
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
    if priority in ["P1", "P2"]:
        await sns.publish_ops_alert(inquiry_dict)

    # 5. Emit CloudWatch EMF Metric
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
    stmt = select(Inquiry)

    if status_filter:
        stmt = stmt.where(Inquiry.status == status_filter.value)
    if department:
        stmt = stmt.where(Inquiry.department == department.value)
    if priority:
        stmt = stmt.where(Inquiry.priority == priority.value)

    # Order by ITIL priority, then nearest SLA deadline (Tie-breaking algorithm)
    stmt = stmt.order_by(Inquiry.priority.asc(), Inquiry.sla_deadline_at.asc())

    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_res = await db.execute(count_stmt)
    total = total_res.scalar_one()

    # Pagination
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
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
    """Retrieve a single inquiry by ID with computed SLA countdown."""
    stmt = select(Inquiry).where(Inquiry.id == inquiry_id)
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
        .returning(Inquiry)
    )

    result = await db.execute(stmt)
    updated_inquiry = result.scalar_one_or_none()

    if not updated_inquiry:
        # Check if inquiry exists or was claimed by another agent
        check_stmt = select(Inquiry).where(Inquiry.id == inquiry_id)
        check_res = await db.execute(check_stmt)
        existing = check_res.scalar_one_or_none()
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inquiry not found")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Inquiry is already claimed by agent {existing.assigned_agent_id}",
        )

    # Audit log creation
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

    return updated_inquiry


@router.patch("/{inquiry_id}/resolve", response_model=InquiryResponse)
async def resolve_inquiry(
    inquiry_id: UUID,
    payload: InquiryResolve,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_tier1_agent),
):
    """Human-in-the-Loop ticket resolution: closes inquiry and captures auditor identity."""
    agent_id = current_user.get("sub", "unknown-agent")
    now = datetime.now(timezone.utc)

    stmt = select(Inquiry).where(Inquiry.id == inquiry_id)
    res = await db.execute(stmt)
    inquiry = res.scalar_one_or_none()

    if not inquiry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inquiry not found")

    # Capture previous status before mutating
    prev_status = inquiry.status

    # Update inquiry status and resolution text
    inquiry.status = "RESOLVED"
    inquiry.resolution_text = payload.resolution_text
    inquiry.resolved_at = now
    inquiry.human_reviewed = True

    # Audit log
    audit = AuditLog(
        inquiry_id=inquiry_id,
        agent_id=agent_id,
        action="RESOLVE",
        previous_value={"status": prev_status},
        new_value={"status": "RESOLVED", "resolution_text": payload.resolution_text},
        reason=payload.notes or "Ticket resolved by support agent",
    )
    db.add(audit)
    await db.flush()

    return inquiry


@router.patch("/{inquiry_id}/override", response_model=InquiryResponse)
async def override_inquiry_classification(
    inquiry_id: UUID,
    override_in: InquiryOverride,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_operations_manager),
):
    """MLOps audit log calibration: override AI department or priority classification with audit reasoning."""
    agent_id = current_user.get("sub", "unknown-agent")

    stmt = select(Inquiry).where(Inquiry.id == inquiry_id)
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

    return inquiry


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


