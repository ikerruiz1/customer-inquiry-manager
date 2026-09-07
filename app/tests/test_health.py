"""Unit tests for ECS Fargate health check probes."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_live_probe(client: AsyncClient):
    """Verify liveness probe returns HTTP 200 and healthy status."""
    response = await client.get("/health/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "alive"
    assert data["service"] == "customer-inquiry-manager"


@pytest.mark.asyncio
async def test_health_ready_probe(client: AsyncClient):
    """Verify readiness probe checks database connectivity."""
    response = await client.get("/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"
