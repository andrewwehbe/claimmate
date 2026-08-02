"""Pydantic envelope model for an 837P transaction.

The segment-level representation (typed dataclasses + renderer) lives in
rcm.claims.edi837; this model is the validated input to that builder.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

from rcm.models.claim import CodedClaim
from rcm.models.validators import is_valid_npi


class BillingProvider(BaseModel):
    organization_name: str = Field(min_length=1)
    npi: str
    tax_id: str = Field(pattern=r"^\d{9}$", description="EIN, digits only")
    address_line1: str = Field(min_length=1)
    city: str = Field(min_length=1)
    state: str = Field(pattern=r"^[A-Z]{2}$")
    zip_code: str = Field(pattern=r"^\d{5}(-\d{4})?$")
    contact_name: str = Field(min_length=1)
    contact_phone: str = Field(pattern=r"^\d{10}$")

    @field_validator("npi")
    @classmethod
    def _npi(cls, v: str) -> str:
        if not is_valid_npi(v):
            raise ValueError(f"invalid billing provider NPI: {v}")
        return v


class InterchangeConfig(BaseModel):
    """Deterministic envelope metadata. Control numbers and timestamps are
    supplied by the caller (never generated from wall-clock time) so output
    is reproducible and golden-file testable."""

    sender_id: str = Field(min_length=2, max_length=15)
    receiver_id: str = Field(min_length=2, max_length=15)
    receiver_name: str = Field(min_length=1)
    interchange_control_number: int = Field(ge=1, le=999_999_999)
    group_control_number: int = Field(ge=1, le=999_999_999)
    transaction_control_number: str = Field(pattern=r"^\d{4,9}$")
    date_yyyymmdd: str = Field(pattern=r"^\d{8}$")
    time_hhmm: str = Field(pattern=r"^\d{4}$")
    usage_indicator: str = Field(default="T", pattern=r"^[TP]$")


class EDI837P(BaseModel):
    """Complete, validated input for rendering one professional claim to X12 837P."""

    interchange: InterchangeConfig
    billing_provider: BillingProvider
    claim: CodedClaim
