"""Inbound email validation and automated bounce / NDR / loop detection filter."""
import re
import logging
from typing import Optional, Tuple

logger = logging.getLogger("app.services.email_filter")

# Recognized automated sender addresses (RFC 3834 / RFC 5321)
AUTOMATED_SENDERS = (
    "mailer-daemon@",
    "postmaster@",
    "noreply@",
    "no-reply@",
    "donotreply@",
    "auto-reply@",
    "bounce@",
    "bounces@",
)

# Common Non-Delivery Report / Delivery Status Notification subject patterns
NDR_SUBJECT_PATTERNS = [
    re.compile(r"delivery status notification", re.IGNORECASE),
    re.compile(r"undelivered mail returned to sender", re.IGNORECASE),
    re.compile(r"mail delivery failed", re.IGNORECASE),
    re.compile(r"failure notice", re.IGNORECASE),
    re.compile(r"returned mail: see transcript", re.IGNORECASE),
    re.compile(r"delivery failure", re.IGNORECASE),
    re.compile(r"undeliverable:", re.IGNORECASE),
    re.compile(r"warning: could not send message", re.IGNORECASE),
    re.compile(r"\[EXECUTIVE ALERT\]", re.IGNORECASE),
    re.compile(r"\[EARLY WARNING\]", re.IGNORECASE),
    re.compile(r"\[PROACTIVE SLA WARNING\]", re.IGNORECASE),
    re.compile(r"\[AUTOMATED SLA ESCALATION\]", re.IGNORECASE),
]

# Body signatures indicating bounce / delivery error messages
NDR_BODY_PATTERNS = [
    re.compile(r"an error occurred while trying to deliver the mail", re.IGNORECASE),
    re.compile(r"the following recipient\(s\) could not be reached", re.IGNORECASE),
    re.compile(r"action: failed", re.IGNORECASE),
    re.compile(r"status: 5\.\d+\.\d+", re.IGNORECASE),
]


def is_automated_delivery_failure_or_loop(
    sender_email: str,
    subject: str,
    body: str,
    auto_submitted_header: Optional[str] = None,
) -> Tuple[bool, str]:
    """Inspect inbound email parameters to detect and filter out bounces and automated loop messages.

    Returns:
        (is_filtered: bool, reason: str)
    """
    clean_sender = (sender_email or "").strip().lower()
    clean_subject = (subject or "").strip()
    clean_body = (body or "").strip()

    # 1. Inspect RFC 3834 Auto-Submitted header
    if auto_submitted_header:
        header_val = auto_submitted_header.strip().lower()
        if header_val not in ("no", ""):
            return True, f"Auto-Submitted header detected: '{auto_submitted_header}'"

    # 2. Check for automated daemon sender addresses or corporate support addresses (preventing self-loops)
    from app.core.config import settings
    support_addr = (getattr(settings, "SUPPORT_EMAIL", "") or "").lower().strip()
    if support_addr and clean_sender == support_addr:
        return True, f"Inbound loop prevented: sender is company support mailbox ({clean_sender})"

    for daemon_prefix in AUTOMATED_SENDERS:
        if clean_sender.startswith(daemon_prefix) or f"<{daemon_prefix}" in clean_sender:
            return True, f"Automated sender detected: {clean_sender}"

    # 3. Check subject patterns
    for pat in NDR_SUBJECT_PATTERNS:
        if pat.search(clean_subject):
            return True, f"NDR subject matched: '{pat.pattern}'"

    # 4. Check body patterns for bounce signatures
    for bpat in NDR_BODY_PATTERNS:
        if bpat.search(clean_body):
            return True, f"Delivery failure body matched: '{bpat.pattern}'"

    return False, ""


# Regex signatures for formal sign-offs in email bodies (supporting both newline and inline sign-offs)
_SIGN_OFF_REGEX = re.compile(
    r"(?:best\s+regards|warm\s+regards|kind\s+regards|with\s+regards|regards|sincerely|thanks\s+and\s+regards|thanks|thank\s+you|cheers|atentamente|saludos|un\s+saludo)"
    r"[,:\s]+([A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+)+)",
    re.IGNORECASE,
)


def extract_customer_name_from_body(body: str, fallback_name: Optional[str] = None, sender_email: Optional[str] = None) -> str:
    """Intelligently infer customer full name from email body sign-off.
    
    If the customer signed their message (e.g. 'Best regards, Alexander Wright'),
    this sign-off name takes precedence over generic Gmail/IMAP display names (e.g. 'Iker')
    or raw email address prefixes.
    """
    if body:
        match = _SIGN_OFF_REGEX.search(body)
        if match:
            inferred_name = match.group(1).strip()
            # Sanity check: must be reasonable length and not look like a URL or generic team
            if 3 <= len(inferred_name) <= 50 and not any(w in inferred_name.lower() for w in ["support", "team", "team,", "http", "www", "admin"]):
                return inferred_name

    if fallback_name and fallback_name.strip() and "@" not in fallback_name:
        return fallback_name.strip()

    if sender_email and "@" in sender_email:
        prefix = sender_email.split("@")[0].replace(".", " ").replace("_", " ").title()
        return prefix

    return fallback_name or "Valued Customer"

