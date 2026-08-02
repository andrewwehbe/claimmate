"""Eligibility verification models (X12 270 inquiry / 271 response domain)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field, field_validator

from rcm.models.validators import is_valid_npi


class CoverageStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    TERMINATED = "terminated"
    NOT_FOUND = "not_found"


class EligibilityRequest(BaseModel):
    """The data carried by a 270 inquiry.

    Carries the full 2100C subscriber identity (name + DOB), because real
    payers match on name/DOB/member ID together - a member-ID-only inquiry
    would be AAA-rejected.
    """

    member_id: str = Field(min_length=1)
    subscriber_last_name: str = Field(min_length=1)
    subscriber_first_name: str = Field(min_length=1)
    subscriber_dob: date
    payer_id: str = Field(min_length=1)
    provider_npi: str
    service_date: date

    @field_validator("provider_npi")
    @classmethod
    def _npi(cls, v: str) -> str:
        if not is_valid_npi(v):
            raise ValueError(f"invalid provider NPI on eligibility inquiry: {v}")
        return v


class EligibilityResult(BaseModel):
    """The adjudicated answer derived from a 271 response.

    `status` is the effective status ON THE SERVICE DATE: a member whose
    coverage terminated before the DOS comes back TERMINATED even if the
    payer record says the plan itself is active.

    Termination boundary convention: `termination_date` is the LAST COVERED
    DAY - a DOS equal to the termination date is still ACTIVE; the first
    uncovered day is termination_date + 1. Payers that express termination
    as "first uncovered day" must be normalized to this convention when
    loading their rosters.
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
