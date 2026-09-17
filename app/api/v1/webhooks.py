"""Inbound omnichannel webhooks: Email, Web Form, Trustpilot, Google Reviews, and Billing."""
import hashlib
import hmac
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.api.v1.inquiries import process_and_persist_inquiry
from app.schemas.inquiry import InquiryCreate, InquiryResponse, ChannelEnum
from app.services.bedrock_service import BedrockService, get_bedrock_service
from app.services.sns_service import SNSService, get_sns_service

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


@router.post("/email", response_model=InquiryResponse, status_code=status.HTTP_201_CREATED)
async def inbound_email_webhook(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    bedrock: BedrockService = Depends(get_bedrock_service),
    sns: SNSService = Depends(get_sns_service),
):
    """Inbound email parser receiving webhooks from AWS SES Inbound Rules or SendGrid Inbound Parse."""
    sender_email = payload.get("from") or payload.get("envelope", {}).get("from") or "anonymous@customer.com"
    subject = payload.get("subject") or "Support Request via Email"
    body = payload.get("text") or payload.get("html") or payload.get("body") or ""

    # 1. Thread Detection: Check if this inbound email is a customer reply to an existing ticket
    import re
    from sqlalchemy import select, cast, String
    from sqlalchemy.orm import selectinload
    from app.models.inquiry import Inquiry
    from app.schemas.inquiry import CustomerReplyCreate
    from app.api.v1.inquiries import post_customer_reply

    ticket_match = re.search(r"(?:\[Ticket #|Ticket #)([A-Fa-f0-9\-]{8,36})\]?", subject)
    if ticket_match:
        short_id = ticket_match.group(1).lower()
        stmt = (
            select(Inquiry)
            .options(selectinload(Inquiry.messages))
            .where(cast(Inquiry.id, String).ilike(f"{short_id}%"))
        )
        res = await db.execute(stmt)
        existing_inquiry = res.scalar_one_or_none()
        if existing_inquiry:
            logger.info(f"Inbound email matched existing ticket {existing_inquiry.id}. Routing as customer reply.")
            reply_create = CustomerReplyCreate(
                body=body or "Customer replied via email.",
                customer_name=payload.get("name") or sender_email.split("@")[0],
                customer_email=sender_email,
            )
            await post_customer_reply(inquiry_id=existing_inquiry.id, payload=reply_create, db=db)
            fetch_stmt = (
                select(Inquiry)
                .options(selectinload(Inquiry.messages))
                .where(Inquiry.id == existing_inquiry.id)
            )
            updated_res = await db.execute(fetch_stmt)
            return updated_res.scalar_one()

    # 2. Ingest as brand-new omnichannel inquiry
    inquiry_in = InquiryCreate(
        channel=ChannelEnum.EMAIL,
        customer_email=sender_email if "@" in sender_email else "user@customer.com",
        customer_name=payload.get("name") or sender_email.split("@")[0],
        subject=subject,
        body=body or "No message content provided in email body.",
    )

    inquiry = await process_and_persist_inquiry(inquiry_in, db, bedrock, sns)
    return inquiry


@router.post("/webform", response_model=InquiryResponse, status_code=status.HTTP_201_CREATED)
async def inbound_webform_webhook(
    inquiry_in: InquiryCreate,
    db: AsyncSession = Depends(get_db),
    bedrock: BedrockService = Depends(get_bedrock_service),
    sns: SNSService = Depends(get_sns_service),
):
    """Customer portal web contact form inquiry intake."""
    inquiry = await process_and_persist_inquiry(inquiry_in, db, bedrock, sns)
    return inquiry


@router.post("/trustpilot", response_model=InquiryResponse, status_code=status.HTTP_201_CREATED)
async def inbound_trustpilot_webhook(
    request: Request,
    x_trustpilot_signature: Optional[str] = Header(None, alias="X-Trustpilot-Signature"),
    db: AsyncSession = Depends(get_db),
    bedrock: BedrockService = Depends(get_bedrock_service),
    sns: SNSService = Depends(get_sns_service),
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

    inquiry_in = InquiryCreate(
        channel=ChannelEnum.TRUSTPILOT,
        customer_email=author_email,
        customer_name=author_name,
        subject=f"[{stars}★ Trustpilot] {review_title}",
        body=review_text or "No review text provided.",
    )

    inquiry = await process_and_persist_inquiry(inquiry_in, db, bedrock, sns)
    return inquiry


@router.post("/google-reviews", response_model=InquiryResponse, status_code=status.HTTP_201_CREATED)
async def inbound_google_reviews_webhook(
    request: Request,
    x_google_webhook_secret: Optional[str] = Header(None, alias="X-Google-Webhook-Secret"),
    db: AsyncSession = Depends(get_db),
    bedrock: BedrockService = Depends(get_bedrock_service),
    sns: SNSService = Depends(get_sns_service),
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

    inquiry_in = InquiryCreate(
        channel=ChannelEnum.GOOGLE_REVIEWS,
        customer_email=reviewer_email,
        customer_name=reviewer_name,
        subject=f"[{star_rating}★ Google Review] {reviewer_name}",
        body=comment,
    )

    inquiry = await process_and_persist_inquiry(inquiry_in, db, bedrock, sns)
    return inquiry


@router.post("/billing", response_model=InquiryResponse, status_code=status.HTTP_201_CREATED)
async def inbound_stripe_billing_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    bedrock: BedrockService = Depends(get_bedrock_service),
    sns: SNSService = Depends(get_sns_service),
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

    inquiry_in = InquiryCreate(
        channel=ChannelEnum.BILLING,
        customer_email=customer_email,
        customer_name="Stripe Billing Gateway",
        subject=subject,
        body=body,
    )

    inquiry = await process_and_persist_inquiry(inquiry_in, db, bedrock, sns)
    return inquiry
