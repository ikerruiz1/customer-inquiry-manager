"""FastAPI application entrypoint, lifespan event orchestration, and middleware assembly."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import engine
from app.core.seeder import ensure_schema_extensions, init_db_and_seed
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

    if settings.ENVIRONMENT == "dev":
        await init_db_and_seed()

    await ensure_schema_extensions()

    from app.services.inbound_email_poller import get_inbound_email_poller
    email_poller = get_inbound_email_poller()
    email_poller.start()

    from app.services.sla_breach_watcher import get_sla_breach_watcher
    sla_watcher = get_sla_breach_watcher()
    sla_watcher.start()

    from app.services.sqs_consumer import get_sqs_consumer
    sqs_consumer = get_sqs_consumer()
    sqs_consumer.start()

    yield

    logger.info("Executing graceful application shutdown and disposing database connections...")
    await sqs_consumer.stop()
    await sla_watcher.stop()
    await email_poller.stop()
    await engine.dispose()
    logger.info("Shutdown complete.")


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

setup_xray(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://*.amazonaws.com; "
        "frame-ancestors 'none';"
    )
    return response


app.include_router(health_router)

app.include_router(api_router, prefix="/api/v1")


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Global exception handler preventing unhandled exceptions from exposing internal stack traces."""
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error occurred. Telemetry has logged the incident."},
    )


import os
from fastapi.staticfiles import StaticFiles

frontend_candidates = [
    os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist"),
    "frontend/dist",
]
frontend_dist_dir = next((p for p in frontend_candidates if os.path.isdir(p)), None)

if frontend_dist_dir:
    app.mount("/", StaticFiles(directory=frontend_dist_dir, html=True), name="frontend")
else:
    @app.get("/")
    async def root():
        """Root entrypoint returning service status metadata when static frontend is not present."""
        return {
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
            "docs_url": "/docs",
            "health_url": "/health/live",
        }
