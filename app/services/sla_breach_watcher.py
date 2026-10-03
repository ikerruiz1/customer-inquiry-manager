"""Automated Background SLA Breach Watcher & Executive Escalation Daemon.

Runs continuously within the FastAPI lifespan context:
1. Detects breached open inquiries (now > sla_deadline_at) in real time.
2. Dispatches emergency Ops Alerts via Amazon SNS and escalation emails to operations managers.
3. Records immutable audit trail entries (action="SLA_BREACH_ESCALATED") and internal system notes.
4. Continuously audits queue-wide SLA compliance, triggering executive escalation alerts
   when compliance drops below the contractual threshold (default: >=95.0%) with an anti-fatigue cooldown.
"""
import asyncio
from datetime import datetime, timezone
import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.inquiry import Inquiry, InquiryMessage, AuditLog, Operator
from app.services.email_service import get_email_service
from app.services.sns_service import get_sns_service

logger = logging.getLogger("app.services.sla_breach_watcher")


class SLABreachWatcherDaemon:
    """Asynchronous background worker monitoring ticket SLA deadlines and queue compliance."""

    def __init__(self):
        self.interval_seconds = settings.SLA_WATCHER_INTERVAL_SECONDS
        self.target_threshold = settings.SLA_TARGET_COMPLIANCE_THRESHOLD
        self.cooldown_seconds = settings.EXECUTIVE_ESCALATION_COOLDOWN_SECONDS
        self.manager_email = settings.OPERATIONS_MANAGER_EMAIL
        self.warning_minutes = settings.SLA_PROACTIVE_WARNING_MINUTES
        self.is_running = False
        self._task: Optional[asyncio.Task] = None
        self._last_executive_escalation_at: Optional[datetime] = None

    async def _resolve_operations_manager_recipients(self, db: AsyncSession) -> List[str]:
        """Dynamically resolve notification recipients for supervisor escalations.
        
        Queries active operators holding the 'Operations_Manager' RBAC role from the database.
        Falls back to self.manager_email if no supervisor records are registered.
        """
        try:
            stmt = select(Operator.email).where(Operator.role == "Operations_Manager")
            res = await db.execute(stmt)
            emails = [r[0] for r in res.fetchall() if r[0]]
            if emails:
                return emails
        except Exception as exc:
            logger.warning(f"Deferred dynamic supervisor resolution: {exc}")
        return [self.manager_email]

    def _compute_warning_threshold_seconds(self, priority: str) -> float:
        """Compute dynamic proactive SLA warning threshold based on ITIL priority duration (20-25% rule)."""
        baseline_seconds = float(self.warning_minutes * 60)
        # Priority total SLA duration: P1=1h, P2=4h, P3=12h, P4=24h
        # Enterprise early warning targets 20% to 25% of resolution window:
        priority_early_warning_map = {
            "P1": 15.0 * 60.0,   # 15 min remaining (25% of 1h)
            "P2": 48.0 * 60.0,   # 48 min remaining (20% of 4h)
            "P3": 144.0 * 60.0,  # 2.4 hours remaining (20% of 12h)
            "P4": 288.0 * 60.0,  # 4.8 hours remaining (20% of 24h)
        }
        proportional_seconds = priority_early_warning_map.get(priority, baseline_seconds)
        return max(baseline_seconds, proportional_seconds)

    def start(self) -> None:
        """Start the background watcher loop if enabled."""
        if not settings.SLA_WATCHER_ENABLED:
            logger.info("SLABreachWatcherDaemon is disabled by configuration (SLA_WATCHER_ENABLED=False).")
            return

        if self.is_running:
            logger.warning("SLABreachWatcherDaemon is already running.")
            return

        self.is_running = True
        self._task = asyncio.create_task(self._watch_loop(), name="SLABreachWatcherDaemon")
        logger.info(
            f"SLABreachWatcherDaemon started successfully (Interval: {self.interval_seconds}s, "
            f"Target Compliance: >={self.target_threshold}%, Warning: {self.warning_minutes}m, "
            f"Manager: {self.manager_email})."
        )

    async def stop(self) -> None:
        """Gracefully stop the background watcher loop."""
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("SLABreachWatcherDaemon stopped cleanly.")

    async def _watch_loop(self) -> None:
        """Continuous execution loop with error isolation."""
        while self.is_running:
            try:
                await self.audit_breaches_and_compliance()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error(f"Error during SLA breach watcher execution: {exc}", exc_info=True)

            try:
                await asyncio.sleep(self.interval_seconds)
            except asyncio.CancelledError:
                break

    async def audit_breaches_and_compliance(self, db: Optional[AsyncSession] = None) -> Dict[str, Any]:
        """Core audit cycle: checks individual ticket deadlines and queue-wide compliance."""
        if db is not None:
            return await self._execute_audit_cycle(db)

        async with AsyncSessionLocal() as session:
            return await self._execute_audit_cycle(session)

    async def _execute_audit_cycle(self, db: AsyncSession) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        results = {
            "evaluated_at": now.isoformat(),
            "breaches_escalated": 0,
            "proactive_warnings_issued": 0,
            "executive_alert_triggered": False,
            "compliance_rate": 100.0,
        }

        stmt = (
            select(Inquiry)
            .options(selectinload(Inquiry.messages))
            .where(Inquiry.status.in_(["UNASSIGNED", "CLAIMED", "PENDING_CUSTOMER"]))
        )
        res = await db.execute(stmt)
        active_inquiries: List[Inquiry] = list(res.scalars().all())

        if not active_inquiries:
            return results

        sns_service = get_sns_service()
        email_service = get_email_service()

        in_bounds_count = 0
        breached_count = 0
        overdue_inquiries: List[Inquiry] = []
        manager_recipients = await self._resolve_operations_manager_recipients(db)

        for inquiry in active_inquiries:
            # If the ticket is in PENDING_CUSTOMER, its SLA clock is frozen
            if inquiry.status == "PENDING_CUSTOMER":
                in_bounds_count += 1
                continue

            deadline = inquiry.sla_deadline_at
            if deadline.tzinfo is None:
                deadline = deadline.replace(tzinfo=timezone.utc)

            if deadline >= now:
                in_bounds_count += 1
                remaining_seconds = (deadline - now).total_seconds()
                warning_threshold_seconds = self._compute_warning_threshold_seconds(inquiry.priority)

                if 0 < remaining_seconds <= warning_threshold_seconds:
                    entities = dict(inquiry.entities) if isinstance(inquiry.entities, dict) else {}
                    if not entities.get("sla_warning_alerted", False):
                        entities["sla_warning_alerted"] = True
                        entities["sla_warning_alerted_at"] = now.isoformat()
                        inquiry.entities = entities

                        remaining_minutes = max(1, int(remaining_seconds / 60))

                        warning_dict = {
                            "id": str(inquiry.id),
                            "customer_email": inquiry.customer_email,
                            "subject": inquiry.subject,
                            "priority": inquiry.priority,
                            "department": inquiry.department,
                            "urgency": inquiry.urgency,
                            "impact": inquiry.impact,
                            "churn_risk": inquiry.churn_risk,
                            "sla_deadline_at": inquiry.sla_deadline_at.isoformat(),
                            "event_type": "sla.warning",
                            "remaining_minutes": remaining_minutes,
                        }
                        await sns_service.publish_ops_alert(warning_dict)

                        for mgr_email in manager_recipients:
                            await email_service.send_proactive_sla_warning(
                                manager_email=mgr_email,
                                ticket_id=str(inquiry.id),
                                priority=inquiry.priority,
                                customer_name=inquiry.customer_name,
                                ticket_subject=inquiry.subject,
                                remaining_minutes=remaining_minutes,
                                department=inquiry.department,
                            )

                        audit_log = AuditLog(
                            inquiry_id=inquiry.id,
                            agent_id="SYSTEM:SLA_WATCHER",
                            action="SLA_WARNING_TRIGGERED",
                            previous_value={"sla_warning_alerted": False},
                            new_value={
                                "sla_warning_alerted": True,
                                "remaining_minutes": remaining_minutes,
                                "escalated_to": ", ".join(manager_recipients),
                            },
                            reason=(
                                f"Automated monitor identified impending SLA deadline ({remaining_minutes} minutes remaining). "
                                f"Dispatched proactive Ops Alert and supervisor warning to {', '.join(manager_recipients)}."
                            ),
                        )
                        db.add(audit_log)

                        short_id = str(inquiry.id)[:8].upper()
                        warning_msg = InquiryMessage(
                            inquiry_id=inquiry.id,
                            sender_type="SYSTEM",
                            sender_name="SLA Warning Engine",
                            sender_email="system@company.internal",
                            body=(
                                f"⏳ [PROACTIVE SLA WARNING] Ticket #{short_id} is within {remaining_minutes} minutes "
                                f"of breaching its contractual SLA deadline. Early warning notification dispatched to "
                                f"{', '.join(manager_recipients)} and ChatOps channel."
                            ),
                            is_internal_note=True,
                            attachments=[],
                            created_at=now,
                        )
                        db.add(warning_msg)
                        results["proactive_warnings_issued"] += 1
                        logger.warning(
                            f"Issued proactive SLA warning for inquiry #{short_id} (Priority: {inquiry.priority}, "
                            f"Remaining: {remaining_minutes}m, Customer: {inquiry.customer_name})"
                        )
            else:
                breached_count += 1
                overdue_inquiries.append(inquiry)

        total_active = len(active_inquiries)
        compliance_rate = round((in_bounds_count / total_active) * 100.0, 1) if total_active > 0 else 100.0
        results["compliance_rate"] = compliance_rate

        # 3. Process newly breached tickets (triggering escalation once per breach)
        for inquiry in overdue_inquiries:
            entities = dict(inquiry.entities) if isinstance(inquiry.entities, dict) else {}
            if not entities.get("sla_breach_alerted", False):
                entities["sla_breach_alerted"] = True
                entities["sla_breached_at"] = now.isoformat()
                inquiry.entities = entities

                deadline = inquiry.sla_deadline_at
                if deadline.tzinfo is None:
                    deadline = deadline.replace(tzinfo=timezone.utc)
                overdue_minutes = max(1, int((now - deadline).total_seconds() / 60))

                alert_dict = {
                    "id": str(inquiry.id),
                    "customer_email": inquiry.customer_email,
                    "subject": inquiry.subject,
                    "priority": inquiry.priority,
                    "department": inquiry.department,
                    "urgency": inquiry.urgency,
                    "impact": inquiry.impact,
                    "churn_risk": inquiry.churn_risk,
                    "sla_deadline_at": inquiry.sla_deadline_at.isoformat(),
                    "event_type": "sla.breached",
                    "overdue_minutes": overdue_minutes,
                }
                await sns_service.publish_ops_alert(alert_dict)

                for mgr_email in manager_recipients:
                    await email_service.send_sla_breach_escalation(
                        manager_email=mgr_email,
                        ticket_id=str(inquiry.id),
                        priority=inquiry.priority,
                        customer_name=inquiry.customer_name,
                        ticket_subject=inquiry.subject,
                        overdue_minutes=overdue_minutes,
                        department=inquiry.department,
                    )

                audit_log = AuditLog(
                    inquiry_id=inquiry.id,
                    agent_id="SYSTEM:SLA_WATCHER",
                    action="SLA_BREACH_ESCALATED",
                    previous_value={"sla_breach_alerted": False},
                    new_value={
                        "sla_breach_alerted": True,
                        "overdue_minutes": overdue_minutes,
                        "escalated_to": ", ".join(manager_recipients),
                    },
                    reason=(
                        f"Automated daemon detected contractual SLA resolution breach "
                        f"({overdue_minutes} minutes overdue). Dispatched Ops Alert and manager escalation to {', '.join(manager_recipients)}."
                    ),
                )
                db.add(audit_log)

                short_id = str(inquiry.id)[:8].upper()
                system_msg = InquiryMessage(
                    inquiry_id=inquiry.id,
                    sender_type="SYSTEM",
                    sender_name="SLA Escalation Engine",
                    sender_email="system@company.internal",
                    body=(
                        f"⚠️ [AUTOMATED SLA ESCALATION] Ticket #{short_id} has exceeded its resolution deadline "
                        f"by {overdue_minutes} minutes. High-priority incident notification dispatched to "
                        f"{', '.join(manager_recipients)} and ChatOps SNS topic."
                    ),
                    is_internal_note=True,
                    attachments=[],
                    created_at=now,
                )
                db.add(system_msg)

                results["breaches_escalated"] += 1
                logger.warning(
                    f"Escalated SLA breach for inquiry #{short_id} (Priority: {inquiry.priority}, "
                    f"Overdue: {overdue_minutes}m, Customer: {inquiry.customer_name})"
                )

        if compliance_rate < self.target_threshold and breached_count > 0:
            should_alert = False
            if self._last_executive_escalation_at is None:
                should_alert = True
            else:
                elapsed = (now - self._last_executive_escalation_at).total_seconds()
                if elapsed >= self.cooldown_seconds:
                    should_alert = True

            if should_alert:
                self._last_executive_escalation_at = now
                results["executive_alert_triggered"] = True

                for mgr_email in manager_recipients:
                    await email_service.send_compliance_threshold_alert(
                        manager_email=mgr_email,
                        current_compliance_rate=compliance_rate,
                        target_threshold=self.target_threshold,
                        breached_count=breached_count,
                        total_active=total_active,
                    )

                logger.error(
                    f"[EXECUTIVE ESCALATION] Active operational queue compliance dropped to {compliance_rate}% "
                    f"(Contractual SLO: >={self.target_threshold}%). Breached tickets: {breached_count}/{total_active}. "
                    f"Executive alert dispatched to {', '.join(manager_recipients)}."
                )

        await db.commit()
        return results


_sla_watcher_instance: Optional[SLABreachWatcherDaemon] = None


def get_sla_breach_watcher() -> SLABreachWatcherDaemon:
    """Singleton provider for SLABreachWatcherDaemon."""
    global _sla_watcher_instance
    if _sla_watcher_instance is None:
        _sla_watcher_instance = SLABreachWatcherDaemon()
    return _sla_watcher_instance
