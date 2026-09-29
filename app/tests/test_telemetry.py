"""Tests for AWS X-Ray segment emission over the daemon UDP protocol."""
import json
import socket

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from app.core import telemetry

XRAY_DAEMON_ADDRESS = ("127.0.0.1", 2000)
ALB_TRACE_HEADER = (
    "Root=1-5f1b2c3d-4e5f6a7b8c9d0e1f2a3b4c5d6;Parent=53995c3f42cd8ad8;Sampled=1"
)


@pytest.fixture
def xray_daemon():
    """Bind the UDP endpoint the recorder emits to, standing in for the aws-xray-daemon sidecar."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.bind(XRAY_DAEMON_ADDRESS)
    except OSError:
        sock.close()
        pytest.skip("Local port 2000 is already in use by a real X-Ray daemon.")
    sock.settimeout(10)
    try:
        yield sock
    finally:
        sock.close()


def _receive_segment(sock):
    """Read one datagram and return the segment it carries.

    The daemon protocol is a JSON header document followed by line-delimited entity documents.
    """
    payload, _ = sock.recvfrom(65535)
    documents = [json.loads(line) for line in payload.decode("utf-8").splitlines() if line.strip()]
    segments = [doc for doc in documents if "name" in doc and "trace_id" in doc]
    assert segments, f"X-Ray datagram carried no segment document: {documents}"
    return segments[0]


def test_trace_id_is_extracted_from_alb_forwarded_header():
    """Verify the Root= and Sampled= fields of the ALB trace header are recovered for continuity."""
    assert telemetry._parse_alb_trace_header(ALB_TRACE_HEADER) == (
        "1-5f1b2c3d-4e5f6a7b8c9d0e1f2a3b4c5d6",
        True,
    )
    assert telemetry._parse_alb_trace_header("Root=1-abc;Sampled=0") == ("1-abc", False)
    assert telemetry._parse_alb_trace_header("Parent=53995c3f42cd8ad8;Sampled=1") == (None, True)
    assert telemetry._parse_alb_trace_header(None) == (None, None)


def test_setup_xray_emits_root_segment_for_http_request(xray_daemon, monkeypatch):
    """Verify an HTTP request produces one valid X-Ray segment document addressed to the daemon."""
    import aws_xray_sdk.core

    monkeypatch.setattr(telemetry.settings, "XRAY_ENABLED", True)
    monkeypatch.setattr(telemetry.settings, "PROJECT_NAME", "customer-inquiry-manager")
    # patch_all() mutates process-wide botocore/httpx/sqlalchemy internals; the emission contract
    # under test is the segment document, so the patching is recorded instead of executed.
    patch_calls = []
    monkeypatch.setattr(aws_xray_sdk.core, "patch_all", lambda *a, **k: patch_calls.append(True))

    app = FastAPI()

    @app.get("/api/v1/inquiries/health-probe")
    async def probe():
        return {"status": "ok"}

    telemetry.setup_xray(app)
    assert patch_calls == [True]

    with TestClient(app) as client:
        response = client.get(
            "/api/v1/inquiries/health-probe",
            headers={"X-Amzn-Trace-Id": ALB_TRACE_HEADER, "X-Forwarded-For": "203.0.113.42, 10.0.1.1"},
        )

    assert response.status_code == 200
    segment = _receive_segment(xray_daemon)
    assert segment["name"] == "/api/v1/inquiries/health-probe"
    assert segment["trace_id"] == "1-5f1b2c3d-4e5f6a7b8c9d0e1f2a3b4c5d6"
    assert segment["in_progress"] is False
    assert segment["http"]["request"]["method"] == "GET"
    assert segment["http"]["request"]["url"].endswith("/api/v1/inquiries/health-probe")
    assert segment["http"]["request"]["client_ip"] == "203.0.113.42"
    assert segment["http"]["response"]["status"] == 200


def test_setup_xray_records_fault_on_handled_server_error(xray_daemon, monkeypatch):
    """Verify a 5xx is recorded as a fault with its cause.

    Starlette serves a generic Exception handler from ServerErrorMiddleware, which wraps every
    user middleware, so the 500 response itself never reaches this middleware. The fault and the
    cause are still recorded because the exception propagates through it first.
    """
    import aws_xray_sdk.core

    monkeypatch.setattr(telemetry.settings, "XRAY_ENABLED", True)
    monkeypatch.setattr(aws_xray_sdk.core, "patch_all", lambda *a, **k: None)

    app = FastAPI()

    @app.exception_handler(Exception)
    async def generic_exception_handler(request, exc):
        """Mirror the production global handler registered in app/main.py."""
        from starlette.responses import JSONResponse

        return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})

    @app.get("/api/v1/inquiries/broken")
    async def broken():
        raise RuntimeError("simulated handler failure")

    telemetry.setup_xray(app)

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/api/v1/inquiries/broken", headers={"X-Amzn-Trace-Id": ALB_TRACE_HEADER})

    assert response.status_code == 500
    segment = _receive_segment(xray_daemon)
    # A 5xx is a fault, and the SDK models a fault as exclusive of error.
    assert segment["fault"] is True
    assert segment["cause"]["exceptions"][0]["message"] == "simulated handler failure"


def test_setup_xray_records_error_on_client_error(xray_daemon, monkeypatch):
    """Verify a 4xx raised by a route is recorded as an error with its status."""
    import aws_xray_sdk.core

    monkeypatch.setattr(telemetry.settings, "XRAY_ENABLED", True)
    monkeypatch.setattr(aws_xray_sdk.core, "patch_all", lambda *a, **k: None)

    app = FastAPI()

    @app.get("/api/v1/inquiries/{inquiry_id}")
    async def not_found(inquiry_id: str):
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Inquiry not found")

    telemetry.setup_xray(app)

    with TestClient(app) as client:
        response = client.get("/api/v1/inquiries/missing", headers={"X-Amzn-Trace-Id": ALB_TRACE_HEADER})

    assert response.status_code == 404
    segment = _receive_segment(xray_daemon)
    # The segment is named with the route template so path parameters do not fragment the service map.
    assert segment["name"] == "/api/v1/inquiries/{inquiry_id}"
    assert segment["error"] is True
    assert segment.get("fault") is None
    assert segment["http"]["request"]["url"].endswith("/api/v1/inquiries/missing")
    assert segment["http"]["response"]["status"] == 404


def test_setup_xray_captures_cause_when_exception_escapes(xray_daemon, monkeypatch):
    """Verify an exception reaching the middleware is stored as a fault cause."""
    import aws_xray_sdk.core

    monkeypatch.setattr(telemetry.settings, "XRAY_ENABLED", True)
    monkeypatch.setattr(aws_xray_sdk.core, "patch_all", lambda *a, **k: None)

    app = FastAPI()

    @app.get("/api/v1/inquiries/broken")
    async def broken():
        raise RuntimeError("simulated handler failure")

    telemetry.setup_xray(app)

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/api/v1/inquiries/broken", headers={"X-Amzn-Trace-Id": ALB_TRACE_HEADER})

    assert response.status_code == 500
    segment = _receive_segment(xray_daemon)
    assert segment["fault"] is True
    assert segment["cause"]["exceptions"][0]["message"] == "simulated handler failure"
    assert segment["cause"]["exceptions"][0]["type"] == "RuntimeError"


def test_setup_xray_is_a_noop_when_disabled(monkeypatch):
    """Verify no segment infrastructure is wired while the feature flag is off."""
    monkeypatch.setattr(telemetry.settings, "XRAY_ENABLED", False)
    app = FastAPI()
    telemetry.setup_xray(app)
    assert app.user_middleware == []
