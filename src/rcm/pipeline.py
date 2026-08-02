"""End-to-end orchestration.

ClaimsPipeline: raw note -> extraction -> coding -> scrub -> 837P -> HITL.
DenialsPipeline: 835 text -> parse -> denial analysis -> appeal letters.

Both pipelines log through structlog with PHI redaction (claim IDs and codes
are logged; identities are not).
"""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field

from rcm.claims.edi837 import EDI837Builder
from rcm.claims.scrubber import ClaimScrubber
from rcm.coding.agent import CodingAgent, CodingResult
from rcm.config import Settings
from rcm.denials.appeals import AppealGenerator
from rcm.denials.era_parser import parse_835
from rcm.denials.taxonomy import DenialClassifier
from rcm.extraction.soap import SOAPExtractor
from rcm.hitl.router import HITLRouter
from rcm.llm.base import LLMClient
from rcm.logging_config import configure_logging, get_logger
from rcm.models.appeal import AppealLetter, DisputedService
from rcm.models.edi import EDI837P, BillingProvider, InterchangeConfig
from rcm.models.encounter import ClinicalEncounter
from rcm.models.era import ERA835, DenialAnalysis
from rcm.models.hitl import HITLQueueItem, RoutingDecision, ScrubFinding
from rcm.models.patient import PatientDemographics
from rcm.rules.ncci import JsonNCCIRuleProvider


class ClaimPipelineResult(BaseModel):
    claim_id: str
    encounter: ClinicalEncounter
    coding: CodingResult
    findings: list[ScrubFinding] = Field(default_factory=list)
    edi_837p: str | None = None
    routing: RoutingDecision
    hitl_item: HITLQueueItem | None = None


class DenialOutcome(BaseModel):
    claim_id: str
    was_denied: bool
    analysis: DenialAnalysis | None = None
    appeal: AppealLetter | None = None


class DenialPipelineResult(BaseModel):
    era: ERA835
    outcomes: list[DenialOutcome] = Field(default_factory=list)


class ClaimsPipeline:
    def __init__(
        self,
        llm: LLMClient,
        settings: Settings,
        billing_provider: BillingProvider,
    ) -> None:
        configure_logging()
        self._log = get_logger("rcm.claims_pipeline")
        self._settings = settings
        self._billing_provider = billing_provider
        ncci = JsonNCCIRuleProvider(settings.rules_dir)
        self._extractor = SOAPExtractor(llm)
        self._coder = CodingAgent(llm, ncci, settings.rules_dir)
        self._scrubber = ClaimScrubber.from_rules_dir(
            ncci, settings.rules_dir, settings.timely_filing_days
        )
        self._builder = EDI837Builder()
        self.hitl = HITLRouter(settings)

    def process_note(
        self,
        note_text: str,
        patient: PatientDemographics,
        claim_id: str,
        interchange: InterchangeConfig,
        submission_date: date,
    ) -> ClaimPipelineResult:
        log = self._log.bind(claim_id=claim_id)
        encounter = self._extractor.extract(note_text, encounter_id=f"ENC-{claim_id}")
        log.info(
            "note_extracted",
            diagnoses=len(encounter.diagnoses),
            procedures=len(encounter.procedures),
            min_confidence=encounter.min_confidence(),
            warnings=encounter.extraction_warnings,
        )

        coding = self._coder.code(encounter, patient, claim_id)
        if coding.claim is None:
            log.error("coding_failed", reason=coding.failure_reason)
            routing = RoutingDecision(
                route_to_human=True,
                reasons=[f"coding failed: {coding.failure_reason}"],
            )
            item = self.hitl.enqueue(claim_id, 0.0, 0, [], routing)
            return ClaimPipelineResult(
                claim_id=claim_id,
                encounter=encounter,
                coding=coding,
                routing=routing,
                hitl_item=item,
            )
        claim = coding.claim
        log.info(
            "claim_coded",
            icd10=[d.code for d in claim.diagnoses],
            cpt=[p.code for p in claim.procedures],
            overall_confidence=claim.overall_confidence,
            ncci_violations=coding.violations,
            rejected_codes=[r.code for r in coding.rejected_codes],
        )

        findings = self._scrubber.scrub(
            claim, self._billing_provider.npi, submission_date
        )
        log.info(
            "claim_scrubbed",
            findings=[f"{f.severity.value}:{f.rule_id}" for f in findings],
        )

        edi = self._builder.build(
            EDI837P(
                interchange=interchange,
                billing_provider=self._billing_provider,
                claim=claim,
            )
        )

        routing = self.hitl.decide(claim.overall_confidence, claim.total_charge, findings)
        hitl_item = None
        if routing.route_to_human:
            hitl_item = self.hitl.enqueue(
                claim_id, claim.overall_confidence, claim.total_charge, findings, routing
            )
            log.warning("routed_to_human", reasons=routing.reasons)
        else:
            log.info("auto_approved_for_submission")

        return ClaimPipelineResult(
            claim_id=claim_id,
            encounter=encounter,
            coding=coding,
            findings=findings,
            edi_837p=edi,
            routing=routing,
            hitl_item=hitl_item,
        )


class DenialsPipeline:
    def __init__(self, llm: LLMClient, settings: Settings) -> None:
        configure_logging()
        self._log = get_logger("rcm.denials_pipeline")
        self._classifier = DenialClassifier(settings.rules_dir)
        self._appeals = AppealGenerator(llm, settings.rules_dir)

    def process_era(
        self,
        era_text: str,
        clinical_summaries: dict[str, str] | None = None,
        service_descriptions: dict[str, str] | None = None,
    ) -> DenialPipelineResult:
        """clinical_summaries: claim_id -> encounter summary for appeal context.
        service_descriptions: CPT -> human description for disputed lines."""
        era = parse_835(era_text)
        self._log.info(
            "era_parsed",
            payer=era.payer_name,
            claims=len(era.claims),
            payment_amount=str(era.payment_amount),
        )
        summaries = clinical_summaries or {}
        descriptions = service_descriptions or {}

        outcomes: list[DenialOutcome] = []
        for claim_payment in era.claims:
            analysis = self._classifier.analyze(claim_payment)
            if analysis is None:
                self._log.info(
                    "claim_paid", claim_id=claim_payment.claim_id,
                    paid=str(claim_payment.paid_amount),
                )
                outcomes.append(
                    DenialOutcome(claim_id=claim_payment.claim_id, was_denied=False)
                )
                continue

            self._log.warning(
                "claim_denied",
                claim_id=analysis.claim_id,
                carc=analysis.carc_code,
                category=analysis.category.value,
                denied_amount=str(analysis.denied_amount),
                appealable=analysis.is_appealable,
            )
            appeal = None
            if analysis.is_appealable:
                disputed = [
                    DisputedService(
                        procedure_code=line.procedure_code,
                        description=descriptions.get(
                            line.procedure_code, "Service as billed"
                        ),
                        charge_amount=line.charge_amount,
                    )
                    for line in claim_payment.service_lines
                    if line.paid_amount < line.charge_amount
                ]
                context = self._appeals.build_context(
                    analysis=analysis,
                    payer_name=era.payer_name,
                    clinical_summary=summaries.get(
                        analysis.claim_id,
                        "Clinical documentation is on file and enclosed with this appeal.",
                    ),
                    disputed_services=disputed,
                )
                appeal = self._appeals.generate(context)
                self._log.info(
                    "appeal_drafted",
                    claim_id=analysis.claim_id,
                    citations=[c.reference for c in appeal.citations],
                )
            outcomes.append(
                DenialOutcome(
                    claim_id=claim_payment.claim_id,
                    was_denied=True,
                    analysis=analysis,
                    appeal=appeal,
                )
            )
        return DenialPipelineResult(era=era, outcomes=outcomes)
