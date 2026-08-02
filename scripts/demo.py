"""End-to-end demo of both pipelines on the synthetic data, using MockLLM.

Run: python scripts/demo.py
No network, no API keys. Output is deterministic.
"""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src"))

from rcm.config import Settings                      # noqa: E402
from rcm.llm.mock import MockLLM                     # noqa: E402
from rcm.models.edi import BillingProvider, InterchangeConfig  # noqa: E402
from rcm.models.patient import PatientDemographics   # noqa: E402
from rcm.pipeline import ClaimsPipeline, DenialsPipeline  # noqa: E402

SUBMISSION_DATE = date(2026, 8, 2)

BILLING_PROVIDER = BillingProvider(
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

PATIENTS = {
    "CLM-1001": PatientDemographics(
        first_name="Jane", last_name="Doe", date_of_birth=date(1985, 2, 14),
        gender="F", member_id="W884512345", payer_name="AETNA HEALTH INC",
        payer_id="60054", address_line1="42 Maple Street", city="Springfield",
        state="IL", zip_code="62704",
    ),
    "CLM-1002": PatientDemographics(
        first_name="Robert", last_name="Nguyen", date_of_birth=date(1971, 9, 3),
        gender="M", member_id="W771203944", payer_name="AETNA HEALTH INC",
        payer_id="60054", address_line1="9 Birch Lane", city="Springfield",
        state="IL", zip_code="62701",
    ),
    "CLM-1003": PatientDemographics(
        first_name="Maria", last_name="Castillo", date_of_birth=date(1992, 6, 30),
        gender="F", member_id="W55098811", payer_name="AETNA HEALTH INC",
        payer_id="60054", address_line1="510 Cedar Court", city="Springfield",
        state="IL", zip_code="62702",
    ),
}

NOTES = {
    "CLM-1001": "soap_clean.txt",
    "CLM-1002": "soap_messy.txt",
    "CLM-1003": "soap_edge_missing_plan.txt",
}


def hr(title: str) -> None:
    print()
    print("=" * 78)
    print(title)
    print("=" * 78)


def sub(title: str) -> None:
    print()
    print(f"--- {title} " + "-" * max(0, 70 - len(title)))


def interchange_for(control: int) -> InterchangeConfig:
    return InterchangeConfig(
        sender_id="SUNRISECLINIC",
        receiver_id="CLEARINGHOUSE",
        receiver_name="ACME CLEARINGHOUSE",
        interchange_control_number=control,
        group_control_number=control,
        transaction_control_number=f"{control:04d}",
        date_yyyymmdd="20260802",
        time_hhmm="0900",
        usage_indicator="T",
    )


def main() -> None:
    settings = Settings(data_dir=REPO_ROOT / "data", _env_file=None)
    llm = MockLLM()
    claims = ClaimsPipeline(llm, settings, BILLING_PROVIDER)
    denials = DenialsPipeline(llm, settings)

    encounter_summaries: dict[str, str] = {}

    hr("PIPELINE 1: RAW NOTE -> EXTRACTION -> CODING -> SCRUB -> 837P -> HITL")
    for control, (claim_id, note_file) in enumerate(NOTES.items(), start=1):
        note_text = (REPO_ROOT / "data" / "synthetic" / note_file).read_text(encoding="utf-8")
        hr(f"{claim_id}  ({note_file})")
        result = claims.process_note(
            note_text, PATIENTS[claim_id], claim_id,
            interchange_for(control), SUBMISSION_DATE,
        )
        enc = result.encounter
        encounter_summaries[claim_id] = enc.summary()

        sub("Extracted encounter")
        print(f"  Service date : {enc.service_date}  POS {enc.place_of_service}")
        print(f"  Provider NPI : {enc.provider_npi} ({enc.provider_name})")
        print(f"  Chief complaint: {enc.chief_complaint}")
        print(f"  Diagnoses    : {'; '.join(enc.diagnoses)}")
        print(f"  Procedures   : {'; '.join(enc.procedures) or '(none documented)'}")
        print(f"  Field confidence: " + ", ".join(
            f"{k}={v:.2f}" for k, v in enc.field_confidence.items()
        ))
        if enc.extraction_warnings:
            print(f"  Warnings     : {'; '.join(enc.extraction_warnings)}")

        sub("Coded claim")
        if result.coding.claim is None:
            print(f"  CODING FAILED: {result.coding.failure_reason}")
        else:
            claim = result.coding.claim
            for d in claim.diagnoses:
                print(f"  ICD-10  {d.code:<8} conf {d.confidence:.2f}  {d.description}")
            for p in claim.procedures:
                mods = f" [{','.join(p.modifiers)}]" if p.modifiers else ""
                print(
                    f"  CPT     {p.code}{mods:<6} x{p.units}  {p.charge:>8.2f} USD"
                    f"  conf {p.confidence:.2f}  {p.description}"
                )
            print(f"  Total charge      : {claim.total_charge:.2f} USD")
            print(f"  Validation score  : {result.coding.validation_score:.2f}")
            print(f"  Overall confidence: {claim.overall_confidence:.2f}")
            for v in result.coding.violations:
                print(f"  NCCI VIOLATION: {v}")
            for r in result.coding.rejected_codes:
                print(f"  REJECTED {r.kind} code {r.code}: {r.reason}")

        sub("Scrub findings")
        if not result.findings:
            print("  (clean - no findings)")
        for f in result.findings:
            print(f"  [{f.severity.value:<7}] {f.rule_id}: {f.message}")

        if result.edi_837p:
            sub("837P output")
            print(result.edi_837p.rstrip())

        sub("HITL routing decision")
        if result.routing.route_to_human:
            print(f"  -> ROUTED TO HUMAN REVIEW ({result.hitl_item.item_id})")
            for reason in result.routing.reasons:
                print(f"     reason: {reason}")
        else:
            print("  -> AUTO-APPROVED for submission (no human review required)")

    hr("PIPELINE 2: 835/ERA -> DENIAL ANALYSIS -> APPEAL")
    for era_file in ("era_clean_835.txt", "era_denial_co50_835.txt"):
        hr(f"Remittance: {era_file}")
        era_text = (REPO_ROOT / "data" / "synthetic" / era_file).read_text(encoding="utf-8")
        result = denials.process_era(era_text, clinical_summaries=encounter_summaries)
        era = result.era
        print(f"  Payer: {era.payer_name}  Payment: {era.payment_amount:.2f} USD "
              f"({era.payment_method})  Date: {era.payment_date}")
        for outcome in result.outcomes:
            sub(f"Claim {outcome.claim_id}")
            if not outcome.was_denied:
                print("  Status: PAID - no action needed")
                continue
            analysis = outcome.analysis
            print(f"  Status: DENIED  category={analysis.category.value}")
            print(f"  CARC {analysis.carc_code}: {analysis.carc_description}")
            for code in analysis.rarc_codes:
                print(f"  RARC {code}: {analysis.rarc_descriptions[code]}")
            print(f"  Denied amount: {analysis.denied_amount:.2f} USD  "
                  f"appealable={analysis.is_appealable}")
            if outcome.appeal:
                sub(f"Appeal letter ({outcome.appeal.generated_by})")
                print(f"  Subject: {outcome.appeal.subject}")
                print()
                for line in outcome.appeal.body.splitlines():
                    print(f"  {line}")

    hr("HITL QUEUE SUMMARY")
    if not claims.hitl.queue:
        print("  (empty)")
    for item in claims.hitl.queue:
        print(f"  {item.item_id}  {item.claim_id}  conf={item.confidence:.2f}  "
              f"value={item.claim_value:.2f} USD")
        for reason in item.reasons:
            print(f"      - {reason}")

    print()
    print("Demo complete. All output generated offline via MockLLM.")


if __name__ == "__main__":
    main()
