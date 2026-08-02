"""ERA / X12 835 remittance models and the denial taxonomy."""

from __future__ import annotations

from decimal import Decimal
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class DenialCategory(str, Enum):
    MEDICAL_NECESSITY = "medical_necessity"
    CODING_ERROR = "coding_error"
    AUTH_MISSING = "auth_missing"
    TIMELY_FILING = "timely_filing"
    COB = "cob"
    PATIENT_RESPONSIBILITY = "patient_responsibility"
    CONTRACTUAL = "contractual"
    OTHER = "other"


class Adjustment(BaseModel):
    """One CAS adjustment: group code + CARC reason code + amount."""

    group_code: Literal["CO", "PR", "OA", "PI", "CR"]
    reason_code: str = Field(min_length=1, description="CARC, e.g. '50'")
    amount: Decimal
    quantity: int | None = None


class ServiceLinePayment(BaseModel):
    procedure_code: str
    charge_amount: Decimal
    paid_amount: Decimal
    adjustments: list[Adjustment] = Field(default_factory=list)
    remark_codes: list[str] = Field(default_factory=list, description="RARCs, e.g. 'N115'")


class ClaimPayment(BaseModel):
    claim_id: str = Field(description="Submitter claim ID (CLP01)")
    status_code: int = Field(description="CLP02: 1=paid primary, 2=paid secondary, 3=paid tertiary, 4=denied, 22=reversal")
    charge_amount: Decimal
    paid_amount: Decimal
    patient_responsibility: Decimal = Decimal("0")
    payer_claim_number: str | None = None
    adjustments: list[Adjustment] = Field(default_factory=list, description="Claim-level CAS")
    remark_codes: list[str] = Field(default_factory=list, description="Claim-level RARCs")
    service_lines: list[ServiceLinePayment] = Field(default_factory=list)

    @property
    def is_denied(self) -> bool:
        return self.status_code == 4 or (
            self.paid_amount == 0 and any(a.group_code in ("CO", "PI") for a in self.all_adjustments)
        )

    @property
    def all_adjustments(self) -> list[Adjustment]:
        out = list(self.adjustments)
        for line in self.service_lines:
            out.extend(line.adjustments)
        return out

    @property
    def all_remark_codes(self) -> list[str]:
        out = list(self.remark_codes)
        for line in self.service_lines:
            out.extend(line.remark_codes)
        return out


class ERA835(BaseModel):
    payer_name: str
    payer_id: str | None = None
    payee_name: str | None = None
    payee_npi: str | None = None
    payment_amount: Decimal
    payment_method: str = Field(description="BPR04, e.g. ACH, CHK, NON")
    payment_date: str = Field(pattern=r"^\d{8}$")
    trace_number: str | None = None
    claims: list[ClaimPayment] = Field(default_factory=list)


class DenialAnalysis(BaseModel):
    """Deterministic classification of one denied claim payment."""

    claim_id: str
    category: DenialCategory
    carc_code: str
    carc_description: str
    rarc_codes: list[str] = Field(default_factory=list)
    rarc_descriptions: dict[str, str] = Field(default_factory=dict)
    denied_amount: Decimal
    is_appealable: bool
    notes: str = ""
