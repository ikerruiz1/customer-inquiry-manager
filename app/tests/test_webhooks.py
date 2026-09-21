"""Functional tests for Omnichannel Inbound Webhooks: Asynchronous SQS FIFO Ingestion Gateway."""
import hashlib
import hmac
import json
import pytest
from httpx import AsyncClient
from app.core.config import settings
from app.api.v1.webhooks import verify_hmac_sha256


def test_verify_hmac_sha256_cryptographic_validation():
    """Verify HMAC-SHA256 signature verification helper against tampering."""
    secret = "super-secret-hmac-key"
    payload = b'{"event":"review_created","stars":1}'
    correct_sig = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()

    # Valid signature check
    assert verify_hmac_sha256(secret, payload, correct_sig) is True

    # Tampered payload check
    tampered_payload = b'{"event":"review_created","stars":5}'
    assert verify_hmac_sha256(secret, tampered_payload, correct_sig) is False

    # Tampered signature check
    assert verify_hmac_sha256(secret, payload, "invalid-hex-digest") is False

    # Missing signature check
    assert verify_hmac_sha256(secret, payload, None) is False


@pytest.mark.asyncio
async def test_email_webhook_ingestion(client: AsyncClient):
    """Verify inbound email parsing from AWS SES Inbound Rules buffers into SQS with HTTP 202."""
    email_payload = {
        "from": "marcus.aurelius@rome.org",
        "name": "Marcus Aurelius",
        "subject": "Urgent inquiry regarding subscription tier",
        "text": "We need to clarify enterprise SLA coverage for European datacenters.",
    }
    response = await client.post("/api/v1/webhooks/email", json=email_payload)
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "QUEUED"
    assert data["channel"] == "EMAIL"
    assert "tracking_id" in data
    assert "buffered in Amazon SQS FIFO" in data["message"]


@pytest.mark.asyncio
async def test_webform_webhook_ingestion(client: AsyncClient):
    """Verify customer web form intake buffers into SQS with HTTP 202."""
    webform_payload = {
        "channel": "WEB_FORM",
        "customer_email": "webuser@saas.com",
        "customer_name": "Web User",
        "subject": "Cannot reset MFA token in user profile",
        "body": "The QR code scan times out after 30 seconds on the settings page.",
    }
    response = await client.post("/api/v1/webhooks/webform", json=webform_payload)
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "QUEUED"
    assert data["channel"] == "WEB_FORM"
    assert "tracking_id" in data


@pytest.mark.asyncio
async def test_trustpilot_webhook_hmac_verification(client: AsyncClient, monkeypatch):
    """Verify Trustpilot review webhook with HMAC-SHA256 signature verification and SQS buffering."""
    secret = "trustpilot-shared-secret-key"
    monkeypatch.setattr(settings, "TRUSTPILOT_WEBHOOK_SECRET", secret)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    review_body = {
        "stars": 1,
        "title": "Terrible service downtime",
        "text": "Production API has been unreachable for 4 hours without any status page update!",
        "consumer": {"email": "angry.customer@client.com", "name": "Angry Customer"},
    }
    raw_bytes = json.dumps(review_body).encode("utf-8")
    valid_signature = hmac.new(secret.encode("utf-8"), raw_bytes, hashlib.sha256).hexdigest()

    # 1. Successful request with valid cryptographic signature returns HTTP 202 Accepted
    res_valid = await client.post(
        "/api/v1/webhooks/trustpilot",
        content=raw_bytes,
        headers={"Content-Type": "application/json", "X-Trustpilot-Signature": valid_signature},
    )
    assert res_valid.status_code == 202
    data = res_valid.json()
    assert data["status"] == "QUEUED"
    assert data["channel"] == "TRUSTPILOT"
    assert "tracking_id" in data

    # 2. Rejection with invalid cryptographic signature
    res_invalid = await client.post(
        "/api/v1/webhooks/trustpilot",
        content=raw_bytes,
        headers={"Content-Type": "application/json", "X-Trustpilot-Signature": "invalid_signature_hex"},
    )
    assert res_invalid.status_code == 401
    assert "Invalid Trustpilot signature" in res_invalid.json()["detail"]


@pytest.mark.asyncio
async def test_google_reviews_webhook_secret_verification(client: AsyncClient, monkeypatch):
    """Verify Google Reviews webhook with shared secret header authentication and SQS buffering."""
    secret = "google-reviews-shared-token-xyz"
    monkeypatch.setattr(settings, "GOOGLE_REVIEWS_WEBHOOK_SECRET", secret)
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")

    review_body = {
        "starRating": 1,
        "comment": "Support team never answered our critical escalation ticket.",
        "reviewer": {"displayName": "Anonymous Reviewer", "email": "reviewer@domain.com"},
    }

    # 1. Successful request with valid secret header returns HTTP 202 Accepted
    res_valid = await client.post(
        "/api/v1/webhooks/google-reviews",
        json=review_body,
        headers={"X-Google-Webhook-Secret": secret},
    )
    assert res_valid.status_code == 202
    data = res_valid.json()
    assert data["status"] == "QUEUED"
    assert data["channel"] == "GOOGLE_REVIEWS"
    assert "tracking_id" in data

    # 2. Rejection with invalid secret header
    res_invalid = await client.post(
        "/api/v1/webhooks/google-reviews",
        json=review_body,
        headers={"X-Google-Webhook-Secret": "wrong-secret-token"},
    )
    assert res_invalid.status_code == 401
    assert "Invalid Google Reviews secret" in res_invalid.json()["detail"]


@pytest.mark.asyncio
async def test_stripe_billing_webhook_ingestion(client: AsyncClient):
    """Verify high-priority financial dispute webhook from Stripe enqueues with HTTP 202 Accepted."""
    stripe_payload = {
        "type": "charge.dispute.created",
        "data": {
            "object": {
                "id": "dp_1N9xZ82eZvKYlo2C",
                "amount": 49900,  # 499.00 EUR
                "currency": "eur",
                "reason": "fraudulent",
                "billing_details": {"email": "victim@bankcard.com"},
            }
        },
    }
    response = await client.post("/api/v1/webhooks/billing", json=stripe_payload)
    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "QUEUED"
    assert data["channel"] == "BILLING"
    assert "tracking_id" in data


@pytest.mark.asyncio
async def test_stripe_billing_webhook_signature_rejection_in_prod(client: AsyncClient):
    """Verify unsigned or invalid Stripe webhook signatures are rejected with HTTP 401 in non-dev."""
    import hashlib
    import hmac
    import json
    import time
    from app.core.config import settings

    old_env = settings.ENVIRONMENT
    try:
        settings.ENVIRONMENT = "prod"
        payload = {"type": "charge.dispute.created", "data": {"object": {"id": "dp_test"}}}
        raw_body = json.dumps(payload).encode("utf-8")

        # 1. Missing signature header
        res_missing = await client.post("/api/v1/webhooks/billing", content=raw_body, headers={"Content-Type": "application/json"})
        assert res_missing.status_code == 401

        # 2. Invalid signature header
        res_invalid = await client.post(
            "/api/v1/webhooks/billing",
            content=raw_body,
            headers={"Content-Type": "application/json", "Stripe-Signature": "t=12345,v1=invalid_signature"},
        )
        assert res_invalid.status_code == 401

        # 3. Valid signature header
        timestamp = str(int(time.time()))
        signed_payload = f"{timestamp}.".encode("utf-8") + raw_body
        secret = settings.STRIPE_WEBHOOK_SECRET or "dev-stripe-webhook-secret"
        computed_sig = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
        valid_header = f"t={timestamp},v1={computed_sig}"

        res_valid = await client.post(
            "/api/v1/webhooks/billing",
            content=raw_body,
            headers={"Content-Type": "application/json", "Stripe-Signature": valid_header},
        )
        assert res_valid.status_code == 202

        # 4. Webhook replay attack: valid signature but expired timestamp (> 300s old)
        stale_timestamp = str(int(time.time()) - 600)  # 10 minutes old
        stale_payload = f"{stale_timestamp}.".encode("utf-8") + raw_body
        stale_sig = hmac.new(secret.encode("utf-8"), stale_payload, hashlib.sha256).hexdigest()
        stale_header = f"t={stale_timestamp},v1={stale_sig}"

        res_replay = await client.post(
            "/api/v1/webhooks/billing",
            content=raw_body,
            headers={"Content-Type": "application/json", "Stripe-Signature": stale_header},
        )
        assert res_replay.status_code == 401
    finally:
        settings.ENVIRONMENT = old_env

