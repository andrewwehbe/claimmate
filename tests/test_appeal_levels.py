"""Appeal levels and per-payer deadline rules."""

from datetime import date

import pytest

from rcm.denials.deadlines import AppealDeadlineRules
from rcm.models.appeal import AppealLevel


@pytest.fixture()
def rules(settings) -> AppealDeadlineRules:
    return AppealDeadlineRules(settings.rules_dir)


class TestLevelLadder:
    def test_escalation_order(self):
        assert AppealLevel.RECONSIDERATION.next_level() == AppealLevel.LEVEL_1
        assert AppealLevel.LEVEL_1.next_level() == AppealLevel.LEVEL_2
        assert AppealLevel.LEVEL_2.next_level() == AppealLevel.EXTERNAL_REVIEW

    def test_external_review_is_terminal(self):
        assert AppealLevel.EXTERNAL_REVIEW.next_level() is None


class TestDeadlineRules:
    def test_default_windows(self, rules):
        assert rules.window_days(None, AppealLevel.RECONSIDERATION) == 90
        assert rules.window_days("UNKNOWN-PAYER", AppealLevel.LEVEL_1) == 60
        assert rules.window_days(None, AppealLevel.EXTERNAL_REVIEW) == 120

    def test_payer_override_only_where_defined(self, rules):
        # Aetna (60054) overrides reconsideration to 180, inherits the rest
        assert rules.window_days("60054", AppealLevel.RECONSIDERATION) == 180
        assert rules.window_days("60054", AppealLevel.LEVEL_1) == 60

    def test_deadline_and_days_remaining(self, rules):
        denial_date = date(2026, 7, 30)
        deadline = rules.deadline(denial_date, "60054", AppealLevel.RECONSIDERATION)
        assert deadline == date(2027, 1, 26)  # 180 days out
        remaining = rules.days_remaining(
            denial_date, "60054", AppealLevel.RECONSIDERATION, today=date(2026, 8, 2)
        )
        assert remaining == 177

    def test_expired_deadline_goes_negative(self, rules):
        remaining = rules.days_remaining(
            date(2026, 1, 1), None, AppealLevel.LEVEL_1, today=date(2026, 8, 2)
        )
        assert remaining < 0
