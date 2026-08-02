"""Phase 1 gate: model validation."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from pydantic import ValidationError

from rcm.models.claim import CodedClaim, CodedDiagnosis, CodedProcedure
from rcm.models.encounter import ClinicalEncounter
from rcm.models.patient import PatientDemographics
from rcm.models.validators import (
    is_em_code,
    is_lab_code,
    is_valid_icd10,
    is_valid_npi,
    is_valid_procedure_code,
)


class TestNPILuhn:
    def test_known_valid_npi(self):
        # 1234567893 is the CMS documentation example of a valid NPI
        assert is_valid_npi("1234567893")

    @pytest.mark.parametrize("npi", ["9876543213", "1841293990", "1245319599"])
    def test_other_valid_npis(self, npi):
        assert is_valid_npi(npi)

    @pytest.mark.parametrize(
        "npi", ["1234567890", "1234567892", "123456789", "12345678901", "abcdefghij", ""]
    )
    def test_invalid_npis(self, npi):
        assert not is_valid_npi(npi)


class TestCodeFormats:
    @pytest.mark.parametrize("code", ["I10", "E11.9", "R06.02", "M54.50", "Z00.00", "S72.001A"])
    def test_valid_icd10(self, code):
        assert is_valid_icd10(code)

    @pytest.mark.parametrize("code", ["10", "E11.", "e11.9", "I1", "ICD10", "E11.99999"])
    def test_invalid_icd10(self, code):
        assert not is_valid_icd10(code)

    @pytest.mark.parametrize("code", ["99213", "80048", "36415", "J0585", "G0008"])
    def test_valid_procedure_codes(self, code):
        assert is_valid_procedure_code(code)

    @pytest.mark.parametrize("code", ["9921", "992134", "99B13", "j0585", "ZZ123"])
    def test_invalid_procedure_codes(self, code):
        assert not is_valid_procedure_code(code)

    def test_em_and_lab_ranges(self):
        assert is_em_code("99213") and is_em_code("99385")
        assert not is_em_code("93000")
        assert is_lab_code("80048") and not is_lab_code("99213")


class TestPatient:
    def test_future_dob_rejected(self, patient_jane):
        with pytest.raises(ValidationError, match="sanity"):
            PatientDemographics(
                **{**patient_jane.model_dump(), "date_of_birth": date.today() + timedelta(days=1)}
            )

    def test_ancient_dob_rejected(self, patient_jane):
        with pytest.raises(ValidationError, match="sanity"):
            PatientDemographics(
                **{**patient_jane.model_dump(), "date_of_birth": date(1850, 1, 1)}
            )

    def test_bad_state_rejected(self, patient_jane):
        with pytest.raises(ValidationError):
            PatientDemographics(**{**patient_jane.model_dump(), "state": "Illinois"})


def _encounter(**overrides) -> ClinicalEncounter:
    base = dict(
        encounter_id="ENC-1",
        service_date=date(2026, 7, 15),
        chief_complaint="Follow-up",
        diagnoses=["hypertension"],
        procedures=["office visit"],
        provider_npi="1234567893",
        provider_name="Alice Rivera, MD",
    )
    base.update(overrides)
    return ClinicalEncounter(**base)


class TestEncounter:
    def test_valid_encounter(self):
        enc = _encounter(field_confidence={"diagnoses": 0.9})
        assert enc.min_confidence() == 0.9

    def test_invalid_npi_rejected(self):
        with pytest.raises(ValidationError, match="NPI"):
            _encounter(provider_npi="1234567890")

    def test_invalid_pos_rejected(self):
        with pytest.raises(ValidationError, match="place-of-service"):
            _encounter(place_of_service="98")

    def test_out_of_range_confidence_rejected(self):
        with pytest.raises(ValidationError, match="confidence"):
            _encounter(field_confidence={"diagnoses": 1.5})

    def test_no_diagnoses_rejected(self):
        with pytest.raises(ValidationError):
            _encounter(diagnoses=[])


class TestCodedClaim:
    def test_diagnosis_format_enforced(self):
        with pytest.raises(ValidationError, match="ICD-10"):
            CodedDiagnosis(code="NOTACODE", description="x", confidence=0.9)

    def test_procedure_format_enforced(self):
        with pytest.raises(ValidationError, match="CPT/HCPCS"):
            CodedProcedure(
                code="ABC", description="x", charge=Decimal("1"),
                diagnosis_pointers=[1], confidence=0.9,
            )

    def test_modifier_format_enforced(self):
        with pytest.raises(ValidationError, match="modifier"):
            CodedProcedure(
                code="99213", description="x", modifiers=["259"], charge=Decimal("1"),
                diagnosis_pointers=[1], confidence=0.9,
            )

    def test_total_charge_sums_lines(self, patient_jane):
        claim = CodedClaim(
            claim_id="CLM-T1",
            patient=patient_jane,
            encounter=_encounter(),
            diagnoses=[CodedDiagnosis(code="I10", description="HTN", confidence=0.9)],
            procedures=[
                CodedProcedure(
                    code="99213", description="visit", charge=Decimal("125.00"),
                    diagnosis_pointers=[1], confidence=0.9,
                ),
                CodedProcedure(
                    code="36415", description="draw", charge=Decimal("8.00"),
                    diagnosis_pointers=[1], confidence=0.9,
                ),
            ],
            overall_confidence=0.9,
        )
        assert claim.total_charge == Decimal("133.00")
