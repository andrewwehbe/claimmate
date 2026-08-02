"""Phase 4 gate: deterministic scrubber checks."""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from rcm.claims.scrubber import ClaimScrubber
from rcm.models.claim import CodedClaim, CodedDiagnosis, CodedProcedure
from rcm.models.encounter import ClinicalEncounter
from rcm.models.hitl import Severity

SERVICE_DATE = date(2026, 7, 15)
SUBMIT_DATE = date(2026, 8, 2)
BILLING_NPI = "9876543213"


@pytest.fixture()
def scrubber(ncci, settings) -> ClaimScrubber:
    return ClaimScrubber.from_rules_dir(ncci, settings.rules_dir, settings.timely_filing_days)


def make_encounter(**overrides) -> ClinicalEncounter:
    base = dict(
        encounter_id="ENC-S",
        service_date=SERVICE_DATE,
        chief_complaint="test",
        diagnoses=["hypertension"],
        procedures=["office visit"],
        provider_npi="1234567893",
        provider_name="Alice Rivera, MD",
    )
    base.update(overrides)
    return ClinicalEncounter(**base)


def make_claim(patient, procedures, diagnoses=None, encounter=None, **overrides) -> CodedClaim:
    diagnoses = diagnoses or [CodedDiagnosis(code="I10", description="HTN", confidence=0.9)]
    base = dict(
        claim_id="CLM-S",
        patient=patient,
        encounter=encounter or make_encounter(),
        diagnoses=diagnoses,
        procedures=procedures,
        overall_confidence=0.95,
    )
    base.update(overrides)
    return CodedClaim(**base)


def proc(code, modifiers=(), pointers=(1,), units=1, charge="100.00"):
    return CodedProcedure(
        code=code,
        description=f"proc {code}",
        modifiers=list(modifiers),
        units=units,
        charge=Decimal(charge),
        diagnosis_pointers=list(pointers),
        confidence=0.9,
    )


def rule_ids(findings):
    return {f.rule_id for f in findings}


class TestModifier25:
    def test_em_with_same_day_procedure_without_25(self, scrubber, patient_jane):
        claim = make_claim(patient_jane, [proc("99213"), proc("93000")])
        findings = scrubber.scrub(claim, BILLING_NPI, SUBMIT_DATE)
        assert "MOD25_MISSING" in rule_ids(findings)
        finding = next(f for f in findings if f.rule_id == "MOD25_MISSING")
        assert finding.severity == Severity.ERROR
        assert finding.procedure_code == "99213"

    def test_em_with_25_passes(self, scrubber, patient_jane):
        claim = make_claim(patient_jane, [proc("99213", modifiers=["25"]), proc("93000")])
        findings = scrubber.scrub(claim, BILLING_NPI, SUBMIT_DATE)
        assert "MOD25_MISSING" not in rule_ids(findings)

    def test_em_with_lab_only_does_not_require_25(self, scrubber, patient_jane):
        claim = make_claim(patient_jane, [proc("99213"), proc("80048"), proc("36415")])
        findings = scrubber.scrub(claim, BILLING_NPI, SUBMIT_DATE)
        assert "MOD25_MISSING" not in rule_ids(findings)


class TestModifier59:
    def test_ptp_pair_without_distinct_modifier(self, scrubber, patient_jane):
        dx = [CodedDiagnosis(code="M54.50", description="LBP", confidence=0.9)]
        claim = make_claim(patient_jane, [proc("97530"), proc("97140")], diagnoses=dx)
        findings = scrubber.scrub(claim, BILLING_NPI, SUBMIT_DATE)
        finding = next(f for f in findings if f.rule_id == "MOD59_MISSING")
        assert finding.severity == Severity.ERROR
        assert finding.procedure_code == "97140"

    def test_ptp_pair_with_xs_modifier_passes(self, scrubber, patient_jane):
        dx = [CodedDiagnosis(code="M54.50", description="LBP", confidence=0.9)]
        claim = make_claim(
            patient_jane, [proc("97530"), proc("97140", modifiers=["XS"])], diagnoses=dx
        )
        findings = scrubber.scrub(claim, BILLING_NPI, SUBMIT_DATE)
        assert "MOD59_MISSING" not in rule_ids(findings)


class TestPriorAuth:
    def test_prior_auth_cpt_without_auth_number(self, scrubber, patient_jane):
        claim = make_claim(patient_jane, [proc("70553", charge="1250.00")])
        findings = scrubber.scrub(claim, BILLING_NPI, SUBMIT_DATE)
        finding = next(f for f in findings if f.rule_id == "PRIOR_AUTH_MISSING")
        assert finding.severity == Severity.ERROR

    def test_prior_auth_present_passes(self, scrubber, patient_jane):
        claim = make_claim(
            patient_jane, [proc("70553", charge="1250.00")], prior_auth_number="AUTH-778812"
        )
        findings = scrubber.scrub(claim, BILLING_NPI, SUBMIT_DATE)
        assert "PRIOR_AUTH_MISSING" not in rule_ids(findings)


class TestNPIChecks:
    def test_invalid_rendering_npi_flagged(self, scrubber, patient_jane):
        encounter = make_encounter().model_copy(update={"provider_npi": "1234567890"})
        claim = make_claim(patient_jane, [proc("99213")], encounter=encounter)
        findings = scrubber.scrub(claim, BILLING_NPI, SUBMIT_DATE)
        assert "RENDERING_NPI_INVALID" in rule_ids(findings)

    def test_invalid_billing_npi_flagged(self, scrubber, patient_jane):
        claim = make_claim(patient_jane, [proc("99213")])
        findings = scrubber.scrub(claim, "0000000000", SUBMIT_DATE)
        assert "BILLING_NPI_INVALID" in rule_ids(findings)


class TestMedicalNecessity:
    def test_unsupported_diagnosis_flagged(self, scrubber, patient_jane):
        dx = [CodedDiagnosis(code="J06.9", description="URI", confidence=0.9)]
        claim = make_claim(patient_jane, [proc("97140")], diagnoses=dx)
        findings = scrubber.scrub(claim, BILLING_NPI, SUBMIT_DATE)
        finding = next(f for f in findings if f.rule_id == "MEDICAL_NECESSITY_MISMATCH")
        assert finding.severity == Severity.WARNING

    def test_supported_diagnosis_passes(self, scrubber, patient_jane):
        claim = make_claim(patient_jane, [proc("80048")])
        findings = scrubber.scrub(claim, BILLING_NPI, SUBMIT_DATE)
        assert "MEDICAL_NECESSITY_MISMATCH" not in rule_ids(findings)


class TestTimelyFiling:
    def test_expired_window_is_error(self, scrubber, patient_jane):
        claim = make_claim(patient_jane, [proc("99213")])
        late = SERVICE_DATE + timedelta(days=120)
        findings = scrubber.scrub(claim, BILLING_NPI, late)
        assert "TIMELY_FILING_EXPIRED" in rule_ids(findings)

    def test_near_deadline_is_warning(self, scrubber, patient_jane):
        claim = make_claim(patient_jane, [proc("99213")])
        near = SERVICE_DATE + timedelta(days=85)
        findings = scrubber.scrub(claim, BILLING_NPI, near)
        finding = next(f for f in findings if f.rule_id == "TIMELY_FILING_AT_RISK")
        assert finding.severity == Severity.WARNING

    def test_within_window_passes(self, scrubber, patient_jane):
        claim = make_claim(patient_jane, [proc("99213")])
        findings = scrubber.scrub(claim, BILLING_NPI, SUBMIT_DATE)
        assert not any(f.rule_id.startswith("TIMELY_FILING") for f in findings)

    def test_future_service_date_is_error(self, scrubber, patient_jane):
        claim = make_claim(patient_jane, [proc("99213")])
        findings = scrubber.scrub(claim, BILLING_NPI, SERVICE_DATE - timedelta(days=1))
        assert "SERVICE_DATE_FUTURE" in rule_ids(findings)
