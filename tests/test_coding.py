"""Phase 3 gate: coding agent catches unbundling (80048 + 82947) and rejects
malformed LLM-suggested codes."""

import pytest

from rcm.coding.agent import CodingAgent
from rcm.coding.schemas import CodeSuggestions, DiagnosisSuggestion, ProcedureSuggestion
from rcm.extraction.soap import SOAPExtractor
from tests.conftest import read_synthetic


@pytest.fixture()
def agent(mock_llm, ncci, settings) -> CodingAgent:
    return CodingAgent(mock_llm, ncci, settings.rules_dir)


@pytest.fixture()
def messy_encounter(mock_llm):
    return SOAPExtractor(mock_llm).extract(read_synthetic("soap_messy.txt"), "ENC-MESSY")


@pytest.fixture()
def clean_encounter(mock_llm):
    return SOAPExtractor(mock_llm).extract(read_synthetic("soap_clean.txt"), "ENC-CLEAN")


class TestUnbundlingCaught:
    def test_bmp_with_glucose_flagged(self, agent, messy_encounter, patient_robert):
        result = agent.code(messy_encounter, patient_robert, "CLM-1002")
        assert result.claim is not None
        codes = [p.code for p in result.claim.procedures]
        assert "80048" in codes and "82947" in codes
        assert any("80048" in v and "82947" in v for v in result.violations)
        assert result.validation_score < 1.0
        assert result.claim.validation_flags == result.violations

    def test_violation_reduces_overall_confidence(self, agent, messy_encounter, patient_robert):
        result = agent.code(messy_encounter, patient_robert, "CLM-1002")
        assert result.claim.overall_confidence < 0.90


class TestCleanCoding:
    def test_clean_note_codes_without_violations(self, agent, clean_encounter, patient_jane):
        result = agent.code(clean_encounter, patient_jane, "CLM-1001")
        assert result.claim is not None
        assert result.violations == []
        assert result.validation_score == 1.0
        codes = [p.code for p in result.claim.procedures]
        assert "99213" in codes and "80048" in codes and "36415" in codes
        dx = [d.code for d in result.claim.diagnoses]
        assert "I10" in dx and "E11.9" in dx
        assert result.claim.overall_confidence >= 0.90


class TestFormatRejection:
    def test_malformed_llm_codes_rejected_and_flagged(
        self, agent, clean_encounter, patient_jane
    ):
        suggestions = CodeSuggestions(
            diagnoses=[
                DiagnosisSuggestion(code="I10", description="HTN", confidence=0.9),
                DiagnosisSuggestion(code="HALLUCINATED", description="bad", confidence=0.99),
            ],
            procedures=[
                ProcedureSuggestion(code="99213", description="visit", confidence=0.9),
                ProcedureSuggestion(code="9921", description="truncated", confidence=0.9),
            ],
        )
        result = agent.validate_suggestions(
            suggestions, clean_encounter, patient_jane, "CLM-X"
        )
        rejected = {r.code for r in result.rejected_codes}
        assert rejected == {"HALLUCINATED", "9921"}
        assert [d.code for d in result.claim.diagnoses] == ["I10"]
        assert [p.code for p in result.claim.procedures] == ["99213"]

    def test_all_codes_invalid_yields_no_claim(self, agent, clean_encounter, patient_jane):
        suggestions = CodeSuggestions(
            diagnoses=[DiagnosisSuggestion(code="???", description="bad", confidence=0.9)],
            procedures=[ProcedureSuggestion(code="99213", description="visit", confidence=0.9)],
        )
        result = agent.validate_suggestions(
            suggestions, clean_encounter, patient_jane, "CLM-X"
        )
        assert result.claim is None
        assert result.failure_reason == "no valid diagnosis codes"


class TestMUEAndExclusivity:
    def test_mue_unit_limit_violation(self, agent, clean_encounter, patient_jane):
        suggestions = CodeSuggestions(
            diagnoses=[DiagnosisSuggestion(code="I10", description="HTN", confidence=0.9)],
            procedures=[
                ProcedureSuggestion(
                    code="36415", description="draw", units=3, confidence=0.9
                )
            ],
        )
        result = agent.validate_suggestions(
            suggestions, clean_encounter, patient_jane, "CLM-X"
        )
        assert any("MUE" in v and "36415" in v for v in result.violations)

    def test_mutually_exclusive_pair_violation(self, agent, clean_encounter, patient_jane):
        suggestions = CodeSuggestions(
            diagnoses=[DiagnosisSuggestion(code="I10", description="HTN", confidence=0.9)],
            procedures=[
                ProcedureSuggestion(code="99213", description="visit", confidence=0.9),
                ProcedureSuggestion(code="99214", description="visit", confidence=0.9),
            ],
        )
        result = agent.validate_suggestions(
            suggestions, clean_encounter, patient_jane, "CLM-X"
        )
        assert any("mutually exclusive" in v for v in result.violations)

    def test_ptp_indicator_1_without_modifier_flagged(
        self, agent, clean_encounter, patient_jane
    ):
        suggestions = CodeSuggestions(
            diagnoses=[DiagnosisSuggestion(code="M54.50", description="LBP", confidence=0.9)],
            procedures=[
                ProcedureSuggestion(code="97530", description="ther act", confidence=0.9),
                ProcedureSuggestion(code="97140", description="manual", confidence=0.9),
            ],
        )
        result = agent.validate_suggestions(
            suggestions, clean_encounter, patient_jane, "CLM-X"
        )
        assert any("distinct-service modifier" in v for v in result.violations)

    def test_ptp_indicator_1_with_59_passes(self, agent, clean_encounter, patient_jane):
        suggestions = CodeSuggestions(
            diagnoses=[DiagnosisSuggestion(code="M54.50", description="LBP", confidence=0.9)],
            procedures=[
                ProcedureSuggestion(code="97530", description="ther act", confidence=0.9),
                ProcedureSuggestion(
                    code="97140", description="manual", modifiers=["59"], confidence=0.9
                ),
            ],
        )
        result = agent.validate_suggestions(
            suggestions, clean_encounter, patient_jane, "CLM-X"
        )
        assert result.violations == []
