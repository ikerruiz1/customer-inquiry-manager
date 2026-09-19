"""Asynchronous SQS FIFO Consumer Worker Daemon (Leaky-Bucket Rate Governor)."""
import asyncio
import logging
from typing import Optional, Dict, Any

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.schemas.inquiry import InquiryCreate, ChannelEnum
from app.services.bedrock_service import get_bedrock_service
from app.services.sns_service import get_sns_service
from app.services.sqs_service import get_sqs_service

logger = logging.getLogger("app.services.sqs_consumer")


class SQSConsumerDaemon:
    """Asynchronous worker pulling and draining customer inquiries from SQS FIFO."""

    def __init__(self, session_factory=None):
        self.sqs = get_sqs_service()
        self.bedrock = get_bedrock_service()
        self.sns = get_sns_service()
        self.session_factory = session_factory or AsyncSessionLocal
        self.batch_size = settings.SQS_CONSUMER_BATCH_SIZE
        self.poll_interval = settings.SQS_CONSUMER_POLL_INTERVAL_SECONDS
        self._running = False
        self._task: Optional[asyncio.Task] = None

    def start(self):
        """Start the background consumer worker loop."""
        if not settings.SQS_CONSUMER_ENABLED:
            logger.info("SQS Consumer daemon is disabled via configuration.")
            return

        if self._running:
            logger.warning("SQS Consumer daemon is already active.")
            return

        self._running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("Started Enterprise SQS FIFO Consumer Daemon.")

    async def stop(self):
        """Signal cancellation and wait for current in-flight batch to drain."""
        if not self._running:
            return

        logger.info("Stopping SQS Consumer daemon...")
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("SQS Consumer daemon stopped successfully.")

    async def _run_loop(self):
        """Continuous polling and batch processing loop."""
        # Defer import to avoid circular dependencies with inquiries API router
        from app.api.v1.inquiries import process_and_persist_inquiry

        while self._running:
            try:
                # 1. Pull batch from SQS FIFO buffer (long-polling)
                messages = await self.sqs.receive_inquiries(
                    max_messages=self.batch_size,
                    wait_time_seconds=int(self.poll_interval),
                )

                if not messages:
                    await asyncio.sleep(self.poll_interval)
                    continue

                logger.info(f"SQS Consumer received batch of {len(messages)} inquiry message(s).")

                # 2. Process each message sequentially to respect FIFO ordering
                for msg in messages:
                    receipt_handle = msg["receipt_handle"]
                    body = msg["body"]

                    try:
                        await self._process_single_message(body, process_and_persist_inquiry)
                        # Acknowledge and delete message upon successful transaction commit
                        await self.sqs.delete_inquiry(receipt_handle)
                    except Exception as exc:
                        logger.error(
                            f"Failed to process inquiry message {msg.get('message_id')}: {exc}. "
                            "Message visibility will lapse for automatic retry or DLQ redrive."
                        )
                        # We intentionally DO NOT delete from SQS, allowing redrive to DLQ after 3 failures

            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error(f"Unexpected error in SQS consumer loop: {exc}")
                await asyncio.sleep(2.0)

    async def _process_single_message(self, body: Dict[str, Any], process_fn, db: Optional[Any] = None):
        """Process an individual deserialized message payload."""
        import re
        from sqlalchemy import select, cast, String
        from sqlalchemy.orm import selectinload
        from app.models.inquiry import Inquiry
        from app.schemas.inquiry import CustomerReplyCreate
        from app.api.v1.inquiries import post_customer_reply

        subject = body.get("subject", "")

        async def _execute_with_session(session):
            # 1. Thread Correlation: Check if inbound message is a customer reply to an existing ticket
            ticket_match = re.search(r"(?:\[Ticket #|Ticket #)([A-Fa-f0-9\-]{8,36})\]?", subject)
            if ticket_match:
                short_id = ticket_match.group(1).lower()
                stmt = (
                    select(Inquiry)
                    .options(selectinload(Inquiry.messages))
                    .where(cast(Inquiry.id, String).ilike(f"{short_id}%"))
                )
                res = await session.execute(stmt)
                existing_inquiry = res.scalar_one_or_none()
                if existing_inquiry:
                    logger.info(f"SQS Consumer matched existing ticket {existing_inquiry.id}. Routing as customer reply.")
                    reply_create = CustomerReplyCreate(
                        body=body.get("body", "Customer replied via email."),
                        customer_name=body.get("customer_name") or body.get("customer_email", "").split("@")[0],
                        customer_email=body.get("customer_email"),
                    )
                    await post_customer_reply(inquiry_id=existing_inquiry.id, payload=reply_create, db=session)
                    await session.commit()
                    return

            # 2. Ingest as new inquiry
            channel_str = body.get("channel", "WEB_FORM")
            try:
                channel = ChannelEnum(channel_str)
            except ValueError:
                channel = ChannelEnum.WEB_FORM

            inquiry_in = InquiryCreate(
                channel=channel,
                customer_email=body.get("customer_email", "user@customer.com"),
                customer_name=body.get("customer_name", "Anonymous Customer"),
                subject=body.get("subject", "Inquiry via SQS Ingress Buffer"),
                body=body.get("body", "No inquiry text supplied."),
            )

            await process_fn(
                inquiry_in=inquiry_in,
                db=session,
                bedrock=self.bedrock,
                sns=self.sns,
            )
            await session.commit()

        if db is not None:
            await _execute_with_session(db)
        else:
            async with self.session_factory() as session:
                await _execute_with_session(session)



_sqs_consumer_instance: Optional[SQSConsumerDaemon] = None


def get_sqs_consumer() -> SQSConsumerDaemon:
    """Dependency provider returning singleton SQSConsumerDaemon instance."""
    global _sqs_consumer_instance
    if _sqs_consumer_instance is None:
        _sqs_consumer_instance = SQSConsumerDaemon()
    return _sqs_consumer_instance
