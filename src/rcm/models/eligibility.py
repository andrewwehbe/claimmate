"""Eligibility verification models (X12 270 inquiry / 271 response domain)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field


class CoverageStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    TERMINATED = "terminated"
    NOT_FOUND = "not_found"


class EligibilityRequest(BaseModel):
    """The data carried by a 270 inquiry."""

    member_id: str = Field(min_length=1)
    payer_id: str = Field(min_length=1)
    provider_npi: str = Field(min_length=10, max_length=10)
    service_date: date


class EligibilityResult(BaseModel):
    """The adjudicated answer derived from a 271 response.

    `status` is the effective status ON THE SERVICE DATE: a member whose
    coverage terminated before the DOS comes back TERMINATED even if the
    payer record says the plan itself is active.
    """

    member_id: str
    status: CoverageStatus
    plan_name: str | None = None
    copay: Decimal | None = None
    deductible_remaining: Decimal | None = None
    termination_date: date | None = None
    service_date: date
    notes: str = ""

    @property
    def is_active(self) -> bool:
        return self.status == CoverageStatus.ACTIVE
