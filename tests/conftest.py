"""Shared fixtures. Everything runs offline against MockLLM - no API keys."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest

from rcm.config import Settings
from rcm.llm.mock import MockLLM
from rcm.models.edi import BillingProvider, InterchangeConfig
from rcm.models.patient import PatientDemographics
from rcm.rules.ncci import JsonNCCIRuleProvider

REPO_ROOT = Path(__file__).resolve().parents[1]

SUBMISSION_DATE = date(2026, 8, 2)


@pytest.fixture()
def settings() -> Settings:
    return Settings(data_dir=REPO_ROOT / "data", _env_file=None)


@pytest.fixture()
def mock_llm() -> MockLLM:
    return MockLLM()


@pytest.fixture()
def ncci(settings: Settings) -> JsonNCCIRuleProvider:
    return JsonNCCIRuleProvider(settings.rules_dir)


@pytest.fixture()
def patient_jane() -> PatientDemographics:
    return PatientDemographics(
        first_name="Jane",
        last_name="Doe",
        date_of_birth=date(1985, 2, 14),
        gender="F",
        member_id="W884512345",
        payer_name="AETNA HEALTH INC",
        payer_id="60054",
        address_line1="42 Maple Street",
        city="Springfield",
        state="IL",
        zip_code="62704",
    )


@pytest.fixture()
def patient_robert() -> PatientDemographics:
    return PatientDemographics(
        first_name="Robert",
        last_name="Nguyen",
        date_of_birth=date(1971, 9, 3),
        gender="M",
        member_id="W771203944",
        payer_name="AETNA HEALTH INC",
        payer_id="60054",
        address_line1="9 Birch Lane",
        city="Springfield",
        state="IL",
        zip_code="62701",
    )


@pytest.fixture()
def billing_provider() -> BillingProvider:
    return BillingProvider(
        organization_name="SUNRISE FAMILY MEDICINE",
        npi="9876543213",
        tax_id="123456789",
        address_line1="100 Wellness Way",
        city="Springfield",
        state="IL",
        zip_code="62701",
        contact_name="BILLING DEPT",
        contact_phone="5555550100",
    )


@pytest.fixture()
def interchange() -> InterchangeConfig:
    return InterchangeConfig(
        sender_id="SUNRISECLINIC",
        receiver_id="CLEARINGHOUSE",
        receiver_name="ACME CLEARINGHOUSE",
        interchange_control_number=1,
        group_control_number=1,
        transaction_control_number="0001",
        date_yyyymmdd="20260802",
        time_hhmm="0900",
        usage_indicator="T",
    )


def read_synthetic(name: str) -> str:
    return (REPO_ROOT / "data" / "synthetic" / name).read_text(encoding="utf-8")
