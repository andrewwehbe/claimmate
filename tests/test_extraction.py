"""Phase 2 gate: MockLLM-backed extraction of clean, messy, and missing-Plan notes."""

from datetime import date

import pytest

from rcm.extraction.soap import ExtractionError, SOAPExtractor
from tests.conftest import read_synthetic


@pytest.fixture()
def extractor(mock_llm) -> SOAPExtractor:
    return SOAPExtractor(mock_llm)


class TestCleanNote:
    def test_extracts_structured_encounter(self, extractor):
        enc = extractor.extract(read_synthetic("soap_clean.txt"), "ENC-CLEAN")
        assert enc.service_date == date(2026, 7, 15)
        assert enc.provider_npi == "1234567893"
        assert "hypertension" in enc.chief_complaint.lower()
        assert any("hypertension" in d.lower() for d in enc.diagnoses)
        assert any("type 2 diabetes" in d.lower() for d in enc.diagnoses)
        assert any("basic metabolic panel" in p.lower() for p in enc.procedures)
        assert any("office visit" in p.lower() for p in enc.procedures)

    def test_clean_note_confidence_is_high(self, extractor):
        enc = extractor.extract(read_synthetic("soap_clean.txt"), "ENC-CLEAN")
        assert enc.min_confidence() >= 0.90


class TestMessyNote:
    def test_abbreviations_expanded(self, extractor):
        enc = extractor.extract(read_synthetic("soap_messy.txt"), "ENC-MESSY")
        joined = " ".join(enc.diagnoses).lower()
        assert "hypertension" in joined
        assert "type 2 diabetes mellitus" in joined
        assert "chest pain" in joined
        assert "htn" not in joined and "dm2" not in joined.split()

    def test_messy_note_lowers_confidence(self, extractor):
        enc = extractor.extract(read_synthetic("soap_messy.txt"), "ENC-MESSY")
        assert enc.min_confidence() < 0.90

    def test_procedures_recognized_from_terse_plan(self, extractor):
        enc = extractor.extract(read_synthetic("soap_messy.txt"), "ENC-MESSY")
        joined = " ".join(enc.procedures).lower()
        assert "electrocardiogram" in joined
        assert "basic metabolic panel" in joined
        assert "glucose" in joined


class TestMissingPlanNote:
    def test_missing_plan_flagged_with_low_confidence(self, extractor):
        enc = extractor.extract(read_synthetic("soap_edge_missing_plan.txt"), "ENC-EDGE")
        assert any("plan" in w.lower() for w in enc.extraction_warnings)
        assert enc.field_confidence["procedures"] <= 0.5
        assert any("upper respiratory infection" in d.lower() for d in enc.diagnoses)


class TestExtractionFailureModes:
    def test_empty_note_raises(self, extractor):
        with pytest.raises(ExtractionError, match="Empty"):
            extractor.extract("   ", "ENC-X")

    def test_note_without_npi_raises(self, extractor):
        note = "SUBJECTIVE: cough\nASSESSMENT: cough\nPLAN: rest\nDate: 2026-07-01"
        with pytest.raises(ExtractionError, match="NPI"):
            extractor.extract(note, "ENC-X")
