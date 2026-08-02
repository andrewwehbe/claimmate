"""Phase 5 gate (part 2): a CO-50 denial produces an appeal letter with the
correct CARC interpretation and at least one citation from the local
reference file - never from LLM memory."""

import json

import pytest

from rcm.denials.appeals import AppealGenerator
from rcm.denials.era_parser import parse_835
from rcm.denials.taxonomy import DenialClassifier
from rcm.models.appeal import DisputedService
from tests.conftest import REPO_ROOT, read_synthetic


@pytest.fixture()
def generator(mock_llm, settings) -> AppealGenerator:
    return AppealGenerator(mock_llm, settings.rules_dir)


@pytest.fixture()
def co50_letter(generator, settings):
    era = parse_835(read_synthetic("era_denial_co50_835.txt"))
    analysis = DenialClassifier(settings.rules_dir).analyze(era.claims[0])
    context = generator.build_context(
        analysis=analysis,
        payer_name=era.payer_name,
        clinical_summary="Encounter on 2026-07-16 for exertional chest pain with "
        "uncontrolled hypertension and type 2 diabetes; ECG and metabolic panel "
        "were clinically indicated.",
        disputed_services=[
            DisputedService(
                procedure_code=line.procedure_code,
                description="Service as billed",
                charge_amount=line.charge_amount,
            )
            for line in era.claims[0].service_lines
        ],
    )
    return generator.generate(context)


class TestCO50Appeal:
    def test_letter_contains_carc_interpretation(self, co50_letter):
        assert "50" in co50_letter.subject or "CARC 50" in co50_letter.body
        assert "medical necessity" in co50_letter.body.lower()

    def test_letter_contains_reference_file_citation(self, co50_letter):
        reference = json.loads(
            (REPO_ROOT / "data" / "rules" / "citations.json").read_text(encoding="utf-8")
        )
        allowed_refs = {
            c["reference"] for entries in reference.values()
            if isinstance(entries, list) for c in entries
        }
        assert co50_letter.citations, "letter must carry citations"
        assert all(c.reference in allowed_refs for c in co50_letter.citations)
        assert any(c.reference in co50_letter.body for c in co50_letter.citations)

    def test_citations_are_medical_necessity_specific(self, co50_letter):
        assert any("1862(a)(1)(A)" in c.reference for c in co50_letter.citations)

    def test_rarc_context_included(self, co50_letter):
        assert "N115" in co50_letter.body
