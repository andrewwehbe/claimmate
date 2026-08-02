"""Coded claim models: the deterministic contract between coding and billing."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from rcm.models.encounter import ClinicalEncounter
from rcm.models.patient import PatientDemographics
from rcm.models.validators import (
    is_valid_icd10,
    is_valid_modifier,
    is_valid_pos,
    is_valid_procedure_code,
)


class CodedDiagnosis(BaseModel):
    code: str = Field(description="ICD-10-CM code, e.g. E11.9")
    description: str = Field(min_length=1)
    confidence: float = Field(ge=0.0, le=1.0)

    @field_validator("code")
    @classmethod
    def _icd10(cls, v: str) -> str:
        if not is_valid_icd10(v):
            raise ValueError(f"invalid ICD-10-CM format: {v}")
        return v


class CodedProcedure(BaseModel):
    code: str = Field(description="CPT or HCPCS Level II code")
    description: str = Field(min_length=1)
    modifiers: list[str] = Field(default_factory=list, max_length=4)
    units: int = Field(default=1, ge=1)
    charge: Decimal = Field(ge=0, description="Total line charge (fee x units)")
    diagnosis_pointers: list[int] = Field(
        min_length=1, max_length=4, description="1-based indexes into claim diagnoses"
    )
    confidence: float = Field(ge=0.0, le=1.0)

    @field_validator("code")
    @classmethod
    def _cpt(cls, v: str) -> str:
        if not is_valid_procedure_code(v):
            raise ValueError(f"invalid CPT/HCPCS format: {v}")
        return v

    @field_validator("modifiers")
    @classmethod
    def _mods(cls, v: list[str]) -> list[str]:
        for m in v:
            if not is_valid_modifier(m):
                raise ValueError(f"invalid modifier format: {m}")
        return v

    @field_validator("diagnosis_pointers")
    @classmethod
    def _pointers(cls, v: list[int]) -> list[int]:
        for p in v:
            if p < 1 or p > 12:
                raise ValueError(f"diagnosis pointer out of range 1-12: {p}")
        return v


class CodedClaim(BaseModel):
    claim_id: str = Field(min_length=1)
    patient: PatientDemographics
    encounter: ClinicalEncounter
    diagnoses: list[CodedDiagnosis] = Field(min_length=1, max_length=12)
    procedures: list[CodedProcedure] = Field(min_length=1)
    place_of_service: str = "11"
    overall_confidence: float = Field(ge=0.0, le=1.0)
    validation_flags: list[str] = Field(
        default_factory=list,
        description="Deterministic validation findings recorded during coding (NCCI etc.)",
    )
    prior_auth_number: str | None = None

    @field_validator("place_of_service")
    @classmethod
    def _pos(cls, v: str) -> str:
        if not is_valid_pos(v):
            raise ValueError(f"invalid place-of-service code: {v}")
        return v

    @property
    def total_charge(self) -> Decimal:
        return sum((p.charge for p in self.procedures), Decimal("0"))

    def diagnosis_for_pointer(self, pointer: int) -> CodedDiagnosis:
        return self.diagnoses[pointer - 1]
