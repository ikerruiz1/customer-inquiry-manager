"""Comprehensive automated tests for SLABreachWatcherDaemon and executive escalation workflows."""
from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inquiry import Inquiry, AuditLog, InquiryMessage
from app.services.sla_breach_watcher import SLABreachWatcherDaemon
from app.services.email_service import get_email_service
from app.services.sns_service import get_sns_service


@pytest.mark.asyncio
async def test_sla_breach_watcher_escalates_overdue_p1_ticket(
    db_session: AsyncSession,
    monkeypatch,
):
    """Verify watcher detects expired P1 ticket, stamps breach flag, dispatches alerts, and writes audit log."""
    now = datetime.now(timezone.utc)
    email_service = get_email_service()
    email_service.outbox.clear()

    inquiry = Inquiry(
        channel="EMAIL",
        customer_email="urgent-customer@enterprise.io",
        customer_name="Urgent Client",
        subject="Production Outage: Payment Gateway Unreachable",
        body="All our production checkouts are failing.",
        status="UNASSIGNED",
        department="TECH_SUPPORT",
        priority="P1",
        urgency=5,
        impact=3,
        sentiment_score=-0.9,
        churn_risk=True,
        entities={"sla_breach_alerted": False},
        sla_deadline_at=now - timedelta(minutes=25),
        created_at=now - timedelta(minutes=55),
    )
    db_session.add(inquiry)
    await db_session.commit()

    daemon = SLABreachWatcherDaemon()
    daemon.manager_email = "ops-manager@company.internal"
    daemon.target_threshold = 95.0

    results = await daemon.audit_breaches_and_compliance(db=db_session)

    assert results["breaches_escalated"] == 1
    assert results["compliance_rate"] == 0.0  # 1 ticket total, 1 breached -> 0.0%
    assert results["executive_alert_triggered"] is True  # 0.0% < 95.0%

    await db_session.refresh(inquiry)
    assert inquiry.entities.get("sla_breach_alerted") is True
    assert "sla_breached_at" in inquiry.entities

    audit_res = await db_session.execute(
        select(AuditLog).where(
            AuditLog.inquiry_id == inquiry.id,
            AuditLog.action == "SLA_BREACH_ESCALATED",
        )
    )
    audit = audit_res.scalar_one_or_none()
    assert audit is not None
    assert audit.agent_id == "SYSTEM:SLA_WATCHER"
    assert audit.reason is not None
    assert "25 minutes overdue" in audit.reason

    msg_res = await db_session.execute(
        select(InquiryMessage).where(
            InquiryMessage.inquiry_id == inquiry.id,
            InquiryMessage.sender_type == "SYSTEM",
        )
    )
    system_msg = msg_res.scalar_one_or_none()
    assert system_msg is not None
    assert "AUTOMATED SLA ESCALATION" in system_msg.body
    assert "exceeded its resolution deadline by 25 minutes" in system_msg.body

    categories = [m.get("category") for m in email_service.outbox]
    assert "SLA_BREACH_ESCALATION" in categories
    assert "COMPLIANCE_THRESHOLD_ALERT" in categories


@pytest.mark.asyncio
async def test_sla_breach_watcher_ignores_paused_sla_tickets(
    db_session: AsyncSession,
    monkeypatch,
):
    """Verify tickets in PENDING_CUSTOMER state (SLA frozen) are never escalated as breached."""
    now = datetime.now(timezone.utc)
    email_service = get_email_service()
    email_service.outbox.clear()

    inquiry = Inquiry(
        channel="WEB_FORM",
        customer_email="waiting-client@saas.com",
        customer_name="Waiting Client",
        subject="Clarification on API response codes",
        body="Please confirm expected status codes for v2 endpoints.",
        status="PENDING_CUSTOMER",
        department="GENERAL",
        priority="P3",
        urgency=2,
        impact=1,
        sentiment_score=0.1,
        churn_risk=False,
        entities={"sla_breach_alerted": False},
        sla_deadline_at=now - timedelta(minutes=10),
        sla_paused_at=now - timedelta(minutes=20),
        created_at=now - timedelta(hours=2),
    )
    db_session.add(inquiry)
    await db_session.commit()

    daemon = SLABreachWatcherDaemon()
    results = await daemon.audit_breaches_and_compliance(db=db_session)

    assert results["breaches_escalated"] == 0
    assert results["compliance_rate"] == 100.0
    assert results["executive_alert_triggered"] is False

    await db_session.refresh(inquiry)
    assert inquiry.entities.get("sla_breach_alerted", False) is False
    assert len(email_service.outbox) == 0


@pytest.mark.asyncio
async def test_sla_breach_watcher_enforces_executive_escalation_cooldown(
    db_session: AsyncSession,
):
    """Verify executive compliance drop alerts respect the 15-minute anti-fatigue cooldown."""
    now = datetime.now(timezone.utc)
    email_service = get_email_service()
    email_service.outbox.clear()

    # Seed 1 healthy ticket and 1 breached ticket (compliance = 50.0% < 95.0%)
    t1 = Inquiry(
        channel="EMAIL",
        customer_email="c1@domain.com",
        customer_name="Customer 1",
        subject="P2 Issue",
        body="Issue description",
        status="UNASSIGNED",
        department="BILLING",
        priority="P2",
        urgency=4,
        impact=2,
        sentiment_score=-0.5,
        churn_risk=False,
        entities={"sla_breach_alerted": True},  # already breached
        sla_deadline_at=now - timedelta(hours=1),
        created_at=now - timedelta(hours=2),
    )
    t2 = Inquiry(
        channel="EMAIL",
        customer_email="c2@domain.com",
        customer_name="Customer 2",
        subject="P3 Normal",
        body="Normal ticket",
        status="UNASSIGNED",
        department="GENERAL",
        priority="P3",
        urgency=2,
        impact=1,
        sentiment_score=0.2,
        churn_risk=False,
        entities={},
        sla_deadline_at=now + timedelta(hours=5),
        created_at=now - timedelta(minutes=10),
    )
    db_session.add_all([t1, t2])
    await db_session.commit()

    daemon = SLABreachWatcherDaemon()
    daemon.cooldown_seconds = 900

    res1 = await daemon.audit_breaches_and_compliance(db=db_session)
    assert res1["compliance_rate"] == 50.0
    assert res1["executive_alert_triggered"] is True
    assert len(email_service.outbox) == 1

    res2 = await daemon.audit_breaches_and_compliance(db=db_session)
    assert res2["compliance_rate"] == 50.0
    assert res2["executive_alert_triggered"] is False
    assert len(email_service.outbox) == 1


@pytest.mark.asyncio
async def test_sla_watcher_triggers_proactive_warning_within_threshold(
    db_session: AsyncSession,
):
    """Verify watcher detects ticket within 10 minutes of breach and dispatches proactive warning."""
    now = datetime.now(timezone.utc)
    email_service = get_email_service()
    email_service.outbox.clear()

    inquiry = Inquiry(
        channel="EMAIL",
        customer_email="vip-partner@enterprise.io",
        customer_name="VIP Partner",
        subject="High Latency on Authentication API",
        body="Authentication latency spiked to 4s.",
        status="UNASSIGNED",
        department="TECH_SUPPORT",
        priority="P2",
        urgency=4,
        impact=2,
        sentiment_score=-0.4,
        churn_risk=False,
        entities={"sla_warning_alerted": False},
        sla_deadline_at=now + timedelta(minutes=8),
        created_at=now - timedelta(minutes=22),
    )
    db_session.add(inquiry)
    await db_session.commit()

    daemon = SLABreachWatcherDaemon()
    daemon.warning_minutes = 10
    results = await daemon.audit_breaches_and_compliance(db=db_session)

    assert results["proactive_warnings_issued"] == 1
    assert results["breaches_escalated"] == 0
    assert results["compliance_rate"] == 100.0  # Still technically in-bounds

    await db_session.refresh(inquiry)
    assert inquiry.entities.get("sla_warning_alerted") is True
    assert "sla_warning_alerted_at" in inquiry.entities

    audit_res = await db_session.execute(
        select(AuditLog).where(
            AuditLog.inquiry_id == inquiry.id,
            AuditLog.action == "SLA_WARNING_TRIGGERED",
        )
    )
    audit = audit_res.scalar_one_or_none()
    assert audit is not None
    assert audit.agent_id == "SYSTEM:SLA_WATCHER"
    assert audit.reason is not None
    assert "impending SLA deadline" in audit.reason

    msg_res = await db_session.execute(
        select(InquiryMessage).where(
            InquiryMessage.inquiry_id == inquiry.id,
            InquiryMessage.sender_type == "SYSTEM",
        )
    )
    msg = msg_res.scalar_one_or_none()
    assert msg is not None
    assert "PROACTIVE SLA WARNING" in msg.body

    assert len(email_service.outbox) == 1
    assert email_service.outbox[0]["category"] == "PROACTIVE_SLA_WARNING"
    assert "SLA Breach Imminent" in email_service.outbox[0]["subject"]

    results2 = await daemon.audit_breaches_and_compliance(db=db_session)
    assert results2["proactive_warnings_issued"] == 0
    assert len(email_service.outbox) == 1


@pytest.mark.asyncio
async def test_operations_audit_sla_lifecycle_endpoint(
    client,
    db_session: AsyncSession,
):
    """Verify the decoupled POST /api/v1/operations/audit-sla-lifecycle endpoint."""
    response = await client.post("/api/v1/operations/audit-sla-lifecycle")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "evaluated_at" in data
    assert "breaches_escalated" in data
    assert "proactive_warnings_issued" in data
    assert "compliance_rate" in data

    invalid_auth_res = await client.post(
        "/api/v1/operations/audit-sla-lifecycle",
        headers={"X-Operational-Token": "bad-token-secret"},
    )
    assert invalid_auth_res.status_code == 401
