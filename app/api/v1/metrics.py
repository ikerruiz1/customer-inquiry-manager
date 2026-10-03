"""Live SQL-aggregated FinOps and SRE dashboard metrics endpoints."""
import logging
from datetime import datetime, timezone
from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.inquiry import Inquiry
from app.schemas.metrics import (
    DashboardMetricsResponse,
    KPISummary,
    DistributionMetrics,
)

logger = logging.getLogger("app.api.v1.metrics")
router = APIRouter()


@router.get("/dashboard", response_model=DashboardMetricsResponse)
async def get_dashboard_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> DashboardMetricsResponse:
    """Compute real-time KPI metrics and chart distributions from database records."""
    now = datetime.now(timezone.utc)

    stmt = select(
        Inquiry.id,
        Inquiry.status,
        Inquiry.department,
        Inquiry.priority,
        Inquiry.channel,
        Inquiry.sentiment_score,
        Inquiry.sla_deadline_at,
        Inquiry.created_at,
        Inquiry.resolved_at,
        Inquiry.suggested_response,
        Inquiry.resolution_text,
        Inquiry.entities,
    )
    result = await db.execute(stmt)
    rows = result.all()

    total_inquiries = len(rows)

    active_count = 0
    p1_count = 0
    in_bounds_count = 0
    resolved_count = 0
    verbatim_accepted_count = 0
    total_mttr_seconds = 0.0
    resolved_with_time_count = 0
    total_cost_eur = 0.0

    dept_counts: Dict[str, int] = {
        "TECH_SUPPORT": 0,
        "BILLING": 0,
        "SECURITY": 0,
        "ACCOUNTS": 0,
        "SALES": 0,
        "GENERAL": 0,
    }
    prio_counts: Dict[str, int] = {"P1": 0, "P2": 0, "P3": 0, "P4": 0}
    chan_counts: Dict[str, int] = {
        "BILLING": 0,
        "EMAIL": 0,
        "TRUSTPILOT": 0,
        "WEB_FORM": 0,
        "GOOGLE_REVIEWS": 0,
    }
    sent_counts: Dict[str, int] = {"negative": 0, "neutral": 0, "positive": 0}

    for row in rows:
        status = row.status
        prio = row.priority
        dept = row.department
        chan = row.channel
        sent = row.sentiment_score or 0.0
        sla_deadline = row.sla_deadline_at
        created = row.created_at
        resolved = row.resolved_at
        entities = row.entities or {}

        if status != "RESOLVED":
            active_count += 1
            if prio == "P1":
                p1_count += 1

        if sla_deadline:
            if sla_deadline.tzinfo is None:
                sla_deadline = sla_deadline.replace(tzinfo=timezone.utc)
            if status == "RESOLVED" or sla_deadline >= now:
                in_bounds_count += 1

        if status == "RESOLVED":
            resolved_count += 1
            sugg = (row.suggested_response or "").strip()
            resol = (row.resolution_text or "").strip()
            if sugg and resol and sugg == resol:
                verbatim_accepted_count += 1

            if resolved and created:
                if resolved.tzinfo is None:
                    resolved = resolved.replace(tzinfo=timezone.utc)
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                diff = max(1.0, (resolved - created).total_seconds())
                total_mttr_seconds += diff
                resolved_with_time_count += 1

        cost = float(entities.get("cost_eur", 0.00025)) if isinstance(entities, dict) else 0.00025
        total_cost_eur += cost

        if dept in dept_counts:
            dept_counts[dept] += 1
        elif dept:
            dept_counts[dept] = 1

        if prio in prio_counts:
            prio_counts[prio] += 1

        if chan in chan_counts:
            chan_counts[chan] += 1
        elif chan:
            chan_counts[chan] = 1

        if sent < -0.2:
            sent_counts["negative"] += 1
        elif sent > 0.2:
            sent_counts["positive"] += 1
        else:
            sent_counts["neutral"] += 1

    sla_compliance_rate = (
        round((in_bounds_count / total_inquiries) * 100.0, 1) if total_inquiries > 0 else 100.0
    )
    ai_acceptance_rate = (
        round((verbatim_accepted_count / resolved_count) * 100.0, 1) if resolved_count > 0 else 100.0
    )
    avg_mttr_seconds = (
        int(total_mttr_seconds / resolved_with_time_count) if resolved_with_time_count > 0 else 0
    )

    kpis = KPISummary(
        sla_compliance_rate=sla_compliance_rate,
        ai_acceptance_rate=ai_acceptance_rate,
        avg_mttr_seconds=avg_mttr_seconds,
        active_count=active_count,
        p1_count=p1_count,
        estimated_cost_today_eur=round(total_cost_eur, 5),
    )

    distributions = DistributionMetrics(
        departments=dept_counts,
        priorities=prio_counts,
        channels=chan_counts,
        sentiments=sent_counts,
    )

    return DashboardMetricsResponse(
        kpis=kpis,
        distributions=distributions,
        total_inquiries=total_inquiries,
    )
