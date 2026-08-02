"""Phase 6 gate (part 2): end-to-end pipelines and PHI redaction."""

from datetime import date

import pytest

from rcm.logging_config import redact_phi
from rcm.pipeline import ClaimsPipeline, DenialsPipeline
from tests.conftest import SUBMISSION_DATE, read_synthetic


@pytest.fixture()
def claims_pipeline(mock_llm, settings, billing_provider) -> ClaimsPipeline:
    return ClaimsPipeline(mock_llm, settings, billing_provider)


@pytest.fixture()
def denials_pipeline(mock_llm, settings) -> DenialsPipeline:
    return DenialsPipeline(mock_llm, settings)


class TestClaimsPipelineEndToEnd:
    def test_clean_note_auto_approves(
        self, claims_pipeline, patient_jane, interchange
    ):
        result = claims_pipeline.process_note(
            read_synthetic("soap_clean.txt"), patient_jane, "CLM-1001",
            interchange, SUBMISSION_DATE,
        )
        assert result.coding.claim is not None
        assert result.edi_837p and result.edi_837p.startswith("ISA*")
        assert not result.routing.route_to_human
        assert result.hitl_item is None

    def test_messy_note_routes_to_human(
        self, claims_pipeline, patient_robert, interchange
    ):
        result = claims_pipeline.process_note(
            read_synthetic("soap_messy.txt"), patient_robert, "CLM-1002",
            interchange, SUBMISSION_DATE,
        )
        assert result.routing.route_to_human
        assert result.hitl_item is not None
        assert any("80048" in v for v in result.coding.violations)
        assert any(f.rule_id == "MOD25_MISSING" for f in result.findings)
        assert claims_pipeline.hitl.queue[-1].claim_id == "CLM-1002"

    def test_missing_plan_note_routes_on_confidence(
        self, claims_pipeline, patient_jane, interchange
    ):
        result = claims_pipeline.process_note(
            read_synthetic("soap_edge_missing_plan.txt"), patient_jane, "CLM-1003",
            interchange, SUBMISSION_DATE,
        )
        assert result.routing.route_to_human
        assert any("confidence" in r for r in result.routing.reasons)


class TestDenialsPipelineEndToEnd:
    def test_clean_era_produces_no_appeals(self, denials_pipeline):
        result = denials_pipeline.process_era(read_synthetic("era_clean_835.txt"))
        assert len(result.outcomes) == 1
        assert not result.outcomes[0].was_denied
        assert result.outcomes[0].appeal is None

    def test_denial_era_produces_appeal(self, denials_pipeline):
        result = denials_pipeline.process_era(
            read_synthetic("era_denial_co50_835.txt"),
            clinical_summaries={"CLM-1002": "Exertional chest pain workup."},
        )
        outcome = result.outcomes[0]
        assert outcome.was_denied
        assert outcome.analysis.carc_code == "50"
        assert outcome.appeal is not None
        assert "Exertional chest pain workup." in outcome.appeal.body
        assert outcome.appeal.citations


class TestPHIRedaction:
    def test_phi_keys_redacted_recursively(self):
        event = {
            "event": "claim_coded",
            "claim_id": "CLM-1001",
            "patient": {
                "first_name": "Jane",
                "last_name": "Doe",
                "date_of_birth": "1985-02-14",
                "member_id": "W884512345",
                "nested": {"address_line1": "42 Maple Street"},
            },
            "codes": ["I10", "E11.9"],
        }
        redacted = redact_phi(None, "info", event)
        assert redacted["claim_id"] == "CLM-1001"
        assert redacted["codes"] == ["I10", "E11.9"]
        patient = redacted["patient"]
        assert patient["first_name"] == "[REDACTED]"
        assert patient["last_name"] == "[REDACTED]"
        assert patient["date_of_birth"] == "[REDACTED]"
        assert patient["member_id"] == "[REDACTED]"
        assert patient["nested"]["address_line1"] == "[REDACTED]"

    def test_ssn_shaped_strings_masked_in_values(self):
        event = {"event": "note", "detail": "patient SSN 987-65-4321 on file"}
        redacted = redact_phi(None, "info", event)
        assert "987-65-4321" not in redacted["detail"]
        assert "[REDACTED]" in redacted["detail"]
