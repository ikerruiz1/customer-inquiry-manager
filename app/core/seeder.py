"""Canonical database seeder and operator registry for Customer Inquiry Manager.

Provides idempotent schema initialization, pre-provisioned enterprise operator profiles,
and realistic omnichannel test data representing multi-channel ingestion (Stripe, SES, Trustpilot).
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy import select, func

from app.core.database import Base, engine, AsyncSessionLocal
from app.models.inquiry import Inquiry, Operator, InquiryMessage
from app.core.config import settings

logger = logging.getLogger("app.core.seeder")

# Authoritative enterprise operators (Single Source of Truth)
CANONICAL_OPERATORS: List[Dict[str, Any]] = [
    {
        "id": "00000000-0000-0000-0000-000000000001",
        "name": getattr(settings, "INITIAL_OPERATOR_NAME", "Cloud Administrator"),
        "email": settings.INITIAL_OPERATOR_EMAIL,
        "password": settings.INITIAL_OPERATOR_PASSWORD,
        "role": "Operations_Manager",
        "groups": ["Operations_Managers", "Tier1_Agents"],
        "totp_secret": "JBSWY3DPEHPK3PXP",
        "initials": "".join([part[0] for part in getattr(settings, "INITIAL_OPERATOR_NAME", "Cloud Administrator").split()][:2]).upper() or "CA",
        "color": "#3b82f6",
    },
    {
        "id": "00000000-0000-0000-0000-000000000002",
        "name": "Laura G.",
        "email": "laura.g@company.internal",
        "password": "Agent123!",
        "role": "Tier1_Agent",
        "groups": ["Tier1_Agents"],
        "totp_secret": "MZXW6YTBOIXW6YTB",
        "initials": "LG",
        "color": "#10b981",
    },
    {
        "id": "00000000-0000-0000-0000-000000000099",
        "name": "Alex Rivera",
        "email": "alex.rivera@company.internal",
        "password": "Manager123!",
        "role": "Operations_Manager",
        "groups": ["Operations_Managers", "Tier1_Agents"],
        "totp_secret": "NBSWY3DPEHPK3PXP",
        "initials": "AR",
        "color": "#8b5cf6",
    },
]


def build_canonical_operator_registry() -> Dict[str, Dict[str, Any]]:
    """Build canonical operator registry keyed by email with backwards-compatible aliases."""
    registry: Dict[str, Dict[str, Any]] = {}
    for op in CANONICAL_OPERATORS:
        registry[op["email"]] = {**op}
    # Maintain legacy aliases for backwards compatibility with earlier tests
    primary_email = CANONICAL_OPERATORS[0]["email"]
    registry["employer1@company.local"] = registry[primary_email]
    registry["employer1@company.internal"] = registry[primary_email]
    registry["carlos.m@company.internal"] = registry[primary_email]
    registry["carlos.m@company.local"] = registry[primary_email]
    registry["laura.g@company.local"] = registry["laura.g@company.internal"]
    registry["alex.rivera@company.local"] = registry["alex.rivera@company.internal"]
    return registry


def build_canonical_sample_inquiries(reference_time: Optional[datetime] = None) -> List[Inquiry]:
    """Construct 7 canonical customer inquiries representing multi-channel ingestion."""
    now = reference_time or datetime.now(timezone.utc)
    inquiries = [
        Inquiry(
            channel="BILLING",
            customer_email="cto@fintech-pay.io",
            customer_name="Elena Rostova",
            subject="[BANK DISPUTE] 450.00 EUR hold on Enterprise account",
            body="We have an active 450.00 EUR hold placed on our account due to an unrecognized Stripe dispute (ref: dp_88421). If these funds are not released by 18:00 UTC today, we will terminate our 25 Enterprise licenses and migrate our infrastructure to a competitor.",
            status="UNASSIGNED",
            department="BILLING",
            priority="P1",
            urgency=5,
            impact=3,
            sentiment_score=-0.85,
            churn_risk=True,
            entities={
                "order_id": "dp_88421",
                "monetary_amount": "450.00 EUR",
                "customer_deadline": "Today 18:00 UTC",
                "product_affected": "Billing Gateway",
                "confidence_score": 0.98,
                "bedrock_latency_ms": 612,
                "model_id": "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
                "input_tokens": 184,
                "output_tokens": 72,
                "cost_eur": 0.000392,
            },
            suggested_strategy="EMPATHETIC_DEFUSING",
            suggested_response="Dear FinTech Pay team, we have placed an immediate administrative hold on the fund retention and escalated the case to our senior treasury group to reconcile dispute dp_88421 directly with the acquiring institution. We will provide a definitive resolution before 18:00 UTC today.",
            agent_copilot_notes="Internal Note: Customer is on an annual Enterprise tier (MRR: 4,800 EUR). Do not dispute reject without consulting key accounts lead.",
            sla_deadline_at=now + timedelta(minutes=28),
            first_response_deadline_at=now + timedelta(minutes=15),
            messages=[
                InquiryMessage(
                    sender_type="CUSTOMER",
                    sender_name="Elena Rostova",
                    sender_email="cto@fintech-pay.io",
                    body="We have an active 450.00 EUR hold placed on our account due to an unrecognized Stripe dispute (ref: dp_88421). If these funds are not released by 18:00 UTC today, we will terminate our 25 Enterprise licenses and migrate our infrastructure to a competitor.",
                    is_internal_note=False,
                    attachments=[],
                    created_at=now - timedelta(minutes=32),
                )
            ],
        ),
        Inquiry(
            channel="EMAIL",
            customer_email="sre-team@nexuscloud.com",
            customer_name="David Vance",
            subject="Outage Alert: 504 Gateway Timeout on managed Kubernetes cluster",
            body="Since the 14:00 deployment, all pods in cluster k8s-prod-eu1 are throwing 504 Gateway Timeout errors and failing with ERR_POD_OOMKILLED status. End users are unable to reach the payment checkout flow.",
            status="CLAIMED",
            department="TECH_SUPPORT",
            priority="P1",
            urgency=5,
            impact=3,
            sentiment_score=-0.72,
            churn_risk=True,
            entities={
                "error_code": "504 Gateway Timeout / ERR_POD_OOMKILLED",
                "product_affected": "Managed Kubernetes",
                "order_id": "k8s-prod-eu1",
                "confidence_score": 0.99,
                "bedrock_latency_ms": 580,
                "model_id": "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
                "input_tokens": 210,
                "output_tokens": 85,
                "cost_eur": 0.000467,
            },
            suggested_strategy="DIRECT_RESOLUTION",
            suggested_response="Hello David, we have identified memory throttling across the control plane nodes of k8s-prod-eu1. Our SRE team is provisioning additional compute worker capacity to restore pod traffic immediately.",
            agent_copilot_notes="Internal Note: CloudWatch metrics confirmed node worker-04 reached 99% RAM saturation. Initiated autoscaling group surge capacity.",
            sla_deadline_at=now + timedelta(minutes=42),
            first_response_deadline_at=now + timedelta(minutes=15),
            first_responded_at=now - timedelta(minutes=14),
            assigned_agent_id="00000000-0000-0000-0000-000000000001",
            claimed_at=now - timedelta(minutes=18),
            messages=[
                InquiryMessage(
                    sender_type="CUSTOMER",
                    sender_name="David Vance",
                    sender_email="sre-team@nexuscloud.com",
                    body="Since the 14:00 deployment, all pods in cluster k8s-prod-eu1 are throwing 504 Gateway Timeout errors and failing with ERR_POD_OOMKILLED status. End users are unable to reach the payment checkout flow.",
                    is_internal_note=False,
                    attachments=[],
                    created_at=now - timedelta(minutes=25),
                ),
                InquiryMessage(
                    sender_type="AGENT",
                    sender_name=getattr(settings, "INITIAL_OPERATOR_NAME", "Cloud Administrator"),
                    sender_email=settings.INITIAL_OPERATOR_EMAIL,
                    body="Hello David, we have identified node worker-04 memory saturation. Our SRE team is rolling an updated capacity configuration now.",
                    is_internal_note=False,
                    attachments=[],
                    created_at=now - timedelta(minutes=14),
                ),
            ],
        ),
        Inquiry(
            channel="TRUSTPILOT",
            customer_email="marcos.dev@outlook.com",
            customer_name="Marcos Benítez",
            subject="[Trustpilot 1-Star] Unacceptable support delay and API latency",
            body="I have been waiting for 3 days for custom domain SSL certificate provisioning. Support has been completely absent and my storefront continues to show insecure connection warnings. Highly disappointing.",
            status="UNASSIGNED",
            department="ACCOUNTS",
            priority="P2",
            urgency=4,
            impact=2,
            sentiment_score=-0.92,
            churn_risk=True,
            entities={
                "product_affected": "Custom Domains / SSL",
                "confidence_score": 0.94,
                "bedrock_latency_ms": 630,
                "model_id": "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
                "input_tokens": 160,
                "output_tokens": 65,
                "cost_eur": 0.000357,
            },
            suggested_strategy="EMPATHETIC_DEFUSING",
            suggested_response="Hello Marcos, we sincerely apologize for the delay in issuing your SSL certificate. We have expedited DNS validation for your domain with highest priority, and it will be active within the next 10 minutes.",
            agent_copilot_notes="Internal Note: Verify in Route 53 that CNAME challenge records have no conflicting CAA policies before replying.",
            sla_deadline_at=now + timedelta(minutes=95),
            first_response_deadline_at=now + timedelta(minutes=30),
            messages=[
                InquiryMessage(
                    sender_type="CUSTOMER",
                    sender_name="Marcos Benítez",
                    sender_email="marcos.dev@outlook.com",
                    body="I have been waiting for 3 days for custom domain SSL certificate provisioning. Support has been completely absent and my storefront continues to show insecure connection warnings. Highly disappointing.",
                    is_internal_note=False,
                    attachments=[],
                    created_at=now - timedelta(minutes=45),
                )
            ],
        ),
        Inquiry(
            channel="WEB_FORM",
            customer_email="jorge.developer@saasapp.es",
            customer_name="Jorge Salgado",
            subject="Configuration question regarding CORS headers on Gateway API",
            body="We are integrating our React frontend with the Gateway API and encountering a CORS origin not allowed error from localhost:5173. Could you advise on how to configure the allowed origin in the configuration file?",
            status="PENDING_CUSTOMER",
            department="TECH_SUPPORT",
            priority="P3",
            urgency=2,
            impact=1,
            sentiment_score=0.1,
            churn_risk=False,
            entities={
                "product_affected": "API Gateway",
                "error_code": "CORS Origin Not Allowed",
                "confidence_score": 0.97,
                "bedrock_latency_ms": 540,
                "model_id": "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
                "input_tokens": 140,
                "output_tokens": 55,
                "cost_eur": 0.000305,
            },
            suggested_strategy="DIRECT_RESOLUTION",
            suggested_response="Hello Jorge, to enable local development origins on the API Gateway, update your configuration in app/core/config.py or configure CORS_ORIGINS = ['http://localhost:5173']. Refer to the attached microservices documentation for details.",
            agent_copilot_notes="Internal Note: Provide direct link to microservices CORS configuration guide.",
            sla_deadline_at=now + timedelta(hours=6),
            first_response_deadline_at=now - timedelta(hours=1),
            first_responded_at=now - timedelta(hours=1, minutes=15),
            sla_paused_at=now - timedelta(minutes=45),
            total_paused_seconds=2700,
            assigned_agent_id="00000000-0000-0000-0000-000000000001",
            claimed_at=now - timedelta(hours=2),
            messages=[
                InquiryMessage(
                    sender_type="CUSTOMER",
                    sender_name="Jorge Salgado",
                    sender_email="jorge.developer@saasapp.es",
                    body="We are integrating our React frontend with the Gateway API and encountering a CORS origin not allowed error from localhost:5173. Could you advise on how to configure the allowed origin in the configuration file?",
                    is_internal_note=False,
                    attachments=[],
                    created_at=now - timedelta(hours=2, minutes=30),
                ),
                InquiryMessage(
                    sender_type="AGENT",
                    sender_name=getattr(settings, "INITIAL_OPERATOR_NAME", "Cloud Administrator"),
                    sender_email=settings.INITIAL_OPERATOR_EMAIL,
                    body="Hello Jorge, could you please provide your `vite.config.ts` proxy configuration and any custom request headers sent by your client so we can test the exact CORS preflight match?",
                    is_internal_note=False,
                    attachments=[],
                    created_at=now - timedelta(minutes=45),
                ),
            ],
        ),
        Inquiry(
            channel="EMAIL",
            customer_email="legal@enterprise-corp.de",
            customer_name="Klaus Schmidt",
            subject="Formal request for erasure of personal data (GDPR Article 17)",
            body="We hereby formally request the permanent, irrevocable erasure of all personal data and telemetry logs associated with customer account 991823 within 30 calendar days.",
            status="UNASSIGNED",
            department="SECURITY",
            priority="P2",
            urgency=3,
            impact=3,
            sentiment_score=0.0,
            churn_risk=False,
            entities={
                "order_id": "Account-991823",
                "customer_deadline": "30 calendar days",
                "confidence_score": 0.99,
                "bedrock_latency_ms": 605,
                "model_id": "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
                "input_tokens": 195,
                "output_tokens": 80,
                "cost_eur": 0.000438,
            },
            suggested_strategy="ESCALATION",
            suggested_response="Dear Klaus Schmidt, we acknowledge receipt of your data erasure request pursuant to GDPR Article 17. Case SEC-GDPR-2026 has been registered, and our Data Protection Officer (DPO) will provide official certification of data purging within 7 business days.",
            agent_copilot_notes="Internal Note: Mandatory notification to dpo@company.internal required prior to executing physical database purge.",
            sla_deadline_at=now + timedelta(hours=3),
            first_response_deadline_at=now + timedelta(minutes=30),
            messages=[
                InquiryMessage(
                    sender_type="CUSTOMER",
                    sender_name="Klaus Schmidt",
                    sender_email="legal@enterprise-corp.de",
                    body="We hereby formally request the permanent, irrevocable erasure of all personal data and telemetry logs associated with customer account 991823 within 30 calendar days.",
                    is_internal_note=False,
                    attachments=[],
                    created_at=now - timedelta(minutes=15),
                )
            ],
        ),
        Inquiry(
            channel="EMAIL",
            customer_email="promo@global-marketing-agency.com",
            customer_name="Commercial Lead",
            subject="Offshore backlink and SEO rank enhancement services",
            body="Dear Webmaster, we noticed your website ranking could improve. We offer premium link building packages starting at $99/mo.",
            status="UNASSIGNED",
            department="GENERAL",
            priority="P4",
            urgency=1,
            impact=1,
            sentiment_score=0.0,
            churn_risk=False,
            entities={
                "confidence_score": 0.99,
                "bedrock_latency_ms": 450,
                "model_id": "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
                "input_tokens": 110,
                "output_tokens": 40,
                "cost_eur": 0.000228,
            },
            suggested_strategy="DIRECT_RESOLUTION",
            suggested_response="Message automatically archived as irrelevant.",
            agent_copilot_notes="Internal Note: No action required. Auto-resolve directly.",
            sla_deadline_at=now + timedelta(hours=23),
            first_response_deadline_at=now + timedelta(hours=2),
            messages=[
                InquiryMessage(
                    sender_type="CUSTOMER",
                    sender_name="Commercial Lead",
                    sender_email="promo@global-marketing-agency.com",
                    body="Dear Webmaster, we noticed your website ranking could improve. We offer premium link building packages starting at $99/mo.",
                    is_internal_note=False,
                    attachments=[],
                    created_at=now - timedelta(hours=1),
                )
            ],
        ),
        Inquiry(
            channel="WEB_FORM",
            customer_email="sarah.connor@cyberdyne.io",
            customer_name="Sarah Connor",
            subject="Card decline error when updating corporate billing method",
            body="Payment gateway returned error 402 Card Declined when attempting to register a corporate card issued in the United Kingdom.",
            status="RESOLVED",
            department="BILLING",
            priority="P2",
            urgency=4,
            impact=2,
            sentiment_score=-0.4,
            churn_risk=False,
            entities={
                "error_code": "402 Card Declined",
                "confidence_score": 0.96,
                "bedrock_latency_ms": 590,
                "model_id": "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
                "input_tokens": 175,
                "output_tokens": 70,
                "cost_eur": 0.000386,
            },
            suggested_strategy="DIRECT_RESOLUTION",
            suggested_response="Hello Sarah, the issuing institution required step-up 3DS two-factor authentication. We have generated a secure confirmation link to complete the authorization.",
            agent_copilot_notes="Internal Note: 3DS billing processing failure verified and resolved.",
            sla_deadline_at=now - timedelta(hours=2),
            first_response_deadline_at=now - timedelta(hours=3, minutes=30),
            first_responded_at=now - timedelta(hours=3, minutes=50),
            resolution_text="Hello Sarah, 3DS v2 multi-currency authorization has been completed successfully. Your corporate card is verified and the invoice receipt has been issued.",
            assigned_agent_id="00000000-0000-0000-0000-000000000001",
            claimed_at=now - timedelta(hours=4),
            resolved_at=now - timedelta(hours=3),
            human_reviewed=True,
            messages=[
                InquiryMessage(
                    sender_type="CUSTOMER",
                    sender_name="Sarah Connor",
                    sender_email="sarah.connor@cyberdyne.io",
                    body="Payment gateway returned error 402 Card Declined when attempting to register a corporate card issued in the United Kingdom.",
                    is_internal_note=False,
                    attachments=[],
                    created_at=now - timedelta(hours=4, minutes=15),
                ),
                InquiryMessage(
                    sender_type="AGENT",
                    sender_name=getattr(settings, "INITIAL_OPERATOR_NAME", "Cloud Administrator"),
                    sender_email=settings.INITIAL_OPERATOR_EMAIL,
                    body="Hello Sarah, 3DS v2 multi-currency authorization has been completed successfully. Your corporate card is verified and the invoice receipt has been issued.",
                    is_internal_note=False,
                    attachments=[],
                    created_at=now - timedelta(hours=3),
                ),
            ],
        ),
    ]
    return inquiries


async def init_db_and_seed() -> None:
    """Initialize database tables and idempotently seed canonical records on initial startup."""
    try:
        from app.services.cognito_service import _OPERATOR_REGISTRY

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with AsyncSessionLocal() as session:
            # Purge mock/sample inquiries on startup so the operator queue starts 100% clean
            from sqlalchemy import delete
            from app.models.inquiry import AuditLog, InquiryMessage
            del_msg = await session.execute(delete(InquiryMessage))
            del_aud = await session.execute(delete(AuditLog))
            del_inq = await session.execute(delete(Inquiry))
            if del_inq.rowcount > 0:
                await session.commit()
                logger.info(f"Cleaned {del_inq.rowcount} sample inquiries. Operational queue initialized to 0.")

            # Seed canonical enterprise operators if table is empty
            op_count_res = await session.execute(select(func.count()).select_from(Operator))
            if op_count_res.scalar_one() == 0:
                canonical_operators = [
                    Operator(
                        id=op["id"],
                        name=op["name"],
                        email=op["email"],
                        password_hash=op["password"],
                        role=op["role"],
                        groups=op["groups"],
                        totp_secret=op["totp_secret"],
                        initials=op["initials"],
                        color=op["color"],
                    )
                    for op in CANONICAL_OPERATORS
                ]
                session.add_all(canonical_operators)
                await session.commit()
                logger.info("Pre-seeded canonical operators into persistent database.")

            # Synchronize database operators into in-memory registry for instant auth lookup
            all_ops_res = await session.execute(select(Operator))
            for op in all_ops_res.scalars().all():
                _OPERATOR_REGISTRY[op.email] = {
                    "id": op.id,
                    "name": op.name,
                    "email": op.email,
                    "password": op.password_hash,
                    "role": op.role,
                    "groups": op.groups,
                    "totp_secret": op.totp_secret,
                    "initials": op.initials,
                    "color": op.color,
                }
    except Exception as exc:
        logger.warning(f"Database schema initialization skipped or failed: {exc}")
