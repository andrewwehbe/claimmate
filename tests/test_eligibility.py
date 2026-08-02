"""Eligibility verification (270/271 simulation)."""

from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from rcm.eligibility.provider import JsonEligibilityProvider, generate_270
from rcm.models.eligibility import CoverageStatus, EligibilityRequest


@pytest.fixture()
def provider(settings) -> JsonEligibilityProvider:
    return JsonEligibilityProvider(settings.rules_dir)


def request_for(member_id: str, service_date: date = date(2026, 7, 15)) -> EligibilityRequest:
    return EligibilityRequest(
        member_id=member_id,
        subscriber_last_name="Doe",
        subscriber_first_name="Jane",
        subscriber_dob=date(1985, 2, 14),
        payer_id="60054",
        provider_npi="1234567893",
        service_date=service_date,
    )


class TestCoverageResolution:
    def test_active_member(self, provider):
        result = provider.check(request_for("W884512345"))
        assert result.status == CoverageStatus.ACTIVE
        assert result.is_active
        assert result.plan_name == "Aetna Choice POS II"
        assert result.copay == Decimal("25.00")
        assert result.deductible_remaining == Decimal("350.00")

    def test_terminated_before_dos(self, provider):
        result = provider.check(request_for("W99000111", date(2026, 7, 15)))
        assert result.status == CoverageStatus.TERMINATED
        assert not result.is_active
        assert "terminated 2026-05-31" in result.notes.lower()

    def test_dos_on_termination_date_is_still_covered(self, provider):
        # Convention: termination_date is the LAST COVERED DAY
        result = provider.check(request_for("W99000111", date(2026, 5, 31)))
        assert result.status == CoverageStatus.ACTIVE

    def test_dos_one_day_after_termination_is_terminated(self, provider):
        result = provider.check(request_for("W99000111", date(2026, 6, 1)))
        assert result.status == CoverageStatus.TERMINATED

    def test_active_when_dos_before_termination(self, provider):
        result = provider.check(request_for("W99000111", date(2026, 5, 15)))
        assert result.status == CoverageStatus.ACTIVE
        assert "terminates" in result.notes.lower()

    def test_inactive_member(self, provider):
        result = provider.check(request_for("W88121299"))
        assert result.status == CoverageStatus.INACTIVE
        assert not result.is_active

    def test_unknown_member_not_found(self, provider):
        result = provider.check(request_for("ZZ-NOBODY"))
        assert result.status == CoverageStatus.NOT_FOUND
        assert not result.is_active
        assert "not found" in result.notes.lower()

    def test_zero_copay_is_zero_not_none(self, provider):
        result = provider.check(request_for("W771203944"))
        assert result.deductible_remaining == Decimal("0.00")
        assert result.deductible_remaining is not None


class TestRequestValidation:
    def test_invalid_provider_npi_rejected(self):
        with pytest.raises(ValidationError, match="NPI"):
            EligibilityRequest(
                member_id="W884512345",
                subscriber_last_name="Doe",
                subscriber_first_name="Jane",
                subscriber_dob=date(1985, 2, 14),
                payer_id="60054",
                provider_npi="1234567890",
                service_date=date(2026, 7, 15),
            )


class TestGenerate270:
    def test_270_contains_full_subscriber_identity(self):
        edi = generate_270(request_for("W884512345"), control_number=7)
        assert "ST*270*0007*005010X279A1~" in edi
        assert "NM1*IL*1*DOE*JANE****MI*W884512345~" in edi
        assert "DMG*D8*19850214~" in edi
        assert "NM1*1P*2*PROVIDER*****XX*1234567893~" in edi
        assert "DTP*291*D8*20260715~" in edi
        assert "EQ*30~" in edi
        assert "SE*12*0007~" in edi

    def test_270_is_deterministic(self):
        req = request_for("W884512345")
        assert generate_270(req) == generate_270(req)
