"""Integration and functional tests for Inquiries API and ITIL Triage pipeline."""
import pytest
from datetime import datetime, timezone
from httpx import AsyncClient
from app.api.v1.endpoints.inquiries import calculate_sla


def test_itil_sla_matrix_calculation():
    """Verify ITIL priority calculation matrix and churn escalation rule."""
    now = datetime.now(timezone.utc)

    # P1 Test: Critical Urgency (4) + Critical Impact (3)
    p1_prio, p1_deadline = calculate_sla(urgency=4, impact=3, churn_risk=False)
    assert p1_prio == "P1"
    assert int((p1_deadline - now).total_seconds() / 3600) == 1

    # P2 Test: High Urgency (3) + High Impact (2)
    p2_prio, p2_deadline = calculate_sla(urgency=3, impact=2, churn_risk=False)
    assert p2_prio == "P2"
    assert int((p2_deadline - now).total_seconds() / 3600) == 4

    # P3 Test: Medium Urgency (2) + Low Impact (1)
    p3_prio, p3_deadline = calculate_sla(urgency=2, impact=1, churn_risk=False)
    assert p3_prio == "P3"
    assert int((p3_deadline - now).total_seconds() / 3600) == 12

    # P4 Test: Low Urgency (1) + Low Impact (1)
    p4_prio, p4_deadline = calculate_sla(urgency=1, impact=1, churn_risk=False)
    assert p4_prio == "P4"
    assert int((p4_deadline - now).total_seconds() / 3600) == 24

    # Churn Risk Escalation Guardrail: P3 escalated to P2 due to high churn probability
    escalated_prio, escalated_deadline = calculate_sla(urgency=2, impact=1, churn_risk=True)
    assert escalated_prio == "P2"
    assert int((escalated_deadline - now).total_seconds() / 3600) == 4


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

