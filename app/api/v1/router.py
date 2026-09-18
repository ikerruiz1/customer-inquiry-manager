"""API v1 master router assembling all domain endpoints."""
from fastapi import APIRouter
from app.api.v1 import inquiries, webhooks, auth, attachments, metrics, operations

api_router = APIRouter()

api_router.include_router(
    inquiries.router,
    prefix="/inquiries",
    tags=["Inquiries & Triage"],
)

api_router.include_router(
    webhooks.router,
    prefix="/webhooks",
    tags=["Omnichannel Webhooks"],
)

api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Authentication & Cognito TOTP"],
)

api_router.include_router(
    attachments.router,
    prefix="/attachments",
    tags=["S3 Attachments"],
)

api_router.include_router(
    metrics.router,
    prefix="/metrics",
    tags=["Live FinOps & SRE Metrics"],
)

api_router.include_router(
    operations.router,
    prefix="/operations",
    tags=["Operations & Cloud Automation"],
)

