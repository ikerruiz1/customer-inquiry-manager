"""Integration tests for live SQL-aggregated metrics and operator directory endpoints."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_dashboard_metrics_endpoint(client: AsyncClient, mock_sns):
    """Verify GET /api/v1/metrics/dashboard returns real SQL-aggregated KPIs and distributions."""
    payload = {
        "channel": "EMAIL",
        "customer_email": "metrics-test@company.internal",
        "customer_name": "Metrics Tester",
        "subject": "System Latency Investigation",
        "body": "Latency spike observed in cluster nodes.",
    }
    create_res = await client.post("/api/v1/inquiries/", json=payload)
    assert create_res.status_code == 201

    response = await client.get("/api/v1/metrics/dashboard")
    assert response.status_code == 200
    data = response.json()

    assert "kpis" in data
    assert "distributions" in data
    assert "total_inquiries" in data
    assert data["total_inquiries"] >= 1

    kpis = data["kpis"]
    assert "sla_compliance_rate" in kpis
    assert "ai_acceptance_rate" in kpis
    assert "avg_mttr_seconds" in kpis
    assert "active_count" in kpis
    assert "p1_count" in kpis
    assert "estimated_cost_today_eur" in kpis

    distributions = data["distributions"]
    assert "departments" in distributions
    assert "priorities" in distributions
    assert "channels" in distributions
    assert "sentiments" in distributions


@pytest.mark.asyncio
async def test_get_registered_operators_directory(client: AsyncClient):
    """Verify GET /api/v1/auth/operators returns the directory of persisted support operators."""
    response = await client.get("/api/v1/auth/operators")
    assert response.status_code == 200
    operators = response.json()
    assert isinstance(operators, list)
    assert len(operators) >= 1
    first = operators[0]
    assert "id" in first
    assert "name" in first
    assert "email" in first
    assert "role" in first
    assert "initials" in first
    assert "color" in first
