"""Phase 4 gate: golden-file test - the rendered 837P must match the expected
output byte-for-byte, plus structural checks."""

from pathlib import Path

import pytest

from rcm.claims.edi837 import EDI837Builder
from rcm.coding.agent import CodingAgent
from rcm.extraction.soap import SOAPExtractor
from rcm.models.edi import EDI837P
from tests.conftest import read_synthetic

GOLDEN_PATH = Path(__file__).parent / "golden" / "expected_837p.txt"


@pytest.fixture()
def edi_document(mock_llm, ncci, settings, patient_jane, billing_provider, interchange):
    encounter = SOAPExtractor(mock_llm).extract(read_synthetic("soap_clean.txt"), "ENC-CLM-1001")
    result = CodingAgent(mock_llm, ncci, settings.rules_dir).code(
        encounter, patient_jane, "CLM-1001"
    )
    assert result.claim is not None
    return EDI837P(
        interchange=interchange, billing_provider=billing_provider, claim=result.claim
    )


class TestGoldenFile:
    def test_837p_matches_golden_byte_for_byte(self, edi_document):
        rendered = EDI837Builder().build(edi_document)
        expected = GOLDEN_PATH.read_bytes()
        assert rendered.encode("utf-8") == expected

    def test_rendering_is_deterministic(self, edi_document):
        builder = EDI837Builder()
        assert builder.build(edi_document) == builder.build(edi_document)


class TestStructure:
    def test_envelope_and_counts(self, edi_document):
        rendered = EDI837Builder().build(edi_document)
        lines = [ln for ln in rendered.splitlines() if ln]
        assert lines[0].startswith("ISA*")
        assert lines[1].startswith("GS*")
        assert lines[-1].startswith("IEA*")
        assert lines[-2].startswith("GE*")

        st_index = next(i for i, ln in enumerate(lines) if ln.startswith("ST*"))
        se_index = next(i for i, ln in enumerate(lines) if ln.startswith("SE*"))
        se_count = int(lines[se_index].split("*")[1])
        assert se_count == se_index - st_index + 1

    def test_icd10_codes_rendered_without_dots(self, edi_document):
        rendered = EDI837Builder().build(edi_document)
        hi_line = next(ln for ln in rendered.splitlines() if ln.startswith("HI*"))
        assert "E119" in hi_line
        assert "E11.9" not in hi_line

    def test_one_service_line_per_procedure(self, edi_document):
        rendered = EDI837Builder().build(edi_document)
        sv1_count = sum(1 for ln in rendered.splitlines() if ln.startswith("SV1*"))
        assert sv1_count == len(edi_document.claim.procedures)

    def test_isa_is_fixed_width(self, edi_document):
        rendered = EDI837Builder().build(edi_document)
        isa = rendered.splitlines()[0]
        elements = isa[:-1].split("*")  # drop trailing ~
        assert len(elements) == 17
        assert len(elements[6]) == 15 and len(elements[8]) == 15
