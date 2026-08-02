"""Phase 5 gate (part 1): 835 parsing and denial taxonomy."""

from decimal import Decimal

import pytest

from rcm.denials.era_parser import ERAParseError, parse_835
from rcm.denials.taxonomy import DenialClassifier
from rcm.models.era import DenialCategory
from tests.conftest import read_synthetic


@pytest.fixture()
def classifier(settings) -> DenialClassifier:
    return DenialClassifier(settings.rules_dir)


class TestCleanERA:
    def test_parses_payment_and_claims(self):
        era = parse_835(read_synthetic("era_clean_835.txt"))
        assert era.payer_name == "AETNA HEALTH INC"
        assert era.payment_amount == Decimal("168.50")
        assert era.payment_method == "ACH"
        assert len(era.claims) == 1
        claim = era.claims[0]
        assert claim.claim_id == "CLM-1001"
        assert claim.status_code == 1
        assert claim.paid_amount == Decimal("168.50")
        assert len(claim.service_lines) == 3
        assert not claim.is_denied

    def test_paid_claim_yields_no_denial_analysis(self, classifier):
        era = parse_835(read_synthetic("era_clean_835.txt"))
        assert classifier.analyze(era.claims[0]) is None


class TestDenialERA:
    def test_parses_denial_with_carc_and_rarc(self):
        era = parse_835(read_synthetic("era_denial_co50_835.txt"))
        claim = era.claims[0]
        assert claim.status_code == 4
        assert claim.is_denied
        adjustments = claim.all_adjustments
        assert any(a.group_code == "CO" and a.reason_code == "50" for a in adjustments)
        assert "N115" in claim.all_remark_codes

    def test_co50_classified_as_medical_necessity(self, classifier):
        era = parse_835(read_synthetic("era_denial_co50_835.txt"))
        analysis = classifier.analyze(era.claims[0])
        assert analysis is not None
        assert analysis.category == DenialCategory.MEDICAL_NECESSITY
        assert analysis.carc_code == "50"
        assert "medical necessity" in analysis.carc_description.lower()
        assert "N115" in analysis.rarc_codes
        assert "Local Coverage Determination" in analysis.rarc_descriptions["N115"]
        assert analysis.denied_amount == Decimal("278.25")
        assert analysis.is_appealable


class TestParserRobustness:
    def test_empty_input_raises(self):
        with pytest.raises(ERAParseError):
            parse_835("   ")

    def test_missing_bpr_raises(self):
        with pytest.raises(ERAParseError, match="BPR"):
            parse_835("ISA*00~ST*835*0001~SE*2*0001~")

    def test_bad_amount_raises(self):
        text = read_synthetic("era_clean_835.txt").replace("168.50*168.50", "abc*168.50")
        with pytest.raises(ERAParseError):
            parse_835(text)

    def test_unknown_carc_defaults_to_other(self, classifier):
        text = read_synthetic("era_denial_co50_835.txt").replace("CAS*CO*50", "CAS*CO*999")
        era = parse_835(text)
        analysis = classifier.analyze(era.claims[0])
        assert analysis.category == DenialCategory.OTHER
        assert "not in local table" in analysis.notes
