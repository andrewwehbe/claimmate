"""Structured-output schema for LLM appeal letter drafting."""

from __future__ import annotations

from pydantic import BaseModel, Field


class AppealDraft(BaseModel):
    subject: str = Field(min_length=1)
    body: str = Field(min_length=1, description="Letter body WITHOUT citations - the references section is appended deterministically from the local citation file")
