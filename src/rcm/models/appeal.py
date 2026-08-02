"""Appeal models. Citations are always sourced from the local reference file
(data/rules/citations.json), never from LLM memory, to prevent fabricated
regulation citations."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, Field

from rcm.models.era import DenialCategory


class Citation(BaseModel):
    source: str = Field(min_length=1, description="e.g. 'Social Security Act'")
    reference: str = Field(min_length=1, description="e.g. 'SSA 1862(a)(1)(A)'")
    summary: str = Field(min_length=1)


class DisputedService(BaseModel):
    procedure_code: str
    description: str
    charge_amount: Decimal


class AppealContext(BaseModel):
    """Structured, deterministic input handed to the LLM for letter drafting."""

    claim_id: str
    payer_name: str
    denial_category: DenialCategory
    carc_code: str
    carc_description: str
    rarc_codes: list[str] = Field(default_factory=list)
    rarc_descriptions: dict[str, str] = Field(default_factory=dict)
    clinical_summary: str
    disputed_services: list[DisputedService] = Field(default_factory=list)
    denied_amount: Decimal
    citations: list[Citation] = Field(
        default_factory=list,
        description="Loaded from local reference JSON only - never LLM-generated",
    )


class AppealLetter(BaseModel):
    claim_id: str
    subject: str
    body: str = Field(min_length=1)
    citations: list[Citation]
    generated_by: str = Field(description="LLM client class used for drafting")
