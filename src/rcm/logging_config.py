"""Structured logging with PHI redaction.

Every log event passes through redact_phi before rendering: any key whose
name matches a PHI field is replaced with [REDACTED], recursively, and
SSN-shaped strings are masked defensively. Log claim IDs and codes, never
identities.
"""

from __future__ import annotations

import re
from typing import Any

import structlog

PHI_KEYS = frozenset(
    {
        "first_name",
        "last_name",
        "patient_name",
        "name",
        "dob",
        "date_of_birth",
        "member_id",
        "subscriber_id",
        "group_number",
        "mrn",
        "ssn",
        "address",
        "address_line1",
        "city",
        "zip_code",
        "phone",
        "email",
    }
)

_SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")

REDACTED = "[REDACTED]"


def _scrub(value: Any, key: str | None = None) -> Any:
    if key is not None and key.lower() in PHI_KEYS:
        return REDACTED
    if isinstance(value, dict):
        return {k: _scrub(v, k) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_scrub(v) for v in value]
    if isinstance(value, str):
        return _SSN_RE.sub(REDACTED, value)
    return value


def redact_phi(
    logger: Any, method_name: str, event_dict: dict[str, Any]
) -> dict[str, Any]:
    """structlog processor: redact PHI keys and SSN-shaped strings."""
    return {k: _scrub(v, k) for k, v in event_dict.items()}


def configure_logging() -> None:
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            redact_phi,
            structlog.dev.ConsoleRenderer(colors=False),
        ],
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)
