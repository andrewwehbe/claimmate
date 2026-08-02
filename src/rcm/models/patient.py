"""Patient demographics. All instances in this repo are synthetic."""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from rcm.models.validators import is_sane_dob


class PatientDemographics(BaseModel):
    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    date_of_birth: date
    gender: Literal["M", "F", "U"] = "U"
    member_id: str = Field(min_length=1, description="Payer member/subscriber ID")
    group_number: str | None = None
    payer_name: str = Field(min_length=1)
    payer_id: str = Field(min_length=1, description="Payer EDI ID")
    address_line1: str = Field(min_length=1)
    city: str = Field(min_length=1)
    state: str = Field(pattern=r"^[A-Z]{2}$")
    zip_code: str = Field(pattern=r"^\d{5}(-\d{4})?$")

    @field_validator("date_of_birth")
    @classmethod
    def _dob_sanity(cls, v: date) -> date:
        if not is_sane_dob(v):
            raise ValueError("date_of_birth fails sanity check (future or >130 years old)")
        return v
