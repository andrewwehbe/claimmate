"""CARC/RARC -> denial taxonomy classification. Deterministic.

The seed table (data/rules/carc_rarc.json) holds representative real codes.
Production: replace with the full X12 CARC/RARC code lists from x12.org/codes
keeping the same JSON shape - no code changes needed.
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from rcm.models.era import ClaimPayment, DenialAnalysis, DenialCategory
from rcm.rules.loader import load_rules_json

# Adjustment groups that represent payer-initiated non-payment (vs. patient
# responsibility), in priority order for picking the primary denial reason.
_DENIAL_GROUPS = ("CO", "PI", "OA")


class DenialClassifier:
    def __init__(self, rules_dir: Path) -> None:
        raw = load_rules_json(rules_dir, "carc_rarc.json")
        self._carc: dict[str, dict] = raw["carc"]
        self._rarc: dict[str, str] = raw["rarc"]

    def carc_description(self, code: str) -> str:
        entry = self._carc.get(code)
        return entry["description"] if entry else f"Unlisted adjustment reason code {code}"

    def rarc_description(self, code: str) -> str:
        return self._rarc.get(code, f"Unlisted remark code {code}")

    def analyze(self, claim: ClaimPayment) -> DenialAnalysis | None:
        """Classify a denied claim payment; returns None when the claim paid
        normally (nothing to work)."""
        if not claim.is_denied:
            return None

        primary = self._primary_denial_adjustment(claim)
        if primary is None:
            return None

        entry = self._carc.get(primary.reason_code)
        category = (
            DenialCategory(entry["category"]) if entry else DenialCategory.OTHER
        )
        appealable = bool(entry["appealable"]) if entry else True
        denied_amount = sum(
            (a.amount for a in claim.all_adjustments if a.group_code in _DENIAL_GROUPS),
            Decimal("0"),
        )
        rarcs = list(dict.fromkeys(claim.all_remark_codes))
        return DenialAnalysis(
            claim_id=claim.claim_id,
            category=category,
            carc_code=primary.reason_code,
            carc_description=self.carc_description(primary.reason_code),
            rarc_codes=rarcs,
            rarc_descriptions={c: self.rarc_description(c) for c in rarcs},
            denied_amount=denied_amount,
            is_appealable=appealable,
            notes=(
                "" if entry else
                f"CARC {primary.reason_code} not in local table; defaulted to OTHER/appealable"
            ),
        )

    @staticmethod
    def _primary_denial_adjustment(claim: ClaimPayment):
        candidates = [a for a in claim.all_adjustments if a.group_code in _DENIAL_GROUPS]
        if not candidates:
            return None
        return max(candidates, key=lambda a: a.amount)
