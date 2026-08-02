"""Deterministic claim scrubber.

Every check is pure Python over the CodedClaim; no LLM involvement. Each
failed check yields a ScrubFinding with a severity; ERROR findings force
human review via the HITL router.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

from rcm.models.claim import CodedClaim, CodedProcedure
from rcm.models.hitl import ScrubFinding, Severity
from rcm.models.validators import is_em_code, is_lab_code, is_valid_npi
from rcm.rules.loader import load_rules_json
from rcm.rules.ncci import DISTINCT_SERVICE_MODIFIERS, NCCIRuleProvider

# Codes exempt from the modifier-25 pairing rule besides E/M and lab codes.
_MOD25_EXEMPT_CODES = frozenset({"36415"})
_TIMELY_FILING_WARN_MARGIN_DAYS = 14


class ClaimScrubber:
    def __init__(
        self,
        ncci: NCCIRuleProvider,
        prior_auth_cpt: set[str],
        medical_necessity: dict[str, list[str]],
        timely_filing_days: int,
    ) -> None:
        self._ncci = ncci
        self._prior_auth_cpt = prior_auth_cpt
        self._medical_necessity = medical_necessity
        self._timely_filing_days = timely_filing_days

    @classmethod
    def from_rules_dir(
        cls, ncci: NCCIRuleProvider, rules_dir: Path, timely_filing_days: int
    ) -> "ClaimScrubber":
        raw = load_rules_json(rules_dir, "scrub_rules.json")
        return cls(
            ncci=ncci,
            prior_auth_cpt=set(raw["prior_auth_cpt"]),
            medical_necessity=raw["medical_necessity"],
            timely_filing_days=timely_filing_days,
        )

    def scrub(
        self, claim: CodedClaim, billing_npi: str, submission_date: date
    ) -> list[ScrubFinding]:
        findings: list[ScrubFinding] = []
        findings.extend(self._check_modifier_25(claim))
        findings.extend(self._check_modifier_59(claim))
        findings.extend(self._check_prior_auth(claim))
        findings.extend(self._check_npis(claim, billing_npi))
        findings.extend(self._check_medical_necessity(claim))
        findings.extend(self._check_timely_filing(claim, submission_date))
        return findings

    # ------------------------------------------------------------------
    def _check_modifier_25(self, claim: CodedClaim) -> list[ScrubFinding]:
        em_lines = [p for p in claim.procedures if is_em_code(p.code)]
        procedural_lines = [
            p for p in claim.procedures if self._requires_mod25_pairing(p)
        ]
        findings: list[ScrubFinding] = []
        if not em_lines or not procedural_lines:
            return findings
        for em in em_lines:
            if "25" not in em.modifiers:
                paired = ", ".join(p.code for p in procedural_lines)
                findings.append(
                    ScrubFinding(
                        rule_id="MOD25_MISSING",
                        severity=Severity.ERROR,
                        message=(
                            f"E/M {em.code} billed with same-day procedure(s) {paired} "
                            f"but lacks modifier 25 (significant, separately identifiable E/M)"
                        ),
                        procedure_code=em.code,
                        field="modifiers",
                    )
                )
        return findings

    @staticmethod
    def _requires_mod25_pairing(proc: CodedProcedure) -> bool:
        code = proc.code
        if is_em_code(code) or is_lab_code(code) or code in _MOD25_EXEMPT_CODES:
            return False
        if not code.isdigit():
            return False  # HCPCS drugs/supplies do not trigger the E/M pairing rule
        n = int(code)
        return 10004 <= n <= 69990 or 90281 <= n <= 99199

    def _check_modifier_59(self, claim: CodedClaim) -> list[ScrubFinding]:
        findings: list[ScrubFinding] = []
        for a in claim.procedures:
            for b in claim.procedures:
                if a is b:
                    continue
                edit = self._ncci.ptp_edit(a.code, b.code)
                if (
                    edit is not None
                    and edit.modifier_indicator == "1"
                    and not (DISTINCT_SERVICE_MODIFIERS & set(b.modifiers))
                ):
                    findings.append(
                        ScrubFinding(
                            rule_id="MOD59_MISSING",
                            severity=Severity.ERROR,
                            message=(
                                f"{b.code} billed with {a.code} requires a distinct-service "
                                f"modifier (59/XE/XP/XS/XU): {edit.rationale}"
                            ),
                            procedure_code=b.code,
                            field="modifiers",
                        )
                    )
        return findings

    def _check_prior_auth(self, claim: CodedClaim) -> list[ScrubFinding]:
        findings: list[ScrubFinding] = []
        for proc in claim.procedures:
            if proc.code in self._prior_auth_cpt and not claim.prior_auth_number:
                findings.append(
                    ScrubFinding(
                        rule_id="PRIOR_AUTH_MISSING",
                        severity=Severity.ERROR,
                        message=(
                            f"{proc.code} requires prior authorization and no "
                            f"authorization number is on the claim"
                        ),
                        procedure_code=proc.code,
                        field="prior_auth_number",
                    )
                )
        return findings

    @staticmethod
    def _check_npis(claim: CodedClaim, billing_npi: str) -> list[ScrubFinding]:
        findings: list[ScrubFinding] = []
        if not is_valid_npi(claim.encounter.provider_npi):
            findings.append(
                ScrubFinding(
                    rule_id="RENDERING_NPI_INVALID",
                    severity=Severity.ERROR,
                    message=f"Rendering provider NPI fails checksum: {claim.encounter.provider_npi}",
                    field="provider_npi",
                )
            )
        if not is_valid_npi(billing_npi):
            findings.append(
                ScrubFinding(
                    rule_id="BILLING_NPI_INVALID",
                    severity=Severity.ERROR,
                    message=f"Billing provider NPI is missing or fails checksum: {billing_npi!r}",
                    field="billing_npi",
                )
            )
        return findings

    def _check_medical_necessity(self, claim: CodedClaim) -> list[ScrubFinding]:
        findings: list[ScrubFinding] = []
        for proc in claim.procedures:
            supported_prefixes = self._medical_necessity.get(proc.code)
            if supported_prefixes is None:
                continue
            pointed_dx = [claim.diagnosis_for_pointer(p).code for p in proc.diagnosis_pointers]
            if not any(
                dx.startswith(prefix) for dx in pointed_dx for prefix in supported_prefixes
            ):
                findings.append(
                    ScrubFinding(
                        rule_id="MEDICAL_NECESSITY_MISMATCH",
                        severity=Severity.WARNING,
                        message=(
                            f"{proc.code} is not supported by linked diagnoses "
                            f"{pointed_dx} per coverage table - denial risk (CARC 50)"
                        ),
                        procedure_code=proc.code,
                        field="diagnosis_pointers",
                    )
                )
        return findings

    def _check_timely_filing(
        self, claim: CodedClaim, submission_date: date
    ) -> list[ScrubFinding]:
        findings: list[ScrubFinding] = []
        elapsed = (submission_date - claim.encounter.service_date).days
        window = self._timely_filing_days
        if elapsed < 0:
            findings.append(
                ScrubFinding(
                    rule_id="SERVICE_DATE_FUTURE",
                    severity=Severity.ERROR,
                    message="Service date is after the submission date",
                    field="service_date",
                )
            )
        elif elapsed > window:
            findings.append(
                ScrubFinding(
                    rule_id="TIMELY_FILING_EXPIRED",
                    severity=Severity.ERROR,
                    message=(
                        f"Claim is {elapsed} days after service; payer filing window "
                        f"is {window} days (denial certain, CARC 29)"
                    ),
                    field="service_date",
                )
            )
        elif elapsed > window - _TIMELY_FILING_WARN_MARGIN_DAYS:
            findings.append(
                ScrubFinding(
                    rule_id="TIMELY_FILING_AT_RISK",
                    severity=Severity.WARNING,
                    message=(
                        f"Claim is {elapsed} days after service; filing window of "
                        f"{window} days closes in {window - elapsed} days"
                    ),
                    field="service_date",
                )
            )
        return findings
