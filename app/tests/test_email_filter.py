"""Unit and functional tests for Inbound Email NDR / Delivery Status Notification (Bounce) filtering."""
import pytest
from httpx import AsyncClient
from app.services.email_filter import is_automated_delivery_failure_or_loop


def test_automated_delivery_failure_detection():
    """Verify detection of various RFC-standard bounce and mailer-daemon patterns."""
    # Test 1: Mailer-Daemon sender
    filtered, reason = is_automated_delivery_failure_or_loop(
        sender_email="MAILER-DAEMON@eu-west-1.amazonses.com",
        subject="Delivery Status Notification (Failure)",
        body="An error occurred while trying to deliver the mail to cto@medtech-devices.de",
    )
    assert filtered is True
    assert "Automated sender" in reason or "NDR subject" in reason

    # Test 2: Standard bounce body phrase
    filtered, reason = is_automated_delivery_failure_or_loop(
        sender_email="postmaster@medtech-devices.de",
        subject="Undelivered Mail Returned to Sender",
        body="The following recipient(s) could not be reached: cto@medtech-devices.de",
    )
    assert filtered is True

    # Test 3: RFC 3834 Auto-Submitted header
    filtered, reason = is_automated_delivery_failure_or_loop(
        sender_email="user@example.com",
        subject="Out of Office",
        body="I am out of the office until next week.",
        auto_submitted_header="auto-replied",
    )
    assert filtered is True
    assert "Auto-Submitted" in reason

    # Test 4: Legitimate inquiry should NOT be filtered
    filtered, reason = is_automated_delivery_failure_or_loop(
        sender_email="cto@medtech-devices.de",
        subject="Ultrasound Telemetry Sync Disconnected",
        body="CardioScan 3000 unit fails to sync telemetry payloads. Error code SEC-TLS-ERR-403.",
    )
    assert filtered is False
    assert reason == ""


@pytest.mark.asyncio
async def test_api_rejects_ndr_bounce_inquiry(client: AsyncClient):
    """Verify that POST /api/v1/inquiries/ suppresses automated bounce messages with HTTP 422."""
    bounce_payload = {
        "channel": "EMAIL",
        "customer_email": "MAILER-DAEMON@eu-west-1.amazonses.com",
        "customer_name": "Mail Delivery System",
        "subject": "Delivery Status Notification (Failure)",
        "body": "An error occurred while trying to deliver the mail to the following recipients: cto@medtech-devices.de",
    }
    res = await client.post("/api/v1/inquiries/", json=bounce_payload)
    assert res.status_code == 422
    assert "Automated delivery failure / NDR notification detected" in res.json()["detail"]


@pytest.mark.asyncio
async def test_webhook_filters_ndr_bounce_silently(client: AsyncClient):
    """Verify that POST /api/v1/webhooks/email acknowledges but drops automated bounce messages."""
    bounce_payload = {
        "from": "MAILER-DAEMON@eu-west-1.amazonses.com",
        "name": "Mail Delivery System",
        "subject": "Delivery Status Notification (Failure)",
        "text": "An error occurred while trying to deliver the mail to the following recipients: cto@medtech-devices.de",
    }
    res = await client.post("/api/v1/webhooks/email", json=bounce_payload)
    assert res.status_code == 202
    data = res.json()
    assert data["tracking_id"] == "filtered-ndr-bounce"
    assert "filtered out" in data["message"]


def test_extract_customer_name_from_body_sign_off():
    """Verify that formal body sign-off is inferred over email prefix or generic display name."""
    from app.services.email_filter import extract_customer_name_from_body

    # Case 1: Best regards, Alexander Wright
    body1 = (
        "Hello Support Team,\n"
        "We are currently configuring our production ingress traffic against your API Gateway service.\n"
        "Could you clarify the default rate limits per client IP?\n\n"
        "Best regards,\n"
        "Alexander Wright"
    )
    inferred1 = extract_customer_name_from_body(
        body=body1,
        fallback_name="Fallback Name",
        sender_email="test.customer@example.com",
    )
    assert inferred1 == "Alexander Wright"

    # Case 2: Sincerely, Sarah Connor
    body2 = "Can you help me reset my access?\n\nSincerely,\nSarah Connor"
    inferred2 = extract_customer_name_from_body(
        body=body2,
        fallback_name="sconnor_test",
        sender_email="sconnor@example.com",
    )
    assert inferred2 == "Sarah Connor"

    # Case 3: No sign-off -> fall back to fallback_name
    body3 = "Quick question about invoice #INV-1002."
    inferred3 = extract_customer_name_from_body(
        body=body3,
        fallback_name="Carlos Gomez",
        sender_email="cgomez@example.com",
    )
    assert inferred3 == "Carlos Gomez"

    # Case 4: No sign-off and fallback_name empty -> use sender_email prefix formatted as title
    body4 = "Need assistance."
    inferred4 = extract_customer_name_from_body(
        body=body4,
        fallback_name="",
        sender_email="john.smith@enterprise.com",
    )
    assert inferred4 == "John Smith"

    # Case 5: Inline sign-off without newline (single paragraph / space separated)
    body5 = "...upcoming deployment next week? Best regards, Alexander Wright"
    inferred5 = extract_customer_name_from_body(
        body=body5,
        fallback_name="Fallback Name",
        sender_email="test.customer@example.com",
    )
    assert inferred5 == "Alexander Wright"
