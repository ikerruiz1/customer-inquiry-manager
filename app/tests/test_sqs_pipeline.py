"""Unit and integration tests for Enterprise SQS FIFO Ingestion Buffer and Consumer Worker Daemon."""
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inquiry import Inquiry
from app.services.sqs_service import get_sqs_service
from app.services.sqs_consumer import get_sqs_consumer
from app.api.v1.inquiries import process_and_persist_inquiry


@pytest.mark.asyncio
async def test_sqs_service_enqueue_and_receive():
    """Verify SQS service buffers, retrieves, and acknowledges messages."""
    sqs = get_sqs_service()
    payload = {
        "channel": "EMAIL",
        "customer_email": "sqs.tester@enterprise.com",
        "customer_name": "SQS Tester",
        "subject": "Test Inquiry for SQS FIFO Buffer",
        "body": "Validating FIFO message ordering and deduplication.",
    }

    initial_depth = await sqs.get_queue_depth()
    tracking_id = await sqs.send_inquiry(payload, group_id="test-group")
    assert tracking_id is not None

    # Verify queue depth increased
    new_depth = await sqs.get_queue_depth()
    assert new_depth == initial_depth + 1

    # Receive message
    messages = await sqs.receive_inquiries(max_messages=5, wait_time_seconds=1)
    assert len(messages) >= 1
    received = next(m for m in messages if m["body"].get("customer_email") == "sqs.tester@enterprise.com")
    assert received["body"]["subject"] == "Test Inquiry for SQS FIFO Buffer"

    # Delete message
    deleted = await sqs.delete_inquiry(received["receipt_handle"])
    assert deleted is True


@pytest.mark.asyncio
async def test_sqs_consumer_processes_and_persists_inquiry(db_session: AsyncSession):
    """Verify SQS consumer daemon deserializes queue message and commits ticket to PostgreSQL."""
    consumer = get_sqs_consumer()
    test_body = {
        "channel": "WEB_FORM",
        "customer_email": "async.customer@company.com",
        "customer_name": "Async Customer",
        "subject": "Double charged for enterprise subscription",
        "body": "I see two identical charges on my corporate credit card for invoice #INV-9821.",
    }

    # Execute processing step
    await consumer._process_single_message(test_body, process_and_persist_inquiry, db=db_session)

    # Verify inquiry was persisted in PostgreSQL
    stmt = select(Inquiry).where(Inquiry.customer_email == "async.customer@company.com")
    res = await db_session.execute(stmt)
    inquiry = res.scalar_one_or_none()

    assert inquiry is not None
    assert inquiry.customer_name == "Async Customer"
    assert inquiry.department == "BILLING"
    assert inquiry.priority in ["P1", "P2"]
    assert inquiry.sla_deadline_at is not None


@pytest.mark.asyncio
async def test_sqs_consumer_graceful_handling_on_fallback():
    """Verify consumer processes unusual payloads without throwing uncaught exceptions."""
    consumer = get_sqs_consumer()
    unusual_body = {
        "channel": "UNKNOWN_CHANNEL",
        "customer_email": "fallback.user@example.com",
        "customer_name": "Fallback User",
        "subject": "General help question",
        "body": "Just asking general guidance.",
    }

    # Should execute gracefully and fall back to WEB_FORM
    await consumer._process_single_message(unusual_body, process_and_persist_inquiry)
