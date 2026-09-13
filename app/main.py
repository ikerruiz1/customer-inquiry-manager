"""FastAPI application entrypoint, lifespan event orchestration, and middleware assembly."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import engine, Base
from app.core.telemetry import setup_xray
from app.health import router as health_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager: handles pre-warming, schema initialization, and graceful shutdown."""
    logger.info(f"Initializing {settings.PROJECT_NAME} in environment '{settings.ENVIRONMENT}'...")

    # Initialize distributed tracing if configured
    setup_xray(app)

    # In local development mode, automatically initialize database schema and seed data
    if settings.ENVIRONMENT == "dev":
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database schema initialized successfully.")

            # Auto-seed canonical inquiries if database table is empty
            from sqlalchemy import select, func
            from app.core.database import AsyncSessionLocal
            from app.models.inquiry import Inquiry
            async with AsyncSessionLocal() as session:
                count_res = await session.execute(select(func.count()).select_from(Inquiry))
                if count_res.scalar_one() == 0:
                    from datetime import datetime, timezone, timedelta
                    now = datetime.now(timezone.utc)
                    sample_inquiries = [
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
                        ),
                        Inquiry(
                            channel="WEB_FORM",
                            customer_email="jorge.developer@saasapp.es",
                            customer_name="Jorge Salgado",
                            subject="Configuration question regarding CORS headers on Gateway API",
                            body="We are integrating our React frontend with the Gateway API and encountering a CORS origin not allowed error from localhost:5173. Could you advise on how to configure the allowed origin in the configuration file?",
                            status="UNASSIGNED",
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
                            sla_deadline_at=now + timedelta(hours=7),
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
                            resolution_text="Hello Sarah, 3DS v2 multi-currency authorization has been completed successfully. Your corporate card is verified and the invoice receipt has been issued.",
                            assigned_agent_id="00000000-0000-0000-0000-000000000001",
                            claimed_at=now - timedelta(hours=4),
                            resolved_at=now - timedelta(hours=3),
                            human_reviewed=True,
                        ),
                    ]
                    session.add_all(sample_inquiries)
                    await session.commit()
                    logger.info("Pre-seeded canonical dev inquiries successfully into persistent database.")

                # Auto-seed canonical operators if operators table is empty
                from app.models.inquiry import Operator
                from app.services.cognito_service import _OPERATOR_REGISTRY

                op_count_res = await session.execute(select(func.count()).select_from(Operator))
                if op_count_res.scalar_one() == 0:
                    canonical_operators = [
                        Operator(
                            id="00000000-0000-0000-0000-000000000001",
                            name="Carlos M.",
                            email="carlos.m@company.internal",
                            password_hash="Agent123!",
                            role="Tier1_Agent",
                            groups=["Tier1_Agents"],
                            totp_secret="JBSWY3DPEHPK3PXP",
                            initials="CM",
                            color="#3b82f6",
                        ),
                        Operator(
                            id="00000000-0000-0000-0000-000000000002",
                            name="Laura G.",
                            email="laura.g@company.internal",
                            password_hash="Agent123!",
                            role="Tier1_Agent",
                            groups=["Tier1_Agents"],
                            totp_secret="MZXW6YTBOIXW6YTB",
                            initials="LG",
                            color="#10b981",
                        ),
                        Operator(
                            id="00000000-0000-0000-0000-000000000099",
                            name="Alex Rivera",
                            email="alex.rivera@company.internal",
                            password_hash="Manager123!",
                            role="Operations_Manager",
                            groups=["Operations_Managers", "Tier1_Agents"],
                            totp_secret="NBSWY3DPEHPK3PXP",
                            initials="AR",
                            color="#8b5cf6",
                        ),
                    ]
                    session.add_all(canonical_operators)
                    await session.commit()
                    logger.info("Pre-seeded canonical operators into persistent database.")

                # Synchronize all operators from persistent database into in-memory registry
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

    yield

    logger.info("Executing graceful application shutdown and disposing database connections...")
    await engine.dispose()
    logger.info("Shutdown complete.")


# Instantiate core FastAPI application
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Enterprise AI Customer Inquiry & Ticket Triage Platform with Amazon Bedrock, "
        "PostgreSQL 16, and Zero-Trust Cognito TOTP MFA."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Cross-Origin Resource Sharing (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Enforce defense-in-depth HTTP security response headers (OWASP A05:2021)."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# Attach Health & Readiness probes
app.include_router(health_router)

# Attach Master API v1 Router
app.include_router(api_router, prefix="/api/v1")


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Global exception handler preventing unhandled exceptions from exposing internal stack traces."""
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error occurred. Telemetry has logged the incident."},
    )


@app.get("/")
async def root():
    """Root entrypoint returning service status metadata."""
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "docs_url": "/docs",
        "health_url": "/health/live",
    }
