"""FastAPI application entrypoint, lifespan event orchestration, and middleware assembly."""
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

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

    # In local development mode, automatically initialize database schema
    if settings.ENVIRONMENT == "dev":
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database schema initialized successfully.")
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

# Attach Health & Readiness probes
app.include_router(health_router)

# Attach Master API v1 Router
app.include_router(api_router, prefix="/api/v1")

# Mount static frontend assets if directory exists
static_dir = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


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
    """Root entrypoint returning frontend console if available, or service metadata."""
    index_file = os.path.join(static_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "docs_url": "/docs",
        "health_url": "/health/live",
    }
