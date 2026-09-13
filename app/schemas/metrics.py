"""Schemas for live SQL-aggregated dashboard metrics and distribution charts."""
from typing import Dict
from pydantic import BaseModel, Field


class KPISummary(BaseModel):
    """FinOps & SRE Live KPIs aggregated from database."""

    sla_compliance_rate: float = Field(..., description="Percentage of inquiries inside SLA deadline (0-100)")
    ai_acceptance_rate: float = Field(..., description="Percentage of resolved tickets approved without edits (0-100)")
    avg_mttr_seconds: int = Field(..., description="Mean time to resolution in seconds")
    active_count: int = Field(..., description="Count of active (unresolved) inquiries")
    p1_count: int = Field(..., description="Count of active critical P1 incidents")
    estimated_cost_today_eur: float = Field(..., description="Total FinOps Bedrock token cost in EUR")


class DistributionMetrics(BaseModel):
    """Categorical histogram distributions aggregated via SQL."""

    departments: Dict[str, int] = Field(default_factory=dict, description="Counts grouped by department")
    priorities: Dict[str, int] = Field(default_factory=dict, description="Counts grouped by priority (P1, P2, P3, P4)")
    channels: Dict[str, int] = Field(default_factory=dict, description="Counts grouped by ingestion channel")
    sentiments: Dict[str, int] = Field(default_factory=dict, description="Counts categorized by sentiment bucket (Negative, Neutral, Positive)")


class DashboardMetricsResponse(BaseModel):
    """Master dashboard analytics payload."""

    kpis: KPISummary
    distributions: DistributionMetrics
    total_inquiries: int
