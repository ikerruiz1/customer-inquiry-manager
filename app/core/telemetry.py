"""AWS X-Ray distributed tracing and CloudWatch Embedded Metric Format (EMF) telemetry."""
import json
import logging
import time
from typing import Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger("app.core.telemetry")


def setup_xray(app=None):
    """Configure AWS X-Ray recorder and middleware targeting the daemon sidecar on 127.0.0.1:2000."""
    if not settings.XRAY_ENABLED:
        logger.info("AWS X-Ray distributed tracing is disabled via configuration.")
        return

    try:
        from aws_xray_sdk.core import xray_recorder, patch_all
        from aws_xray_sdk.ext.fastapi.middleware import XRayMiddleware

        xray_recorder.configure(
            service=settings.PROJECT_NAME,
            daemon_address="127.0.0.1:2000",
            sampling=True,
            context_missing="LOG_ERROR",
        )
        patch_all()

        if app:
            app.add_middleware(XRayMiddleware, recorder=xray_recorder)
        logger.info("AWS X-Ray SDK initialized targeting local sidecar daemon at 127.0.0.1:2000")
    except Exception as exc:
        logger.warning(f"Failed to initialize AWS X-Ray SDK (continuing in uninstrumented mode): {exc}")


def emit_emf_metric(
    metric_name: str,
    value: float,
    unit: str = "Count",
    dimensions: Optional[Dict[str, str]] = None,
    properties: Optional[Dict[str, Any]] = None,
):
    """Emit high-cardinality metrics to CloudWatch using the zero-cost Embedded Metric Format (EMF)."""
    dim_dict = dimensions or {"Environment": settings.ENVIRONMENT, "Service": settings.PROJECT_NAME}
    prop_dict = properties or {}

    emf_payload = {
        "_aws": {
            "Timestamp": int(time.time() * 1000),
            "CloudWatchMetrics": [
                {
                    "Namespace": "CustomerInquiryManager",
                    "Dimensions": [list(dim_dict.keys())],
                    "Metrics": [{"Name": metric_name, "Unit": unit}],
                }
            ],
        },
        metric_name: value,
        **dim_dict,
        **prop_dict,
    }

    # Print to stdout: captured by ECS awslogs driver and transformed to CloudWatch Metrics
    print(json.dumps(emf_payload))
