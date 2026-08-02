"""Structured-output schema for clinical note extraction (LLM response model)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ExtractedField(BaseModel):
    value: str
    confidence: float = Field(ge=0.0, le=1.0)


class NoteExtraction(BaseModel):
    """What the LLM returns for one unstructured chart note."""

    chief_complaint: ExtractedField
    hpi: ExtractedField
    diagnoses: list[str] = Field(default_factory=list)
    diagnoses_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    procedures: list[str] = Field(default_factory=list)
    procedures_confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    provider_npi: str | None = None
    provider_name: str | None = None
    service_date: str | None = Field(default=None, description="ISO date YYYY-MM-DD")
    warnings: list[str] = Field(default_factory=list)
