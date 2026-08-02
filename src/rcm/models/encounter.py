"""Clinical encounter extracted from an unstructured chart note."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field, field_validator

from rcm.models.validators import is_valid_npi, is_valid_pos


class ClinicalEncounter(BaseModel):
    encounter_id: str = Field(min_length=1)
    service_date: date
    chief_complaint: str = Field(min_length=1)
    hpi: str = Field(default="", description="History of present illness narrative")
    diagnoses: list[str] = Field(min_length=1, description="Free-text diagnosis statements")
    procedures: list[str] = Field(
        default_factory=list,
        description="Free-text procedure/service statements (may be empty if the Plan section was missing)",
    )
    provider_npi: str
    provider_name: str = Field(min_length=1)
    place_of_service: str = "11"
    field_confidence: dict[str, float] = Field(
        default_factory=dict,
        description="Extraction confidence per field, 0.0-1.0",
    )
    extraction_warnings: list[str] = Field(default_factory=list)

    @field_validator("provider_npi")
    @classmethod
    def _npi(cls, v: str) -> str:
        if not is_valid_npi(v):
            raise ValueError(f"invalid NPI (format or Luhn check failed): {v}")
        return v

    @field_validator("place_of_service")
    @classmethod
    def _pos(cls, v: str) -> str:
        if not is_valid_pos(v):
            raise ValueError(f"invalid place-of-service code: {v}")
        return v

    @field_validator("field_confidence")
    @classmethod
    def _conf(cls, v: dict[str, float]) -> dict[str, float]:
        for key, score in v.items():
            if not 0.0 <= score <= 1.0:
                raise ValueError(f"confidence for '{key}' out of range [0,1]: {score}")
        return v

    def min_confidence(self) -> float:
        """Lowest per-field extraction confidence (1.0 if none recorded)."""
        return min(self.field_confidence.values(), default=1.0)

    def summary(self) -> str:
        """Compact clinical summary used in appeal context (no direct identifiers)."""
        return (
            f"Encounter on {self.service_date.isoformat()} (POS {self.place_of_service}). "
            f"Chief complaint: {self.chief_complaint}. "
            f"Diagnoses: {'; '.join(self.diagnoses)}. "
            f"Services: {'; '.join(self.procedures) if self.procedures else 'not documented'}."
        )
