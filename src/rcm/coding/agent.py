"""Autonomous coding agent.

Flow: ClinicalEncounter -> LLM code suggestions -> deterministic validation.
The LLM only proposes codes. Format validation, NCCI PTP/MUE/mutually-
exclusive checks, fee assignment, and the confidence formula are pure Python.
Any suggested code that fails format validation is rejected and flagged,
never silently corrected.
"""

from __future__ import annotations

from decimal import Decimal
from itertools import combinations, permutations
from pathlib import Path

from pydantic import BaseModel, Field, ValidationError

from rcm.coding.schemas import CodeSuggestions
from rcm.llm.base import LLMClient
from rcm.models.claim import CodedClaim, CodedDiagnosis, CodedProcedure
from rcm.models.encounter import ClinicalEncounter
from rcm.models.patient import PatientDemographics
from rcm.rules.loader import load_rules_json
from rcm.rules.ncci import DISTINCT_SERVICE_MODIFIERS, NCCIRuleProvider

SYSTEM_PROMPT = (
    "You are a certified professional coder. Map the encounter's diagnoses and "
    "services to ICD-10-CM and CPT/HCPCS codes. Suggest only codes directly "
    "supported by the documentation, with a confidence per code."
)

# Each deterministic NCCI violation multiplies down the validation score.
VIOLATION_PENALTY = 0.25


class RejectedCode(BaseModel):
    code: str
    kind: str = Field(description="'diagnosis' or 'procedure'")
    reason: str


class CodingResult(BaseModel):
    claim: CodedClaim | None
    rejected_codes: list[RejectedCode] = Field(default_factory=list)
    violations: list[str] = Field(default_factory=list)
    validation_score: float = Field(ge=0.0, le=1.0)
    failure_reason: str | None = None


class CodingAgent:
    def __init__(self, llm: LLMClient, ncci: NCCIRuleProvider, rules_dir: Path) -> None:
        self._llm = llm
        self._ncci = ncci
        raw = load_rules_json(rules_dir, "fee_schedule.json")
        self._fees: dict[str, Decimal] = {k: Decimal(v) for k, v in raw["fees"].items()}
        self._default_fee = Decimal(raw["default_fee"])

    def code(
        self,
        encounter: ClinicalEncounter,
        patient: PatientDemographics,
        claim_id: str,
    ) -> CodingResult:
        suggestions = self._llm.generate(
            CodeSuggestions, SYSTEM_PROMPT, self._build_prompt(encounter)
        )
        return self.validate_suggestions(suggestions, encounter, patient, claim_id)

    @staticmethod
    def _build_prompt(encounter: ClinicalEncounter) -> str:
        dx_lines = "\n".join(f"- {d}" for d in encounter.diagnoses)
        proc_lines = "\n".join(f"- {p}" for p in encounter.procedures)
        return (
            f"Encounter {encounter.encounter_id}, date of service "
            f"{encounter.service_date.isoformat()}, POS {encounter.place_of_service}.\n"
            f"Chief complaint: {encounter.chief_complaint}\n"
            f"DIAGNOSES:\n{dx_lines}\n"
            f"PROCEDURES:\n{proc_lines}\n"
        )

    def validate_suggestions(
        self,
        suggestions: CodeSuggestions,
        encounter: ClinicalEncounter,
        patient: PatientDemographics,
        claim_id: str,
    ) -> CodingResult:
        """Deterministic validation of LLM output. Public so tests can feed
        adversarial suggestions directly."""
        rejected: list[RejectedCode] = []
        diagnoses: list[CodedDiagnosis] = []
        for dx in suggestions.diagnoses:
            try:
                diagnoses.append(
                    CodedDiagnosis(
                        code=dx.code, description=dx.description, confidence=dx.confidence
                    )
                )
            except ValidationError as exc:
                rejected.append(
                    RejectedCode(code=dx.code, kind="diagnosis", reason=_first_error(exc))
                )

        procedures: list[CodedProcedure] = []
        if diagnoses:
            pointers = list(range(1, min(len(diagnoses), 4) + 1))
            for proc in suggestions.procedures:
                fee = self._fees.get(proc.code, self._default_fee)
                try:
                    procedures.append(
                        CodedProcedure(
                            code=proc.code,
                            description=proc.description,
                            modifiers=proc.modifiers,
                            units=proc.units,
                            charge=fee * proc.units,
                            diagnosis_pointers=pointers,
                            confidence=proc.confidence,
                        )
                    )
                except ValidationError as exc:
                    rejected.append(
                        RejectedCode(code=proc.code, kind="procedure", reason=_first_error(exc))
                    )

        if not diagnoses or not procedures:
            return CodingResult(
                claim=None,
                rejected_codes=rejected,
                violations=[],
                validation_score=0.0,
                failure_reason=(
                    "no valid diagnosis codes" if not diagnoses else "no valid procedure codes"
                ),
            )

        violations = self._ncci_violations(procedures)
        validation_score = max(0.0, 1.0 - VIOLATION_PENALTY * len(violations))

        code_confidences = [d.confidence for d in diagnoses] + [p.confidence for p in procedures]
        min_confidence = min([encounter.min_confidence(), *code_confidences])
        overall = round(min_confidence * validation_score, 4)

        claim = CodedClaim(
            claim_id=claim_id,
            patient=patient,
            encounter=encounter,
            diagnoses=diagnoses,
            procedures=procedures,
            place_of_service=encounter.place_of_service,
            overall_confidence=overall,
            validation_flags=violations,
        )
        return CodingResult(
            claim=claim,
            rejected_codes=rejected,
            violations=violations,
            validation_score=validation_score,
        )

    def _ncci_violations(self, procedures: list[CodedProcedure]) -> list[str]:
        violations: list[str] = []

        for a, b in permutations(procedures, 2):
            edit = self._ncci.ptp_edit(a.code, b.code)
            if edit is None:
                continue
            if edit.modifier_indicator == "0":
                violations.append(
                    f"NCCI PTP: {edit.column2} is bundled into {edit.column1} and is never "
                    f"separately payable ({edit.rationale})"
                )
            elif not (DISTINCT_SERVICE_MODIFIERS & set(b.modifiers)):
                violations.append(
                    f"NCCI PTP: {edit.column2} with {edit.column1} requires a distinct-service "
                    f"modifier (59/XE/XP/XS/XU) ({edit.rationale})"
                )

        for proc in procedures:
            limit = self._ncci.mue_limit(proc.code)
            if limit is not None and proc.units > limit.max_units:
                violations.append(
                    f"NCCI MUE: {proc.code} billed {proc.units} units, limit is "
                    f"{limit.max_units} ({limit.rationale})"
                )

        for a, b in combinations(procedures, 2):
            if self._ncci.mutually_exclusive(a.code, b.code):
                violations.append(
                    f"NCCI mutually exclusive: {a.code} and {b.code} may never be reported together"
                )

        return violations


def _first_error(exc: ValidationError) -> str:
    err = exc.errors()[0]
    return str(err.get("msg", "validation failed"))
