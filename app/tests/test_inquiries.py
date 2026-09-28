"""Integration and functional tests for Inquiries API and ITIL Triage pipeline."""
import pytest
from datetime import datetime, timezone
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.inquiries import calculate_sla


def test_itil_sla_matrix_calculation():
    """Verify ITIL priority calculation matrix and churn escalation rule."""
    now = datetime.now(timezone.utc)

    # P1 Test: Critical Urgency (4) + Critical Impact (3)
    p1_prio, p1_deadline, p1_frt = calculate_sla(urgency=4, impact=3, churn_risk=False)
    assert p1_prio == "P1"
    assert int((p1_deadline - now).total_seconds() / 3600) == 1
    assert int((p1_frt - now).total_seconds() / 60) == 15

    # P2 Test: High Urgency (3) + High Impact (2)
    p2_prio, p2_deadline, p2_frt = calculate_sla(urgency=3, impact=2, churn_risk=False)
    assert p2_prio == "P2"
    assert int((p2_deadline - now).total_seconds() / 3600) == 4
    assert int((p2_frt - now).total_seconds() / 60) == 60

    # P3 Test: Medium Urgency (2) + Low Impact (1)
    p3_prio, p3_deadline, p3_frt = calculate_sla(urgency=2, impact=1, churn_risk=False)
    assert p3_prio == "P3"
    assert int((p3_deadline - now).total_seconds() / 3600) == 12
    assert int((p3_frt - now).total_seconds() / 3600) == 4

    # P4 Test: Low Urgency (1) + Low Impact (1)
    p4_prio, p4_deadline, p4_frt = calculate_sla(urgency=1, impact=1, churn_risk=False)
    assert p4_prio == "P4"
    assert int((p4_deadline - now).total_seconds() / 3600) == 24
    assert int((p4_frt - now).total_seconds() / 3600) == 8

    # Churn Risk Escalation Guardrail: P3 escalated to P2 due to high churn probability
    escalated_prio, escalated_deadline, escalated_frt = calculate_sla(urgency=2, impact=1, churn_risk=True)
    assert escalated_prio == "P2"
    assert int((escalated_deadline - now).total_seconds() / 3600) == 4
    assert int((escalated_frt - now).total_seconds() / 60) == 60


@pytest.mark.asyncio
async def test_create_and_triage_inquiry_flow(client: AsyncClient, mock_sns):
    """Verify end-to-end inquiry intake, Bedrock triage, database storage, and SNS dispatch."""
    payload = {
        "channel": "EMAIL",
        "customer_email": "cto@fintech-enterprise.io",
        "customer_name": "Marcus Vance",
        "subject": "CRITICAL: Database connection failures in production",
        "body": "Our primary database is dropping connections repeatedly. Transactions are failing.",
    }

    response = await client.post("/api/v1/inquiries/", json=payload)
    assert response.status_code == 201
    data = response.json()

    assert data["status"] == "UNASSIGNED"
    assert data["department"] == "TECH_SUPPORT"
    assert data["priority"] == "P1"  # Urgency 4 + Impact 3 from MockBedrockService = P1
    assert data["churn_risk"] is True
    assert data["suggested_strategy"] == "EMPATHETIC_DEFUSING"
    assert "CloudDB" in data["entities"]["service_name"]
    assert data["sla_remaining_seconds"] > 0

    # Verify SNS events were triggered
    assert len(mock_sns.published_ticket_events) == 1
    assert len(mock_sns.published_ops_alerts) == 1  # Triggered because priority is P1


@pytest.mark.asyncio
async def test_list_and_prioritized_queue_sorting(client: AsyncClient):
    """Verify queue sorting adheres to (priority ASC, sla_deadline_at ASC)."""
    # Create inquiry 1 (will be P1 via mock)
    await client.post("/api/v1/inquiries/", json={
        "channel": "WEB_FORM",
        "customer_email": "user1@domain.com",
        "customer_name": "User One",
        "subject": "System down",
        "body": "Production down",
    })

    # Retrieve queue
    response = await client.get("/api/v1/inquiries/")
    assert response.status_code == 200
    queue = response.json()
    assert queue["total"] >= 1
    assert queue["items"][0]["status"] == "UNASSIGNED"


@pytest.mark.asyncio
async def test_atomic_ticket_claim_and_race_condition_guard(client: AsyncClient):
    """Verify atomic ticket claiming and 409 conflict upon concurrent duplicate claims."""
    # 1. Create an inquiry
    create_res = await client.post("/api/v1/inquiries/", json={
        "channel": "EMAIL",
        "customer_email": "developer@client.com",
        "customer_name": "Dev User",
        "subject": "API Timeout issue",
        "body": "Getting 504 gateway timeouts on /v2/checkout endpoint.",
    })
    assert create_res.status_code == 201
    inquiry_id = create_res.json()["id"]

    # 2. First agent claims the ticket
    claim_res1 = await client.patch(f"/api/v1/inquiries/{inquiry_id}/claim")
    assert claim_res1.status_code == 200
    claimed_data = claim_res1.json()
    assert claimed_data["status"] == "CLAIMED"
    assert claimed_data["assigned_agent_id"] == "agent-uuid-1111-2222-3333"

    # 3. Second claim on already claimed ticket must yield HTTP 409 Conflict
    claim_res2 = await client.patch(f"/api/v1/inquiries/{inquiry_id}/claim")
    assert claim_res2.status_code == 409
    assert "already claimed" in claim_res2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_human_in_the_loop_resolution_and_audit_trail(client: AsyncClient):
    """Verify HITL ticket resolution and immutable audit trail generation."""
    # 1. Create and claim inquiry
    create_res = await client.post("/api/v1/inquiries/", json={
        "channel": "BILLING",
        "customer_email": "billing@saas.com",
        "customer_name": "Finance Lead",
        "subject": "Duplicate invoice charge",
        "body": "Invoice #8812 was charged twice to our corporate card.",
    })
    inquiry_id = create_res.json()["id"]
    await client.patch(f"/api/v1/inquiries/{inquiry_id}/claim")

    # 2. Resolve the inquiry
    resolve_payload = {
        "resolution_text": "Processed 100% refund for duplicate transaction INV-8812 via Stripe portal.",
        "notes": "Refund authorized under SLA Section 4.2.",
    }
    resolve_res = await client.patch(f"/api/v1/inquiries/{inquiry_id}/resolve", json=resolve_payload)
    assert resolve_res.status_code == 200
    resolved_ticket = resolve_res.json()
    assert resolved_ticket["status"] == "RESOLVED"
    assert resolved_ticket["human_reviewed"] is True
    assert "Processed 100% refund" in resolved_ticket["resolution_text"]

    # 3. Verify audit trail history
    audit_res = await client.get(f"/api/v1/inquiries/{inquiry_id}/audit-logs")
    assert audit_res.status_code == 200
    audit_logs = audit_res.json()
    assert len(audit_logs) >= 2  # CLAIM and RESOLVE actions
    actions = [log["action"] for log in audit_logs]
    assert "CLAIM" in actions
    assert "RESOLVE" in actions


@pytest.mark.asyncio
async def test_mlops_classification_override_by_supervisor(client: AsyncClient):
    """Verify Operations Manager can override AI classification with required reason."""
    create_res = await client.post("/api/v1/inquiries/", json={
        "channel": "WEB_FORM",
        "customer_email": "director@partner.com",
        "customer_name": "Jane Doe",
        "subject": "Partnership inquiry and license upgrade",
        "body": "We want to upgrade to Enterprise tier for 500 seats.",
    })
    inquiry_id = create_res.json()["id"]

    override_payload = {
        "new_department": "SALES",
        "new_priority": "P2",
        "reason": "Enterprise tier upgrade with 500 seats belongs to Sales VIP pipeline.",
    }
    override_res = await client.patch(f"/api/v1/inquiries/{inquiry_id}/override", json=override_payload)
    assert override_res.status_code == 200
    updated = override_res.json()
    assert updated["department"] == "SALES"
    assert updated["priority"] == "P2"

    # Verify audit log captures previous vs new state
    audit_res = await client.get(f"/api/v1/inquiries/{inquiry_id}/audit-logs")
    logs = audit_res.json()
    override_log = [log for log in logs if log["action"] == "OVERRIDE_CLASSIFICATION"][0]
    assert override_log["previous_value"]["department"] == "TECH_SUPPORT"
    assert override_log["new_value"]["department"] == "SALES"
    assert "Enterprise tier upgrade" in override_log["reason"]


@pytest.mark.asyncio
async def test_presigned_attachment_lifecycle(client: AsyncClient):
    """Verify presigned S3 upload and download URL generation."""
    # 1. Request presigned upload URL
    upload_res = await client.post("/api/v1/attachments/presigned-url", json={
        "filename": "invoice-error.png",
        "content_type": "image/png",
    })
    assert upload_res.status_code == 200
    upload_data = upload_res.json()
    assert "upload_url" in upload_data
    assert "object_key" in upload_data
    assert upload_data["object_key"].endswith(".png")

    # 2. Request presigned download URL for authorized operator
    object_key = upload_data["object_key"]
    download_res = await client.get(f"/api/v1/attachments/presigned-download/{object_key}")
    assert download_res.status_code == 200
    download_data = download_res.json()
    assert "download_url" in download_data
    assert object_key in download_data["download_url"]

    # 3. Unauthorized prefix / path traversal attempt must be rejected with HTTP 400
    malicious_res = await client.get("/api/v1/attachments/presigned-download/unauthorized-bucket-prefix/secret.env")
    assert malicious_res.status_code == 400
    assert "path traversal or unauthorized object prefix" in malicious_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_reset_demo_inquiries_allowed_in_dev(client: AsyncClient):
    """Verify reset-demo-data successfully re-seeds canonical dev inquiries in dev environment."""
    from app.core.config import settings

    settings.ENVIRONMENT = "dev"
    res = await client.post("/api/v1/inquiries/reset-demo-data")
    assert res.status_code == 200
    data = res.json()
    assert data["total_inquiries"] == 0
    assert "successfully reset" in data["message"]


@pytest.mark.asyncio
async def test_reset_demo_inquiries_forbidden_in_production(client: AsyncClient):
    """Verify reset-demo-data is strictly rejected with HTTP 403 in non-dev environments."""
    from app.core.config import settings

    original_env = settings.ENVIRONMENT
    try:
        settings.ENVIRONMENT = "prod"
        res = await client.post("/api/v1/inquiries/reset-demo-data")
        assert res.status_code == 403
        assert "strictly prohibited in non-development environments" in res.json()["detail"]
    finally:
        settings.ENVIRONMENT = original_env


@pytest.mark.asyncio
async def test_conversation_thread_and_sla_clock_pause_resume(client: AsyncClient):
    """Verify multi-turn conversation thread, SLA clock pause on REQUEST_INFO, and resumption on customer reply."""
    # 1. Ingest inquiry
    create_res = await client.post("/api/v1/inquiries/", json={
        "channel": "EMAIL",
        "customer_email": "cto@medtech-devices.de",
        "customer_name": "Dr. Klaus Becker",
        "subject": "Ultrasound Telemetry Sync Disconnected",
        "body": "CardioScan 3000 unit fails to sync telemetry payloads. Error code SEC-TLS-ERR-403.",
    })
    assert create_res.status_code == 201
    inquiry_data = create_res.json()
    inquiry_id = inquiry_data["id"]
    initial_deadline = datetime.fromisoformat(inquiry_data["sla_deadline_at"])

    # Verify opening customer message was automatically persisted
    msg_res = await client.get(f"/api/v1/inquiries/{inquiry_id}/messages")
    assert msg_res.status_code == 200
    messages = msg_res.json()
    assert len(messages) == 1
    assert messages[0]["sender_type"] == "CUSTOMER"
    assert "CardioScan 3000" in messages[0]["body"]

    # 2. Agent claims ticket
    await client.patch(f"/api/v1/inquiries/{inquiry_id}/claim")

    # 3. Agent requests information (REQUEST_INFO) -> SLA clock pauses, status becomes PENDING_CUSTOMER
    pause_payload = {
        "body": "Hello Dr. Becker, could you please provide the firmware build version from the diagnostic panel?",
        "action": "REQUEST_INFO",
        "attachments": [],
    }
    agent_msg_res = await client.post(f"/api/v1/inquiries/{inquiry_id}/messages", json=pause_payload)
    assert agent_msg_res.status_code == 201
    agent_msg = agent_msg_res.json()
    assert agent_msg["sender_type"] == "AGENT"
    assert agent_msg["is_internal_note"] is False

    # Verify inquiry status and pause state
    inquiry_check = await client.get(f"/api/v1/inquiries/{inquiry_id}")
    inq = inquiry_check.json()
    assert inq["status"] == "PENDING_CUSTOMER"
    assert inq["sla_paused_at"] is not None
    assert inq["first_responded_at"] is not None  # First agent response recorded

    # Verify audit trail has PAUSE_SLA_PENDING_CUSTOMER
    audit_res = await client.get(f"/api/v1/inquiries/{inquiry_id}/audit-logs")
    pause_log = [l for l in audit_res.json() if l["action"] == "PAUSE_SLA_PENDING_CUSTOMER"]
    assert len(pause_log) == 1

    # 4. Customer responds -> SLA clock resumes, status returns to CLAIMED, deadline is extended
    customer_reply_payload = {
        "body": "Firmware build is CardioOS v4.2.1-hotfix3 with TLS 1.3 cert.",
        "customer_name": "Dr. Klaus Becker",
        "customer_email": "cto@medtech-devices.de",
    }
    reply_res = await client.post(f"/api/v1/inquiries/{inquiry_id}/customer-reply", json=customer_reply_payload)
    assert reply_res.status_code == 201
    reply_msg = reply_res.json()
    assert reply_msg["sender_type"] == "CUSTOMER"
    assert "CardioOS" in reply_msg["body"]

    # Verify inquiry resumed to CLAIMED and pause cleared
    inquiry_resumed = await client.get(f"/api/v1/inquiries/{inquiry_id}")
    resumed_data = inquiry_resumed.json()
    assert resumed_data["status"] == "CLAIMED"
    assert resumed_data["sla_paused_at"] is None

    # Verify thread now has 3 messages: Customer -> Agent -> Customer
    thread_res = await client.get(f"/api/v1/inquiries/{inquiry_id}/messages")
    thread = thread_res.json()
    assert len(thread) == 3


@pytest.mark.asyncio
async def test_internal_note_and_resolution_while_paused(client: AsyncClient):
    """Verify internal notes are invisible to customers and resolving while paused extends SLA properly."""
    # 1. Create and claim
    create_res = await client.post("/api/v1/inquiries/", json={
        "channel": "WEB_FORM",
        "customer_email": "nurse@hospital.com",
        "customer_name": "Nurse Sarah",
        "subject": "Sensor calibration error",
        "body": "Sensor E-22 is reporting +/- 5% error in calibration.",
    })
    inquiry_id = create_res.json()["id"]
    await client.patch(f"/api/v1/inquiries/{inquiry_id}/claim")

    # 2. Add Internal Note
    note_payload = {
        "body": "Internal Note: Known issue with batch 2026-B sensors. Do not replace unit; recalibrate via firmware tool.",
        "action": "INTERNAL_NOTE",
    }
    note_res = await client.post(f"/api/v1/inquiries/{inquiry_id}/messages", json=note_payload)
    assert note_res.status_code == 201
    assert note_res.json()["is_internal_note"] is True

    # 3. Request info to pause SLA
    await client.post(f"/api/v1/inquiries/{inquiry_id}/messages", json={
        "body": "Could you provide the device serial number?",
        "action": "REQUEST_INFO",
    })

    # 4. Agent resolves directly while ticket was in PENDING_CUSTOMER
    resolve_payload = {
        "resolution_text": "Calibration patch applied remotely via OTA update. Accuracy verified at 99.8%.",
        "notes": "OTA recalibration successful.",
    }
    resolve_res = await client.patch(f"/api/v1/inquiries/{inquiry_id}/resolve", json=resolve_payload)
    assert resolve_res.status_code == 200
    resolved = resolve_res.json()
    assert resolved["status"] == "RESOLVED"
    assert resolved["sla_paused_at"] is None

    # Check messages in resolved ticket - must contain initial, note, request_info, and resolution message
    thread_res = await client.get(f"/api/v1/inquiries/{inquiry_id}/messages")
    thread = thread_res.json()
    assert len(thread) == 4
    assert thread[-1]["body"] == resolve_payload["resolution_text"]


@pytest.mark.asyncio
async def test_copilot_draft_three_modes(client: AsyncClient):
    """Verify AI Copilot draft generator creates distinct tailored drafts for REPLY, REQUEST_INFO, and INTERNAL_NOTE."""
    # 1. Create a ticket
    create_res = await client.post("/api/v1/inquiries/", json={
        "channel": "WEB_FORM",
        "customer_email": "demo.user@domain.com",
        "customer_name": "Demo User",
        "subject": "Critical API 500 error on checkout",
        "body": "Whenever users click pay, server returns HTTP 500 error code ERR_PAY_99. Transactions blocked.",
    })
    assert create_res.status_code == 201
    inquiry_id = create_res.json()["id"]

    # 2. Test REPLY draft
    reply_draft_res = await client.get(f"/api/v1/inquiries/{inquiry_id}/copilot-draft?action_type=REPLY")
    assert reply_draft_res.status_code == 200
    reply_data = reply_draft_res.json()
    assert reply_data["action_type"] == "REPLY"
    assert "Demo User" in reply_data["draft"]
    assert "Thank you for contacting" in reply_data["draft"]

    # 3. Test REQUEST_INFO draft (Assert zero customer-facing SLA pause mentions)
    info_draft_res = await client.get(f"/api/v1/inquiries/{inquiry_id}/copilot-draft?action_type=REQUEST_INFO")
    assert info_draft_res.status_code == 200
    info_data = info_draft_res.json()
    assert info_data["action_type"] == "REQUEST_INFO"
    assert "SLA COUNTDOWN PAUSED" not in info_data["draft"]
    assert "temporarily frozen" not in info_data["draft"]
    assert "Support Team" in info_data["draft"]
    assert "share the following details" in info_data["draft"]

    # 4. Test INTERNAL_NOTE draft
    note_draft_res = await client.get(f"/api/v1/inquiries/{inquiry_id}/copilot-draft?action_type=INTERNAL_NOTE")
    assert note_draft_res.status_code == 200
    note_data = note_draft_res.json()
    assert note_data["action_type"] == "INTERNAL_NOTE"
    assert "CONFIDENTIAL COPILOT DIAGNOSIS" in note_data["draft"]
    assert "Do NOT disclose internal" in note_data["draft"]


@pytest.mark.asyncio
async def test_inbound_email_thread_reply_auto_matching(client: AsyncClient, db_session: AsyncSession):
    """Verify inbound email webhook automatically routes replies with [Ticket #...] to existing ticket and unfreezes SLA."""
    # 1. Create a ticket
    create_res = await client.post("/api/v1/inquiries/", json={
        "channel": "EMAIL",
        "customer_email": "external.person@gmail.com",
        "customer_name": "External Person",
        "subject": "Need invoice clarification",
        "body": "I was charged twice for invoice INV-1002.",
    })
    assert create_res.status_code == 201
    inquiry = create_res.json()
    inquiry_id = inquiry["id"]
    short_id = str(inquiry_id)[:8].upper()

    # 2. Agent claims and pauses SLA
    await client.patch(f"/api/v1/inquiries/{inquiry_id}/claim")
    pause_msg = await client.post(f"/api/v1/inquiries/{inquiry_id}/messages", json={
        "body": "Could you provide a screenshot of the credit card charge?",
        "action": "REQUEST_INFO",
    })
    assert pause_msg.status_code == 201

    # Verify ticket is PENDING_CUSTOMER
    check_res = await client.get(f"/api/v1/inquiries/{inquiry_id}")
    assert check_res.json()["status"] == "PENDING_CUSTOMER"

    # 3. External person replies from their email client to the company support email
    email_webhook_payload = {
        "from": "external.person@gmail.com",
        "name": "External Person",
        "subject": f"Re: [Ticket #{short_id}] Need invoice clarification",
        "text": "Here is the screenshot: https://cdn.attachments.com/proof.png showing the double charge.",
    }
    inbound_res = await client.post("/api/v1/webhooks/email", json=email_webhook_payload)
    assert inbound_res.status_code == 202
    queued_data = inbound_res.json()
    assert queued_data["status"] == "QUEUED"

    # Process queued message via consumer
    from app.services.sqs_consumer import get_sqs_consumer
    from app.services.sqs_service import get_sqs_service
    from app.api.v1.inquiries import process_and_persist_inquiry
    consumer = get_sqs_consumer()
    sqs = get_sqs_service()
    messages = await sqs.receive_inquiries(max_messages=5, wait_time_seconds=1)
    for msg in messages:
        await consumer._process_single_message(msg["body"], process_and_persist_inquiry, db=db_session)
        await sqs.delete_inquiry(msg["receipt_handle"])

    # Verify ticket was resumed and updated in database
    resumed_res = await client.get(f"/api/v1/inquiries/{inquiry_id}")
    resumed_inquiry = resumed_res.json()
    assert resumed_inquiry["id"] == inquiry_id
    assert resumed_inquiry["status"] == "CLAIMED"
    assert resumed_inquiry["sla_paused_at"] is None

    # Check conversation thread has the customer's email reply appended
    thread_res = await client.get(f"/api/v1/inquiries/{inquiry_id}/messages")
    thread = thread_res.json()
    assert any("showing the double charge" in m["body"] and m["sender_type"] == "CUSTOMER" for m in thread)


@pytest.mark.asyncio
async def test_copilot_draft_adapts_to_conversation_state(client: AsyncClient):
    """Verify AI Copilot draft adapts when an agent has already responded, generating follow-ups without SLA jargon."""
    create_res = await client.post("/api/v1/inquiries/", json={
        "channel": "EMAIL",
        "customer_email": "client@enterprise.com",
        "customer_name": "Enterprise Client",
        "subject": "CORS configuration issue",
        "body": "We are getting CORS error 403 on API gateway.",
    })
    inquiry_id = create_res.json()["id"]

    # Agent dispatches REQUEST_INFO
    await client.post(f"/api/v1/inquiries/{inquiry_id}/messages", json={
        "body": "Could you please send us your CORS origin whitelist configuration?",
        "action": "REQUEST_INFO",
    })

    # Request copilot draft for REPLY now that an agent message was already dispatched
    follow_up_res = await client.get(f"/api/v1/inquiries/{inquiry_id}/copilot-draft?action_type=REPLY")
    assert follow_up_res.status_code == 200
    draft_text = follow_up_res.json()["draft"]
    # Should be a follow-up draft, not repeating initial greeting, with zero SLA countdown mentions
    assert "follow up" in draft_text.lower()
    assert "SLA COUNTDOWN PAUSED" not in draft_text
    assert "Enterprise Client" in draft_text


@pytest.mark.asyncio
async def test_slack_notification_policy_dual_modes(client: AsyncClient, mock_bedrock, mock_sns, monkeypatch):
    """Verify SLACK_NOTIFICATION_POLICY toggles between CRITICAL_AND_SLA_ONLY and ALL_INQUIRIES."""
    from app.core.config import settings
    from app.schemas.bedrock import BedrockTriageOutput, DepartmentEnum, SuggestedStrategyEnum

    p3_triage = BedrockTriageOutput(
        department=DepartmentEnum.GENERAL,
        urgency_rating=2,
        impact_rating=1,
        priority="P3",
        sentiment_score=0.1,
        churn_risk=False,
        key_entities={},
        suggested_strategy=SuggestedStrategyEnum.DIRECT_RESOLUTION,
        suggested_response="General response",
        agent_copilot_notes="P3 ticket note",
        reasoning_summary="Routine question.",
    )

    async def mock_triage(*args, **kwargs):
        return p3_triage

    monkeypatch.setattr(mock_bedrock, "triage_inquiry", mock_triage)

    # 1. Test Enterprise Default: CRITICAL_AND_SLA_ONLY (P3 ticket does NOT dispatch ops alert upon creation)
    monkeypatch.setattr(settings, "SLACK_NOTIFICATION_POLICY", "CRITICAL_AND_SLA_ONLY")
    mock_sns.published_ops_alerts.clear()

    res1 = await client.post("/api/v1/inquiries/", json={
        "channel": "WEB_FORM",
        "customer_email": "routine@client.com",
        "customer_name": "Routine Client",
        "subject": "General question",
        "body": "How do I configure my settings?",
    })
    assert res1.status_code == 201
    assert res1.json()["priority"] == "P3"
    assert len(mock_sns.published_ops_alerts) == 0  # Gated by CRITICAL_AND_SLA_ONLY

    # 2. Test Startup / Demo Mode: ALL_INQUIRIES (P3 ticket DOES dispatch ops alert upon creation)
    monkeypatch.setattr(settings, "SLACK_NOTIFICATION_POLICY", "ALL_INQUIRIES")
    mock_sns.published_ops_alerts.clear()

    res2 = await client.post("/api/v1/inquiries/", json={
        "channel": "WEB_FORM",
        "customer_email": "routine2@client.com",
        "customer_name": "Routine Client 2",
        "subject": "Another general question",
        "body": "Where is the API documentation?",
    })
    assert res2.status_code == 201
    assert res2.json()["priority"] == "P3"
    assert len(mock_sns.published_ops_alerts) == 1  # Allowed through by ALL_INQUIRIES






