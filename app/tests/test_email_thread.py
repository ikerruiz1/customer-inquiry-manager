"""Tests for inbound email thread correlation, quoted-reply normalization, and outbound email shape."""
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inquiry import Inquiry, InquiryMessage
from app.schemas.inquiry import DepartmentEnum, PriorityEnum
from app.services.email_thread import (
    extract_reference_message_ids,
    extract_ticket_reference,
    normalize_subject,
    resolve_inbound_ticket,
    strip_quoted_history,
)


def test_normalize_subject_strips_language_aware_reply_prefix_chain():
    assert normalize_subject("Re: Fwd: RE: [Ticket #A1B2C3D4] Routing Options") == "[Ticket #A1B2C3D4] Routing Options"
    assert normalize_subject("AW: [Ticket #A1B2C3D4] Routing Options") == "[Ticket #A1B2C3D4] Routing Options"
    assert normalize_subject("Routing Options") == "Routing Options"
    assert normalize_subject(None) == ""


def test_extract_ticket_reference_reads_uppercase_token():
    subject = "Re: [Ticket #4B1C9E2A] Routing Options & Autoscaling for Your eCommerce App"
    assert extract_ticket_reference(subject) == "4b1c9e2a"


def test_extract_reference_message_ids_collects_unique_tokens_in_order():
    refs = extract_reference_message_ids(
        "<first@mail.example.com>",
        "<first@mail.example.com> <second@mail.example.com>",
    )
    assert refs == ["<first@mail.example.com>", "<second@mail.example.com>"]


def test_strip_quoted_history_removes_angle_bracket_thread():
    raw = (
        "Peak QPS is about 4,200 and we do get holiday spikes.\n"
        "\n"
        "> Hello,\n"
        "> Could you please share the following details?\n"
        "> Best regards,\n"
        "> Support Team"
    )
    assert strip_quoted_history(raw) == "Peak QPS is about 4,200 and we do get holiday spikes."


def test_strip_quoted_history_removes_attribution_and_original_message_blocks():
    raw = (
        "Yes, autoscaling is enabled.\n"
        "\n"
        "On Mon, 3 Mar 2026 at 10:00, ExampleCorp Support <support@example-corp.tech> wrote:\n"
        "Could you please share the following details?\n"
        "\n"
        "-----Original Message-----\n"
        "From: support@example-corp.tech\n"
        "Sent: Monday, March 3, 2026 10:00\n"
        "Subject: Routing Options\n"
    )
    assert strip_quoted_history(raw) == "Yes, autoscaling is enabled."


def test_strip_quoted_history_removes_outlook_from_attribution_block():
    raw = (
        "Attaching the architecture diagram.\n"
        "\n"
        "From: ExampleCorp Support\n"
        "Sent: Monday, March 3, 2026 10:00\n"
        "To: Gero Nimodo\n"
        "Subject: Routing Options\n"
        "\n"
        "Please share the following details.\n"
    )
    assert strip_quoted_history(raw) == "Attaching the architecture diagram."


def test_strip_quoted_history_preserves_plain_text_without_quotes():
    raw = "My invoice number is INV-4471 and the charge is 49.00 EUR."
    assert strip_quoted_history(raw) == raw


async def _seed_ticket(db: AsyncSession, customer_email: str, status: str) -> Inquiry:
    from datetime import datetime, timedelta, timezone

    inquiry = Inquiry(
        channel="EMAIL",
        customer_email=customer_email,
        customer_name="Gero Nimodo",
        subject="Routing Options & Autoscaling for Your eCommerce App",
        body="We are evaluating edge routing options for our storefront.",
        status=status,
        department=DepartmentEnum.SALES.value,
        priority=PriorityEnum.P2.value,
        urgency=3,
        impact=2,
        sentiment_score=0.1,
        churn_risk=False,
        entities={},
        sla_deadline_at=datetime.now(timezone.utc) + timedelta(hours=4),
    )
    db.add(inquiry)
    await db.flush()
    return inquiry


async def test_resolve_inbound_ticket_prefers_header_ticket_id(db_session: AsyncSession):
    target = await _seed_ticket(db_session, "tier1-header@example.com", "PENDING_CUSTOMER")
    other = await _seed_ticket(db_session, "tier1-header@example.com", "CLAIMED")
    await db_session.commit()

    resolved, strategy = await resolve_inbound_ticket(
        db_session,
        customer_email="tier1-header@example.com",
        subject="totally unrelated subject",
        ticket_reference=str(target.id),
    )

    assert resolved is not None
    assert resolved.id == target.id
    assert resolved.id != other.id
    assert strategy == "TIER_1_HEADER_TICKET_ID"


async def test_resolve_inbound_ticket_prefers_rfc5322_reference_over_subject(db_session: AsyncSession):
    target = await _seed_ticket(db_session, "tier1-refs@example.com", "PENDING_CUSTOMER")
    other = await _seed_ticket(db_session, "tier1-refs@example.com", "CLAIMED")
    db_session.add(
        InquiryMessage(
            inquiry_id=other.id,
            sender_type="AGENT",
            sender_name="Support",
            sender_email="support@example-corp.tech",
            body="Please share your configuration.",
            is_internal_note=False,
            attachments=[],
            provider_message_id="<outbound-abc@mail.example.com>",
        )
    )
    await db_session.commit()

    inquiry, strategy = await resolve_inbound_ticket(
        db_session,
        customer_email="tier1-refs@example.com",
        subject="Totally unrelated subject",
        reference_message_ids=["<unknown@mail.example.com>", "<outbound-abc@mail.example.com>"],
    )

    assert inquiry is not None
    assert inquiry.id == other.id
    assert strategy == "TIER_2_RFC5322_REFERENCES"
    assert inquiry.id != target.id


async def test_resolve_inbound_ticket_by_subject_reference(db_session: AsyncSession):
    inquiry = await _seed_ticket(db_session, "tier1-subject@example.com", "PENDING_CUSTOMER")
    await db_session.commit()
    short_id = str(inquiry.id)[:8].upper()

    resolved, strategy = await resolve_inbound_ticket(
        db_session,
        customer_email="tier1-subject@example.com",
        subject=f"Re: Fwd: [Ticket #{short_id}] Routing Options & Autoscaling",
    )

    assert resolved is not None
    assert resolved.id == inquiry.id
    assert strategy == "TIER_3_SUBJECT_REFERENCE"


async def test_resolve_inbound_ticket_by_sender_open_thread(db_session: AsyncSession):
    inquiry = await _seed_ticket(db_session, "tier1-sender@example.com", "PENDING_CUSTOMER")
    await db_session.commit()

    resolved, strategy = await resolve_inbound_ticket(
        db_session,
        customer_email="Tier1-Sender@Example.com",
        subject="here is the info you asked for",
    )

    assert resolved is not None
    assert resolved.id == inquiry.id
    assert strategy == "TIER_4_SENDER_OPEN_THREAD"


async def test_resolve_inbound_ticket_refuses_ambiguous_sender_open_threads(db_session: AsyncSession):
    await _seed_ticket(db_session, "tier1-ambiguous@example.com", "PENDING_CUSTOMER")
    await _seed_ticket(db_session, "tier1-ambiguous@example.com", "PENDING_CUSTOMER")
    await db_session.commit()

    resolved, strategy = await resolve_inbound_ticket(
        db_session,
        customer_email="tier1-ambiguous@example.com",
        subject="no ticket token here",
    )

    assert resolved is None
    assert strategy is None


async def test_freeze_email_has_single_greeting_and_no_portal_link():
    from app.services.email_service import EmailService

    service = EmailService()
    draft = (
        "Hello Gero,\n\n"
        "Thank you for contacting ExampleCorp Technologies.\n\n"
        "1. Peak request volume: roughly 4,200 requests per minute.\n"
        "2. Regions: primarily EU and US-East.\n\n"
        "Best regards,\nExampleCorp Technologies Support Team"
    )

    delivery = await service.send_customer_notification(
        customer_email="gero@example.com",
        customer_name="Gero Nimodo",
        ticket_id="4b1c9e2a-1111-2222-3333-444455556666",
        ticket_subject="Routing Options & Autoscaling for Your eCommerce App",
        message_body=draft,
        action_type="REQUEST_INFO",
        agent_name="Support Specialist",
    )
    outbox_entry = service.outbox[-1]
    body = outbox_entry["body"]

    assert body.count("Hello ") == 1
    assert body.count("Best regards") == 1
    assert body.count("ExampleCorp Technologies Support Team") == 1
    assert "http://" not in body
    assert "https://" not in body
    assert "View online" not in body
    assert "You have received an update from" not in body
    assert body.startswith("Hello Gero,")
    assert body.rstrip().endswith("Reply directly to this email to continue this ticket.")
    assert delivery["message_id"].startswith("<") and delivery["message_id"].endswith(">")
    assert delivery["subject"] == "[Ticket #4B1C9E2A] Routing Options & Autoscaling for Your eCommerce App"


async def test_customer_reply_to_freeze_email_is_persisted_into_the_same_ticket(
    client, db_session: AsyncSession, monkeypatch
):
    """Regression: the inbound poller must commit the correlated reply.

    The poller used to flush the customer reply and let the session close without committing,
    silently discarding every customer email reply.
    """
    from app.services.inbound_email_poller import InboundEmailPoller
    from app.services.email_service import get_email_service
    from app.tests.conftest import TestSessionFactory

    create_res = await client.post(
        "/api/v1/inquiries/",
        json={
            "channel": "EMAIL",
            "customer_email": "gero.nimodo@example.com",
            "customer_name": "Gero Nimodo",
            "subject": "Routing Options & Autoscaling for Your eCommerce App",
            "body": "We need edge routing guidance for our storefront.",
        },
    )
    assert create_res.status_code == 201
    inquiry_id = create_res.json()["id"]

    await client.patch(f"/api/v1/inquiries/{inquiry_id}/claim")
    freeze_res = await client.post(
        f"/api/v1/inquiries/{inquiry_id}/messages",
        json={
            "body": (
                "Hello Gero,\n\n"
                "To size the routing layer correctly, could you share your peak request volume?\n\n"
                "Best regards,\nExampleCorp Technologies Support Team"
            ),
            "action": "REQUEST_INFO",
        },
    )
    assert freeze_res.status_code == 201

    outbound = get_email_service().outbox[-1]
    assert (await client.get(f"/api/v1/inquiries/{inquiry_id}")).json()["status"] == "PENDING_CUSTOMER"

    poller = InboundEmailPoller()
    monkeypatch.setattr("app.services.inbound_email_poller.AsyncSessionLocal", TestSessionFactory)

    accepted = await poller._dispatch_parsed_email(
        customer_name="Gero Nimodo",
        customer_email="gero.nimodo@example.com",
        subject=f"Re: {outbound['subject']}",
        body=(
            "Peak volume is 4,200 requests per minute with December spikes.\n"
            "\n"
            "On Mon, 3 Mar 2026 at 10:00, ExampleCorp Support <support@example-corp.tech> wrote:\n"
            "Hello Gero,\n"
            "> To size the routing layer correctly, could you share your peak request volume?"
        ),
        reference_message_ids=[outbound["message_id"]],
    )
    assert accepted is True

    resumed = (await client.get(f"/api/v1/inquiries/{inquiry_id}")).json()
    assert resumed["status"] == "CLAIMED"
    assert resumed["sla_paused_at"] is None

    thread = (await client.get(f"/api/v1/inquiries/{inquiry_id}/messages")).json()
    customer_messages = [m for m in thread if m["sender_type"] == "CUSTOMER"]
    assert len(customer_messages) == 2
    assert customer_messages[-1]["body"] == "Peak volume is 4,200 requests per minute with December spikes."
