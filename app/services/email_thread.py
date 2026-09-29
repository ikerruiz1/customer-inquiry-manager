"""Inbound email thread correlation and quoted-reply normalization.

Responsibilities:
    1. Normalize reply subjects by removing RFC 5322 reply/forward prefixes.
    2. Extract the outbound RFC 5322 Message-ID references carried by In-Reply-To and References.
    3. Strip quoted conversation history so only newly authored text is persisted.
    4. Resolve the originating ticket using a deterministic three-tier correlation strategy.

Correlation tiers, evaluated in strict order:
    TIER_1_HEADER_TICKET_ID     X-Ticket-Id header carrying the full inquiry UUID.
    TIER_2_RFC5322_REFERENCES  In-Reply-To / References matched against persisted outbound Message-IDs.
    TIER_3_SUBJECT_REFERENCE   "[Ticket #XXXXXXXX]" token matched against the inquiry UUID prefix.
    TIER_4_SENDER_OPEN_THREAD  Unambiguous single PENDING_CUSTOMER ticket owned by the sender.
"""
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Sequence, Tuple
from uuid import UUID

from sqlalchemy import String, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inquiry import Inquiry, InquiryMessage

logger = logging.getLogger("app.services.email_thread")

# Subject token carrying the ticket reference emitted on every outbound notification.
TICKET_ID_REGEX = re.compile(r"\[\s*ticket\s*#\s*([0-9A-Za-z][0-9A-Za-z\-]{7,35})\s*\]", re.IGNORECASE)

# RFC 5322 / RFC 3676 reply and forward subject prefixes, repeatable and language aware.
REPLY_PREFIX_REGEX = re.compile(
    r"^\s*(?:(?:re|aw|sv|vs|fw|fwd|wg|tr|enc|encaminhado|rv|antw|res|odp|ynt)\s*(?:\[\d+\])?\s*:\s*)+",
    re.IGNORECASE,
)

# Angle-bracket delimited RFC 5322 Message-ID token.
MESSAGE_ID_TOKEN_REGEX = re.compile(r"<[^<>\s]{4,255}>")

# Hexadecimal UUID shape accepted for ticket reference resolution.
_UUID_PREFIX_REGEX = re.compile(r"^[0-9a-f]{8}[0-9a-f-]{0,31}$")

# Window applied to the sender-based fallback correlation tier.
SENDER_FALLBACK_WINDOW_DAYS = 30

# Attribution header keys emitted by desktop mail clients in quoted blocks.
_QUOTE_ATTRIBUTION_HEADERS = ("sent", "date", "to", "subject", "from", "reply-to")

# Markers delimiting quoted conversation history in plain text bodies.
_QUOTE_BOUNDARY_RES = (
    re.compile(r"^\s*>"),
    re.compile(r"^\s*-{2,}\s*original message\s*-{2,}\s*$", re.IGNORECASE),
    re.compile(r"^\s*-{2,}\s*forwarded message\s*-{2,}\s*$", re.IGNORECASE),
    re.compile(r"^\s*_{10,}\s*$"),
    re.compile(r"^\s*begin forwarded message\s*:\s*$", re.IGNORECASE),
    re.compile(r"^\s*on\b.{0,300}?\s+(wrote|escribio|escribió|schrieb|scrivait|écrit|ha\s+escrito)\b\s*:?\s*$", re.IGNORECASE),
    re.compile(r"^\s*(el|la|am|von)\b.{0,300}?\s+(escribio|escribió|schrieb)\b\s*:?\s*$", re.IGNORECASE),
    re.compile(r"^\s*at .{0,120}?, .{0,120}? wrote\s*:?\s*$", re.IGNORECASE),
    re.compile(r"^\s*in reply to\b", re.IGNORECASE),
    re.compile(r"^\s*how to reply\s*:?\s*$", re.IGNORECASE),
    re.compile(r"^\s*to reply,?\s*respond directly to this email", re.IGNORECASE),
    re.compile(r"^\s*-{2,}\s*$"),
)

_QUOTE_ATTRIBUTION_LINE_RES = tuple(
    re.compile(rf"^\s*{header}\s*:", re.IGNORECASE) for header in _QUOTE_ATTRIBUTION_HEADERS
)


def normalize_subject(subject: Optional[str]) -> str:
    """Remove repeated RFC 5322 reply/forward prefixes from a subject line."""
    if not subject:
        return ""
    cleaned = " ".join(subject.replace("\r", " ").replace("\n", " ").split())
    while True:
        stripped = REPLY_PREFIX_REGEX.sub("", cleaned, count=1).strip()
        if stripped == cleaned:
            return cleaned
        cleaned = stripped


def extract_ticket_reference(subject: Optional[str]) -> Optional[str]:
    """Extract the "[Ticket #XXXXXXXX]" reference token from a subject line."""
    if not subject:
        return None
    match = TICKET_ID_REGEX.search(subject)
    if not match:
        return None
    return match.group(1).strip().lower()


def extract_reference_message_ids(*header_values: Optional[str]) -> List[str]:
    """Collect RFC 5322 Message-ID tokens from In-Reply-To and References headers, preserving order."""
    references: List[str] = []
    for header_value in header_values:
        if not header_value:
            continue
        for token in MESSAGE_ID_TOKEN_REGEX.findall(header_value):
            normalized = token.strip()
            if normalized and normalized not in references:
                references.append(normalized)
    return references


def _is_attribution_block(lines: Sequence[str], index: int) -> bool:
    """Detect an Outlook style quoted block opening with 'From: ...' followed by attribution headers."""
    header_hits = 0
    for offset in range(index, min(index + 4, len(lines))):
        if any(pattern.match(lines[offset]) for pattern in _QUOTE_ATTRIBUTION_LINE_RES):
            header_hits += 1
    return header_hits >= 2


def strip_quoted_history(body: Optional[str]) -> str:
    """Remove quoted conversation history, retaining only newly authored text.

    Plain text replies carry the previous exchange as '>' prefixed lines or as an
    attribution block ('On <date> <sender> wrote:', '-----Original Message-----').
    Persisting that history duplicates content already stored in the ticket thread.
    """
    if not body:
        return ""

    lines = body.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    retained: List[str] = []
    for index, line in enumerate(lines):
        if any(pattern.search(line) for pattern in _QUOTE_BOUNDARY_RES):
            break
        if any(pattern.match(line) for pattern in _QUOTE_ATTRIBUTION_LINE_RES) and _is_attribution_block(lines, index):
            break
        retained.append(line)

    while retained and not retained[0].strip():
        retained.pop(0)
    while retained and not retained[-1].strip():
        retained.pop()

    return "\n".join(retained).strip()


async def _find_inquiry_by_reference(db: AsyncSession, reference: str) -> Optional[Inquiry]:
    """Resolve a ticket reference token to an Inquiry by exact UUID match or UUID prefix match."""
    normalized = (reference or "").strip().lower()
    if not normalized:
        return None

    try:
        exact_uuid = UUID(normalized)
    except (ValueError, AttributeError, TypeError):
        exact_uuid = None

    if exact_uuid is not None:
        res = await db.execute(select(Inquiry).where(Inquiry.id == exact_uuid).limit(1))
        exact_hit = res.scalars().first()
        if exact_hit is not None:
            return exact_hit

    if not _UUID_PREFIX_REGEX.match(normalized):
        return None

    res = await db.execute(select(Inquiry).where(cast(Inquiry.id, String).ilike(f"{normalized}%")).limit(1))
    return res.scalars().first()


async def _find_inquiry_by_message_id(db: AsyncSession, message_id: str) -> Optional[Inquiry]:
    """Resolve an inbound In-Reply-To / References token to the originating Inquiry."""
    res = await db.execute(select(InquiryMessage).where(InquiryMessage.provider_message_id == message_id).limit(1))
    message_row = res.scalars().first()
    if message_row is None:
        return None
    res = await db.execute(select(Inquiry).where(Inquiry.id == message_row.inquiry_id).limit(1))
    return res.scalars().first()


def _is_within_fallback_window(inquiry: Inquiry) -> bool:
    """Evaluate the sender-based correlation window using the ticket's last mutation timestamp."""
    reference_time = inquiry.updated_at or inquiry.created_at
    if reference_time is None:
        return False
    if reference_time.tzinfo is None:
        reference_time = reference_time.replace(tzinfo=timezone.utc)
    return reference_time >= datetime.now(timezone.utc) - timedelta(days=SENDER_FALLBACK_WINDOW_DAYS)


async def resolve_inbound_ticket(
    db: AsyncSession,
    *,
    customer_email: Optional[str],
    subject: Optional[str] = None,
    reference_message_ids: Optional[Sequence[str]] = None,
    ticket_reference: Optional[str] = None,
) -> Tuple[Optional[Inquiry], Optional[str]]:
    """Resolve the ticket an inbound email belongs to.

    Returns:
        (inquiry, strategy) where inquiry is None when no unambiguous correlation exists.
    """
    if ticket_reference:
        inquiry = await _find_inquiry_by_reference(db, ticket_reference)
        if inquiry is not None:
            logger.info(f"Inbound email correlated to ticket {inquiry.id} via X-Ticket-Id header.")
            return inquiry, "TIER_1_HEADER_TICKET_ID"

    for message_id in reference_message_ids or []:
        inquiry = await _find_inquiry_by_message_id(db, message_id)
        if inquiry is not None:
            logger.info(f"Inbound email correlated to ticket {inquiry.id} via RFC 5322 references.")
            return inquiry, "TIER_2_RFC5322_REFERENCES"

    reference = extract_ticket_reference(normalize_subject(subject))
    if reference:
        inquiry = await _find_inquiry_by_reference(db, reference)
        if inquiry is not None:
            logger.info(f"Inbound email correlated to ticket {inquiry.id} via subject reference token.")
            return inquiry, "TIER_3_SUBJECT_REFERENCE"
        logger.warning(f"Subject referenced ticket '{reference}' but no matching inquiry exists.")

    normalized_email = (customer_email or "").strip().lower()
    if normalized_email:
        res = await db.execute(
            select(Inquiry)
            .where(func.lower(Inquiry.customer_email) == normalized_email, Inquiry.status == "PENDING_CUSTOMER")
            .order_by(Inquiry.updated_at.desc())
        )
        candidates = [row for row in res.scalars().all() if _is_within_fallback_window(row)]
        if len(candidates) == 1:
            logger.info(
                f"Inbound email correlated to ticket {candidates[0].id} via unambiguous sender open thread."
            )
            return candidates[0], "TIER_4_SENDER_OPEN_THREAD"
        if len(candidates) > 1:
            logger.warning(
                f"Sender {normalized_email} has {len(candidates)} concurrent PENDING_CUSTOMER tickets. "
                "Sender-based correlation is ambiguous; falling back to new inquiry ingestion."
            )

    return None, None
