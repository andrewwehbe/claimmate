"""Appeal models. Citations are always sourced from the local reference file
(data/rules/citations.json), never from LLM memory, to prevent fabricated
regulation citations."""

from __future__ import annotations

from decimal import Decimal
from enum import Enum

from pydantic import BaseModel, Field

from rcm.models.era import DenialCategory


class AppealLevel(str, Enum):
    """Escalation ladder for a denial. Each upheld decision may escalate to
    the next level; external review is terminal."""

    RECONSIDERATION = "reconsideration"
    LEVEL_1 = "level_1"
    LEVEL_2 = "level_2"
    EXTERNAL_REVIEW = "external_review"

    def next_level(self) -> "AppealLevel | None":
        order = list(AppealLevel)
        index = order.index(self)
        return order[index + 1] if index + 1 < len(order) else None


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
    level: AppealLevel = AppealLevel.RECONSIDERATION
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
    level: AppealLevel = AppealLevel.RECONSIDERATION
    subject: str
    body: str = Field(min_length=1)
    citations: list[Citation]
    generated_by: str = Field(description="LLM client class used for drafting")
