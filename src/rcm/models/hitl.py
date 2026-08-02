"""Scrub findings and human-in-the-loop routing models."""

from __future__ import annotations

from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field


class Severity(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


class ScrubFinding(BaseModel):
    rule_id: str = Field(min_length=1, description="e.g. 'MOD25_MISSING'")
    severity: Severity
    message: str = Field(min_length=1)
    procedure_code: str | None = None
    field: str | None = None


class RoutingDecision(BaseModel):
    route_to_human: bool
    reasons: list[str] = Field(default_factory=list)


class HITLQueueItem(BaseModel):
    item_id: str
    claim_id: str
    reasons: list[str]
    confidence: float = Field(ge=0.0, le=1.0)
    claim_value: Decimal
    findings: list[ScrubFinding] = Field(default_factory=list)
