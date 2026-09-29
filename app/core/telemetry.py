"""AWS X-Ray distributed tracing and CloudWatch Embedded Metric Format (EMF) telemetry."""
import json
import logging
import time
import traceback
from typing import Any, Dict, Optional

from app.core.config import settings

logger = logging.getLogger("app.core.telemetry")

XRAY_TRACE_HEADER = "x-amzn-trace-id"


def _parse_alb_trace_header(trace_header: Optional[str]) -> tuple:
    """Recover the upstream trace identity and sampling decision from the ALB forwarded header.

    The ALB reports no segments to X-Ray itself; it only forwards Root=, Parent= and Sampled=.
    Honouring both the trace id and the decision is what keeps the compute tier inside the
    upstream trace instead of being re-sampled away and dropped by the local sampler.
    """
    if not trace_header:
        return None, None

    trace_id = None
    sampled = None
    for field in trace_header.split(";"):
        key, _, value = field.partition("=")
        key = key.strip()
        value = value.strip()
        if key == "Root" and value:
            trace_id = value
        elif key == "Sampled" and value in ("0", "1"):
            sampled = value == "1"
    return trace_id, sampled


def _segment_name(scope) -> str:
    """Derive a low-cardinality segment name from the request path and its resolved path parameters.

    The matched route object cannot be used for this. FastAPI keeps included routers as
    _IncludedRouter wrappers, so APIRoute.path holds only the path registered on the sub-router
    and omits the prefixes applied when the router was included, which would collapse every
    endpoint of a router onto the same name. Re-substituting the resolved parameter values into
    the request path yields the full route template instead.
    """
    path = scope.get("path") or "unknown"
    params = scope.get("path_params") or {}
    if not params:
        return path
    for name, value in params.items():
        if value is not None and str(value) != "":
            path = path.replace(str(value), "{" + name + "}")
    return path


def _request_url(scope) -> str:
    """Reconstruct the absolute request URL, preferring the public host forwarded by the ALB."""
    headers = {
        key.decode("latin-1").lower(): value.decode("latin-1")
        for key, value in scope.get("headers", [])
    }
    path = scope.get("root_path", "") + scope.get("path", "")
    query = scope.get("query_string", b"")
    if query:
        path = f"{path}?{query.decode('latin-1')}"

    host = headers.get("x-forwarded-host") or headers.get("host")
    scheme = headers.get("x-forwarded-proto")
    if not host or not scheme:
        server = scope.get("server") or ("127.0.0.1", 0)
        host = host or f"{server[0]}:{server[1]}"
        scheme = scheme or scope.get("scheme", "http")
    return f"{scheme}://{host}{path}"


def _build_asgi_middleware():
    """Return an ASGI middleware emitting one X-Ray root segment per HTTP request.

    The AWS X-Ray Python SDK ships no ASGI or Starlette extension, and FastAPI is an ASGI
    application rather than a WSGI one, so the root segment is opened and closed directly
    against the recorder. Downstream calls are captured by patch_all() as subsegments.
    """
    from aws_xray_sdk.core import xray_recorder

    class XRayASGIMiddleware:
        def __init__(self, app):
            self.app = app

        async def __call__(self, scope, receive, send):
            if scope["type"] != "http":
                await self.app(scope, receive, send)
                return

            headers = {
                key.decode("latin-1").lower(): value.decode("latin-1")
                for key, value in scope.get("headers", [])
            }

            trace_id, sampled = _parse_alb_trace_header(headers.get(XRAY_TRACE_HEADER))
            segment = xray_recorder.begin_segment(
                name=_segment_name(scope),
                traceid=trace_id,
                sampling=sampled,
            )
            segment.put_http_meta("method", scope.get("method"))
            segment.put_http_meta("url", _request_url(scope))
            if headers.get("user-agent"):
                segment.put_http_meta("user_agent", headers["user-agent"])
            if headers.get("x-forwarded-for"):
                segment.put_http_meta("client_ip", headers["x-forwarded-for"].split(",")[0].strip())

            status_code = None

            async def send_wrapper(message):
                nonlocal status_code
                if message["type"] == "http.response.start":
                    status_code = message["status"]
                    # put_http_meta("status") both records http.response.status and raises the
                    # error/fault/throttle flags; apply_status_code alone only raises the flags.
                    segment.put_http_meta("status", status_code)
                await send(message)

            try:
                await self.app(scope, receive, send_wrapper)
            except Exception as exc:
                # add_exception records the cause but does not raise the flags; an unhandled
                # handler failure is a fault regardless of the status the error responder emits.
                segment.add_exception(exc, traceback.extract_tb(exc.__traceback__), True)
                segment.add_fault_flag()
                raise
            finally:
                # Routing populates scope["path_params"] only after the request is dispatched, so
                # the provisional name is corrected to the full route template before closing the
                # segment. Naming it with the raw path from the start would give every resource
                # identifier its own service map node.
                segment.name = _segment_name(scope)
                xray_recorder.end_segment()

    return XRayASGIMiddleware


def trace_subsegment(name: str, **metadata):
    """Open a manual subsegment around a block of application work, if a segment is open.

    Used to time work the SDK cannot patch automatically, such as assembling the grounding
    context into the prompt sent to Amazon Bedrock. Outside a request, such as in a background
    worker, the block runs untraced rather than emitting a context error.
    """
    if not settings.XRAY_ENABLED:
        return _NullSubsegment()
    try:
        from aws_xray_sdk.core import xray_recorder
    except Exception:
        return _NullSubsegment()
    if not xray_recorder.current_segment():
        return _NullSubsegment()
    return xray_recorder.in_subsegment(name)


class _NullSubsegment:
    """No-op stand-in used when tracing is disabled or no segment is currently open."""

    def __enter__(self):
        return self

    def __exit__(self, *exc_info):
        return False

    def put_metadata(self, *args, **kwargs):
        return None

    def put_annotation(self, *args, **kwargs):
        return None


def setup_xray(app=None):
    """Configure AWS X-Ray recorder and ASGI middleware targeting the daemon sidecar on 127.0.0.1:2000."""
    if not settings.XRAY_ENABLED:
        logger.info("AWS X-Ray distributed tracing is disabled via configuration.")
        return

    try:
        from aws_xray_sdk.core import xray_recorder, patch_all

        xray_recorder.configure(
            service=settings.PROJECT_NAME,
            daemon_address="127.0.0.1:2000",
            sampling=True,
            context_missing="LOG_ERROR",
        )
        patch_all()

        if app:
            app.add_middleware(_build_asgi_middleware())
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
