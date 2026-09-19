"""Enterprise Inbound Omnichannel Webhooks: Asynchronous SQS FIFO Ingestion Gateway."""
import hashlib
import hmac
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status

from app.core.config import settings
from app.schemas.inquiry import InquiryCreate, InquiryQueuedResponse, ChannelEnum
from app.services.sqs_service import SQSService, get_sqs_service

logger = logging.getLogger("app.api.v1.webhooks")
router = APIRouter()


def verify_hmac_sha256(secret: str, body_bytes: bytes, signature_header: Optional[str]) -> bool:
    """Cryptographic verification of HMAC-SHA256 webhook signatures."""
    if not secret:
        return True  # If no secret configured (local dev mode), permit execution
    if not signature_header:
        return False
    computed_signature = hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()
    return hmac.compare_digest(computed_signature, signature_header)


@router.post("/email", response_model=InquiryQueuedResponse, status_code=status.HTTP_202_ACCEPTED)
async def inbound_email_webhook(
    payload: Dict[str, Any],
    sqs: SQSService = Depends(get_sqs_service),
):
    """Inbound email parser receiving webhooks from AWS SES Inbound Rules or SendGrid Inbound Parse.

    Buffers the raw incoming message payload into Amazon SQS FIFO in < 15ms.
    """
    sender_email = payload.get("from") or payload.get("envelope", {}).get("from") or "anonymous@customer.com"
    subject = payload.get("subject") or "Support Request via Email"
    body = payload.get("text") or payload.get("html") or payload.get("body") or ""

    inquiry_payload = {
        "channel": ChannelEnum.EMAIL.value,
        "customer_email": sender_email if "@" in sender_email else "user@customer.com",
        "customer_name": payload.get("name") or sender_email.split("@")[0],
        "subject": subject,
        "body": body or "No message content provided in email body.",
    }

    tracking_id = await sqs.send_inquiry(inquiry_payload, group_id="email")

    return InquiryQueuedResponse(
        channel=ChannelEnum.EMAIL,
        tracking_id=tracking_id,
        message="Inbound email successfully buffered in Amazon SQS FIFO for AI triage.",
    )


@router.post("/webform", response_model=InquiryQueuedResponse, status_code=status.HTTP_202_ACCEPTED)
async def inbound_webform_webhook(
    inquiry_in: InquiryCreate,
    sqs: SQSService = Depends(get_sqs_service),
):
    """Customer portal web contact form inquiry intake."""
    inquiry_payload = inquiry_in.model_dump(mode="json")
    tracking_id = await sqs.send_inquiry(inquiry_payload, group_id="webform")

    return InquiryQueuedResponse(
        channel=inquiry_in.channel,
        tracking_id=tracking_id,
        message="Web contact form inquiry successfully buffered in Amazon SQS FIFO for AI triage.",
    )


@router.post("/trustpilot", response_model=InquiryQueuedResponse, status_code=status.HTTP_202_ACCEPTED)
async def inbound_trustpilot_webhook(
    request: Request,
    x_trustpilot_signature: Optional[str] = Header(None, alias="X-Trustpilot-Signature"),
    sqs: SQSService = Depends(get_sqs_service),
):
    """Trustpilot public review webhook with cryptographic HMAC-SHA256 signature verification."""
    body_bytes = await request.body()

    # Cryptographic signature validation
    if settings.TRUSTPILOT_WEBHOOK_SECRET and settings.ENVIRONMENT != "dev":
        if not verify_hmac_sha256(settings.TRUSTPILOT_WEBHOOK_SECRET, body_bytes, x_trustpilot_signature):
            logger.warning("Invalid X-Trustpilot-Signature received on Trustpilot webhook endpoint.")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Trustpilot signature")

    payload = await request.json()
    stars = payload.get("stars", 1)
    review_title = payload.get("title") or f"Trustpilot {stars}-Star Public Review"
    review_text = payload.get("text") or payload.get("content") or ""
    author_email = payload.get("consumer", {}).get("email") or "reviewer@trustpilot-user.com"
    author_name = payload.get("consumer", {}).get("name") or "Trustpilot Reviewer"

    inquiry_payload = {
        "channel": ChannelEnum.TRUSTPILOT.value,
        "customer_email": author_email,
        "customer_name": author_name,
        "subject": f"[{stars}★ Trustpilot] {review_title}",
        "body": review_text or "No review text provided.",
    }

    tracking_id = await sqs.send_inquiry(inquiry_payload, group_id="trustpilot")

    return InquiryQueuedResponse(
        channel=ChannelEnum.TRUSTPILOT,
        tracking_id=tracking_id,
        message="Trustpilot review successfully buffered in Amazon SQS FIFO for AI triage.",
    )


@router.post("/google-reviews", response_model=InquiryQueuedResponse, status_code=status.HTTP_202_ACCEPTED)
async def inbound_google_reviews_webhook(
    request: Request,
    x_google_webhook_secret: Optional[str] = Header(None, alias="X-Google-Webhook-Secret"),
    sqs: SQSService = Depends(get_sqs_service),
):
    """Google Reviews webhook with shared secret header verification."""
    if settings.GOOGLE_REVIEWS_WEBHOOK_SECRET and settings.ENVIRONMENT != "dev":
        if x_google_webhook_secret != settings.GOOGLE_REVIEWS_WEBHOOK_SECRET:
            logger.warning("Unauthorized X-Google-Webhook-Secret received on Google Reviews endpoint.")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google Reviews secret")

    payload = await request.json()
    star_rating = payload.get("starRating") or payload.get("stars") or 1
    comment = payload.get("comment") or payload.get("text") or "Negative Google Review posted"
    reviewer_name = payload.get("reviewer", {}).get("displayName") or "Google Customer"
    reviewer_email = payload.get("reviewer", {}).get("email") or "reviewer@google-customer.com"

    inquiry_payload = {
        "channel": ChannelEnum.GOOGLE_REVIEWS.value,
        "customer_email": reviewer_email,
        "customer_name": reviewer_name,
        "subject": f"[{star_rating}★ Google Review] {reviewer_name}",
        "body": comment,
    }

    tracking_id = await sqs.send_inquiry(inquiry_payload, group_id="google-reviews")

    return InquiryQueuedResponse(
        channel=ChannelEnum.GOOGLE_REVIEWS,
        tracking_id=tracking_id,
        message="Google Review successfully buffered in Amazon SQS FIFO for AI triage.",
    )


@router.post("/billing", response_model=InquiryQueuedResponse, status_code=status.HTTP_202_ACCEPTED)
async def inbound_stripe_billing_webhook(
    request: Request,
    sqs: SQSService = Depends(get_sqs_service),
):
    """High-priority financial dispute / chargeback webhook from Stripe or payment gateway."""
    payload = await request.json()
    event_type = payload.get("type", "charge.dispute.created")
    data_obj = payload.get("data", {}).get("object", {})

    amount = data_obj.get("amount", 0) / 100.0 if "amount" in data_obj else 0.0
    currency = data_obj.get("currency", "eur").upper()
    dispute_id = data_obj.get("id", "disp_mock")
    customer_email = data_obj.get("billing_details", {}).get("email") or "customer@billing-dispute.com"

    subject = f"[CRITICAL BILLING] {event_type} - {amount} {currency} ({dispute_id})"
    body = (
        f"Automated payment gateway notification: Event {event_type} registered for dispute {dispute_id}. "
        f"Disputed amount: {amount} {currency}. Customer reason: {data_obj.get('reason', 'unspecified')}."
    )

    inquiry_payload = {
        "channel": ChannelEnum.BILLING.value,
        "customer_email": customer_email,
        "customer_name": "Stripe Billing Gateway",
        "subject": subject,
        "body": body,
    }

    tracking_id = await sqs.send_inquiry(inquiry_payload, group_id="billing")

    return InquiryQueuedResponse(
        channel=ChannelEnum.BILLING,
        tracking_id=tracking_id,
        message="Stripe dispute inquiry successfully buffered in Amazon SQS FIFO for AI triage.",
    )
