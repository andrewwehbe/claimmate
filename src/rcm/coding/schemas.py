"""Structured-output schemas for LLM code suggestion (validated deterministically
afterwards by the CodingAgent - suggestions are never trusted directly)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class DiagnosisSuggestion(BaseModel):
    code: str = Field(description="ICD-10-CM code")
    description: str
    confidence: float = Field(ge=0.0, le=1.0)


class ProcedureSuggestion(BaseModel):
    code: str = Field(description="CPT or HCPCS code")
    description: str
    modifiers: list[str] = Field(default_factory=list)
    units: int = Field(default=1, ge=1)
    confidence: float = Field(ge=0.0, le=1.0)


class CodeSuggestions(BaseModel):
    diagnoses: list[DiagnosisSuggestion] = Field(default_factory=list)
    procedures: list[ProcedureSuggestion] = Field(default_factory=list)
