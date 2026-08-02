"""Deterministic MockLLM.

Implements the same LLMClient interface as the real Instructor-backed client,
but produces outputs via transparent heuristics (regex section parsing,
keyword-to-code lookup tables, template letter assembly). This lets the whole
test suite and demo run offline with zero API keys while exercising every
downstream deterministic validation path with realistic data.

The heuristics intentionally mimic LLM behavior including imperfection:
confidence drops when abbreviations had to be expanded or sections were
missing, so the HITL confidence-routing paths are exercised for real.
"""

from __future__ import annotations

import json
import re
from typing import TypeVar

from pydantic import BaseModel

from rcm.coding.schemas import CodeSuggestions, DiagnosisSuggestion, ProcedureSuggestion
from rcm.denials.schemas import AppealDraft
from rcm.extraction.schemas import ExtractedField, NoteExtraction
from rcm.llm.base import LLMClient

T = TypeVar("T", bound=BaseModel)

# --- clinical abbreviation expansion (longest-first to avoid partial hits) ---
ABBREVIATIONS: dict[str, str] = {
    "t2dm": "type 2 diabetes mellitus",
    "dm2": "type 2 diabetes mellitus",
    "htn": "hypertension",
    "hld": "hyperlipidemia",
    "sob": "shortness of breath",
    "uri": "upper respiratory infection",
    "c/o": "complains of",
    "f/u": "follow-up",
    "r/o": "rule out",
    "hx": "history of",
    "cp": "chest pain",
    "bmp": "basic metabolic panel",
    "ekg": "electrocardiogram",
    "est": "established",
    "pt": "patient",
}
_ABBREV_RE = re.compile(
    r"\b(" + "|".join(re.escape(k) for k in sorted(ABBREVIATIONS, key=len, reverse=True)) + r")\b",
    re.IGNORECASE,
)

_SECTION_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("subjective", re.compile(r"^\s*(?:subjective|subj|s)\s*[:.]", re.IGNORECASE)),
    ("objective", re.compile(r"^\s*(?:objective|obj|exam|o)\s*[:.]", re.IGNORECASE)),
    ("assessment", re.compile(r"^\s*(?:assessment|impression|a/p|a)\s*[:.]", re.IGNORECASE)),
    ("plan", re.compile(r"^\s*(?:plan|p)\s*[:?]", re.IGNORECASE)),
]

_NPI_RE = re.compile(r"\bNPI\s*[:#]?\s*(\d{10})\b", re.IGNORECASE)
_DATE_RE = re.compile(r"\b(?:date of service|dos|date)\s*[:]\s*(\d{4}-\d{2}-\d{2})", re.IGNORECASE)
_PROVIDER_RE = re.compile(r"^\s*(?:provider|prov|dr)\s*[:.]\s*(.+?)(?:\s*\(?NPI.*)?$", re.IGNORECASE)
_CC_RE = re.compile(r"(?:chief complaint|cc)\s*[:.]\s*(.+)", re.IGNORECASE)

# Keyword -> ICD-10-CM lookup used for code suggestion
_DX_MAP: list[tuple[str, str, str]] = [
    ("hypertension", "I10", "Essential (primary) hypertension"),
    ("type 2 diabetes", "E11.9", "Type 2 diabetes mellitus without complications"),
    ("chest pain", "R07.9", "Chest pain, unspecified"),
    ("shortness of breath", "R06.02", "Shortness of breath"),
    ("upper respiratory infection", "J06.9", "Acute upper respiratory infection, unspecified"),
    ("hyperlipidemia", "E78.5", "Hyperlipidemia, unspecified"),
    ("low back pain", "M54.50", "Low back pain, unspecified"),
    ("cough", "R05.9", "Cough, unspecified"),
    ("fatigue", "R53.83", "Other fatigue"),
    ("fever", "R50.9", "Fever, unspecified"),
]

# Keyword -> CPT lookup used for code suggestion
_PROC_MAP: list[tuple[str, str, str]] = [
    ("basic metabolic panel", "80048", "Basic metabolic panel (calcium, total)"),
    ("electrocardiogram", "93000", "Electrocardiogram, complete, 12-lead"),
    ("venipuncture", "36415", "Collection of venous blood by venipuncture"),
    ("chest x-ray", "71046", "Radiologic examination, chest, 2 views"),
    ("manual therapy", "97140", "Manual therapy techniques, each 15 minutes"),
    ("therapeutic activities", "97530", "Therapeutic activities, each 15 minutes"),
]

_PROCEDURE_KEYWORDS: list[tuple[str, str]] = [
    ("basic metabolic panel", "basic metabolic panel"),
    ("electrocardiogram", "electrocardiogram, 12-lead, in office"),
    ("venipuncture", "venipuncture"),
    ("chest x-ray", "chest x-ray, 2 views"),
    ("manual therapy", "manual therapy"),
    ("therapeutic activities", "therapeutic activities"),
]


def _expand_abbreviations(text: str) -> tuple[str, bool]:
    found = False

    def _sub(m: re.Match[str]) -> str:
        nonlocal found
        found = True
        return ABBREVIATIONS[m.group(1).lower()]

    return _ABBREV_RE.sub(_sub, text), found


class MockLLM(LLMClient):
    """Offline stand-in for the Instructor-backed client. Deterministic."""

    def generate(self, response_model: type[T], system_prompt: str, user_prompt: str) -> T:
        if response_model is NoteExtraction:
            return self._extract_note(user_prompt)  # type: ignore[return-value]
        if response_model is CodeSuggestions:
            return self._suggest_codes(user_prompt)  # type: ignore[return-value]
        if response_model is AppealDraft:
            return self._draft_appeal(user_prompt)  # type: ignore[return-value]
        raise ValueError(f"MockLLM has no handler for response model {response_model.__name__}")

    # ------------------------------------------------------------------ SOAP
    def _extract_note(self, note_text: str) -> NoteExtraction:
        warnings: list[str] = []
        sections: dict[str, list[str]] = {}
        preamble: list[str] = []
        current: str | None = None

        for raw_line in note_text.splitlines():
            line = raw_line.rstrip()
            if not line.strip():
                continue
            matched = False
            for name, pattern in _SECTION_PATTERNS:
                m = pattern.match(line)
                if m:
                    current = name
                    sections.setdefault(name, [])
                    remainder = line[m.end():].strip(" ?:.")
                    if remainder:
                        sections[name].append(remainder)
                    matched = True
                    break
            if matched:
                continue
            if current is None:
                preamble.append(line.strip())
            else:
                sections[current].append(line.strip())

        note_messy = False

        # provider / date metadata
        npi_match = _NPI_RE.search(note_text)
        provider_npi = npi_match.group(1) if npi_match else None
        provider_name = None
        for line in preamble:
            pm = _PROVIDER_RE.match(line)
            if pm:
                provider_name = pm.group(1).strip().rstrip(",")
                break
        date_match = _DATE_RE.search(note_text)
        service_date = date_match.group(1) if date_match else None
        if service_date is None:
            warnings.append("Service date not found in note")

        # chief complaint
        cc_match = _CC_RE.search(note_text)
        if cc_match:
            chief = ExtractedField(value=cc_match.group(1).strip(), confidence=0.96)
        else:
            candidates = sections.get("subjective", []) or [
                ln for ln in preamble if "complain" in ln.lower() or "c/o" in ln.lower()
            ]
            if candidates:
                expanded, was_abbrev = _expand_abbreviations(candidates[0])
                chief = ExtractedField(value=expanded, confidence=0.70)
                note_messy = note_messy or was_abbrev
                warnings.append("Chief complaint inferred (no explicit CC line)")
            else:
                chief = ExtractedField(value="Not documented", confidence=0.10)
                warnings.append("Chief complaint not found")

        # HPI narrative
        hpi_lines = sections.get("subjective")
        if hpi_lines is None:
            hpi_lines = [
                ln for ln in preamble
                if not _NPI_RE.search(ln) and not _DATE_RE.search(ln) and not _PROVIDER_RE.match(ln)
            ]
            hpi_conf = 0.70 if hpi_lines else 0.10
            if not sections:
                warnings.append("Note lacks standard SOAP section headers")
        else:
            hpi_conf = 0.95
        hpi_text, hpi_abbrev = _expand_abbreviations(" ".join(hpi_lines))
        if hpi_abbrev:
            hpi_conf = min(hpi_conf, 0.85)
            note_messy = True
        hpi = ExtractedField(value=hpi_text or "Not documented", confidence=hpi_conf)

        # diagnoses from the assessment section
        diagnoses: list[str] = []
        dx_conf = 0.95
        assessment_lines = sections.get("assessment", [])
        if not assessment_lines:
            warnings.append("Assessment section missing")
            dx_conf = 0.30
        statements: list[str] = []
        for line in assessment_lines:
            line = re.sub(r"^\d+[.)]\s*", "", line)
            statements.extend(s.strip() for s in re.split(r"[.;]\s+|[.;]$", line) if s.strip())
        for stmt in statements:
            expanded, was_abbrev = _expand_abbreviations(stmt)
            if was_abbrev:
                dx_conf = min(dx_conf, 0.85)
                note_messy = True
            diagnoses.append(expanded)

        # procedures from the plan section
        plan_lines = sections.get("plan")
        procedures: list[str] = []
        if plan_lines is None:
            warnings.append("Plan section missing - services inferred from visit context only")
            procedures.append("office visit, established patient, level unspecified")
            proc_conf = 0.50
        else:
            plan_text, plan_abbrev = _expand_abbreviations(" ".join(plan_lines))
            plan_lower = plan_text.lower()
            proc_conf = 0.93
            if plan_abbrev:
                proc_conf = 0.85
                note_messy = True
            for keyword, canonical in _PROCEDURE_KEYWORDS:
                if keyword in plan_lower:
                    procedures.append(canonical)
            if "glucose" in plan_lower:
                procedures.append("glucose, quantitative (fingerstick)")
            if "office visit" in plan_lower:
                level = "moderate complexity" if "moderate" in plan_lower else "low complexity"
                procedures.append(f"established patient office visit, {level}")
            if not procedures:
                warnings.append("No billable services recognized in Plan")
                proc_conf = 0.30

        return NoteExtraction(
            chief_complaint=chief,
            hpi=hpi,
            diagnoses=diagnoses,
            diagnoses_confidence=dx_conf,
            procedures=procedures,
            procedures_confidence=proc_conf,
            provider_npi=provider_npi,
            provider_name=provider_name,
            service_date=service_date,
            warnings=warnings,
        )

    # ---------------------------------------------------------------- coding
    def _suggest_codes(self, prompt: str) -> CodeSuggestions:
        dx_items = self._bulleted_block(prompt, "DIAGNOSES:")
        proc_items = self._bulleted_block(prompt, "PROCEDURES:")

        diagnoses: list[DiagnosisSuggestion] = []
        seen_dx: set[str] = set()
        for item in dx_items:
            lower = item.lower()
            for keyword, code, desc in _DX_MAP:
                if keyword in lower and code not in seen_dx:
                    seen_dx.add(code)
                    diagnoses.append(
                        DiagnosisSuggestion(code=code, description=desc, confidence=0.93)
                    )
                    break

        procedures: list[ProcedureSuggestion] = []
        seen_proc: set[str] = set()
        for item in proc_items:
            lower = item.lower()
            suggestion: ProcedureSuggestion | None = None
            if "office visit" in lower:
                if "level unspecified" in lower:
                    suggestion = ProcedureSuggestion(
                        code="99213",
                        description="Office visit, established patient (level assumed - undocumented)",
                        confidence=0.60,
                    )
                elif "moderate" in lower:
                    suggestion = ProcedureSuggestion(
                        code="99214",
                        description="Office visit, established patient, moderate MDM",
                        confidence=0.90,
                    )
                else:
                    suggestion = ProcedureSuggestion(
                        code="99213",
                        description="Office visit, established patient, low MDM",
                        confidence=0.93,
                    )
            elif "glucose" in lower and "panel" not in lower:
                suggestion = ProcedureSuggestion(
                    code="82947", description="Glucose, quantitative, blood", confidence=0.90
                )
            else:
                for keyword, code, desc in _PROC_MAP:
                    if keyword in lower:
                        suggestion = ProcedureSuggestion(
                            code=code, description=desc, confidence=0.92
                        )
                        break
            if suggestion and suggestion.code not in seen_proc:
                seen_proc.add(suggestion.code)
                procedures.append(suggestion)

        return CodeSuggestions(diagnoses=diagnoses, procedures=procedures)

    @staticmethod
    def _bulleted_block(prompt: str, header: str) -> list[str]:
        items: list[str] = []
        in_block = False
        for line in prompt.splitlines():
            stripped = line.strip()
            if stripped == header:
                in_block = True
                continue
            if in_block:
                if stripped.startswith("- "):
                    items.append(stripped[2:].strip())
                elif stripped:
                    break
        return items

    # --------------------------------------------------------------- appeals
    def _draft_appeal(self, prompt: str) -> AppealDraft:
        marker = "CONTEXT_JSON:"
        if marker not in prompt:
            raise ValueError("MockLLM appeal drafting expects a CONTEXT_JSON block in the prompt")
        context = json.loads(prompt.split(marker, 1)[1].strip())

        claim_id = context["claim_id"]
        payer = context["payer_name"]
        carc = context["carc_code"]
        carc_desc = context["carc_description"]
        denied = context["denied_amount"]

        service_lines = "\n".join(
            f"  - CPT {s['procedure_code']}: {s['description']} (billed {s['charge_amount']} USD)"
            for s in context.get("disputed_services", [])
        ) or "  - See enclosed claim detail."

        rarc_sentences = ""
        for code in context.get("rarc_codes", []):
            desc = context.get("rarc_descriptions", {}).get(code, "")
            rarc_sentences += f"The remittance further references remark code {code}: {desc} "

        body = (
            f"To the Appeals Department, {payer}:\n\n"
            f"We are writing to formally appeal the denial of claim {claim_id} and to "
            f"request reconsideration of the denied amount of {denied} USD.\n\n"
            f"Your remittance advice denied this claim under Claim Adjustment Reason Code "
            f"(CARC) {carc}: \"{carc_desc}\" {rarc_sentences.strip()}\n\n"
            f"Clinical background supporting the services billed:\n"
            f"{context['clinical_summary']}\n\n"
            f"Services in dispute:\n{service_lines}\n\n"
            f"The documentation of record demonstrates that the services rendered were "
            f"clinically indicated and consistent with the standards referenced below. "
            f"We respectfully request that the denial be overturned and the claim "
            f"reprocessed for payment. Supporting records are enclosed and available "
            f"upon request.\n\n"
            f"Sincerely,\nBilling Office"
        )
        subject = f"Formal appeal - claim {claim_id}, CARC {carc}"
        return AppealDraft(subject=subject, body=body)
