"""Appeal filing deadlines per payer and level. Deterministic.

Windows load from data/rules/appeal_deadlines.json: a default table plus
per-payer overrides keyed by payer EDI ID. The deadline clock starts at the
denial date for a reconsideration, and at the prior level's decision date
for every escalation.
"""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

from rcm.models.appeal import AppealLevel
from rcm.rules.loader import load_rules_json


class AppealDeadlineRules:
    def __init__(self, rules_dir: Path, filename: str = "appeal_deadlines.json") -> None:
        raw = load_rules_json(rules_dir, filename)
        self._default: dict[str, int] = raw["default"]
        self._payers: dict[str, dict[str, int]] = raw.get("payers", {})
        missing = [lv.value for lv in AppealLevel if lv.value not in self._default]
        if missing:
            raise ValueError(
                f"appeal deadline defaults missing levels: {missing} in {filename}"
            )

    def window_days(self, payer_id: str | None, level: AppealLevel) -> int:
        overrides = self._payers.get(payer_id or "", {})
        return int(overrides.get(level.value, self._default[level.value]))

    def deadline(
        self, clock_start: date, payer_id: str | None, level: AppealLevel
    ) -> date:
        """Filing deadline for `level`, where clock_start is the denial date
        (reconsideration) or the prior level's decision date (escalations)."""
        return clock_start + timedelta(days=self.window_days(payer_id, level))

    def days_remaining(
        self, clock_start: date, payer_id: str | None, level: AppealLevel, today: date
    ) -> int:
        """Days until the filing deadline (negative = already expired)."""
        return (self.deadline(clock_start, payer_id, level) - today).days
