"""SOAP note -> ClinicalEncounter.

The LLM (via the LLMClient wrapper) performs the unstructured-to-structured
step; everything after that - NPI validation, date parsing, confidence
bookkeeping - is deterministic Python.
"""

from __future__ import annotations

from datetime import date

from pydantic import ValidationError

from rcm.extraction.schemas import NoteExtraction
from rcm.llm.base import LLMClient
from rcm.models.encounter import ClinicalEncounter

SYSTEM_PROMPT = (
    "You are a clinical documentation specialist. Extract the structured "
    "encounter from the chart note. Expand clinical abbreviations. Report a "
    "confidence between 0.0 and 1.0 for every field; lower it whenever you "
    "inferred, expanded, or guessed. List diagnoses from the assessment and "
    "billable services from the plan. Never invent content that is not in the note."
)


class ExtractionError(Exception):
    """Raised when a note cannot be converted into a valid ClinicalEncounter."""


class SOAPExtractor:
    def __init__(self, llm: LLMClient) -> None:
        self._llm = llm

    def extract(self, note_text: str, encounter_id: str) -> ClinicalEncounter:
        if not note_text.strip():
            raise ExtractionError("Empty note text")

        result: NoteExtraction = self._llm.generate(NoteExtraction, SYSTEM_PROMPT, note_text)

        if not result.provider_npi:
            raise ExtractionError(
                "Provider NPI not found in note; cannot build a billable encounter"
            )
        if not result.service_date:
            raise ExtractionError("Service date not found in note")
        try:
            service_date = date.fromisoformat(result.service_date)
        except ValueError as exc:
            raise ExtractionError(f"Unparseable service date: {result.service_date}") from exc
        if not result.diagnoses:
            raise ExtractionError("No diagnoses extracted; encounter is not codable")

        try:
            return ClinicalEncounter(
                encounter_id=encounter_id,
                service_date=service_date,
                chief_complaint=result.chief_complaint.value,
                hpi=result.hpi.value,
                diagnoses=result.diagnoses,
                procedures=result.procedures,
                provider_npi=result.provider_npi,
                provider_name=result.provider_name or "Unknown Provider",
                field_confidence={
                    "chief_complaint": result.chief_complaint.confidence,
                    "hpi": result.hpi.confidence,
                    "diagnoses": result.diagnoses_confidence,
                    "procedures": result.procedures_confidence,
                },
                extraction_warnings=result.warnings,
            )
        except ValidationError as exc:
            raise ExtractionError(f"Extracted encounter failed validation: {exc}") from exc
