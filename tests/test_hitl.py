"""Phase 6 gate (part 1): HITL routing rules."""

from decimal import Decimal

import pytest

from rcm.hitl.router import HITLRouter
from rcm.models.hitl import ScrubFinding, Severity


@pytest.fixture()
def router(settings) -> HITLRouter:
    return HITLRouter(settings)


def finding(severity: Severity) -> ScrubFinding:
    return ScrubFinding(rule_id="TEST_RULE", severity=severity, message="test finding")


class TestRoutingRules:
    def test_clean_confident_cheap_claim_auto_approves(self, router):
        decision = router.decide(0.95, Decimal("300"), [])
        assert not decision.route_to_human
        assert decision.reasons == []

    def test_low_confidence_routes(self, router):
        decision = router.decide(0.89, Decimal("300"), [])
        assert decision.route_to_human
        assert any("confidence" in r for r in decision.reasons)

    def test_high_value_routes(self, router):
        decision = router.decide(0.99, Decimal("5000.01"), [])
        assert decision.route_to_human
        assert any("value" in r for r in decision.reasons)

    def test_error_finding_routes(self, router):
        decision = router.decide(0.99, Decimal("300"), [finding(Severity.ERROR)])
        assert decision.route_to_human
        assert any("ERROR" in r for r in decision.reasons)

    def test_warning_finding_alone_does_not_route(self, router):
        decision = router.decide(0.99, Decimal("300"), [finding(Severity.WARNING)])
        assert not decision.route_to_human

    def test_threshold_boundaries_are_exclusive(self, router):
        assert not router.decide(0.90, Decimal("5000"), []).route_to_human


class TestQueue:
    def test_enqueue_assigns_sequential_ids(self, router):
        decision = router.decide(0.5, Decimal("100"), [])
        first = router.enqueue("CLM-A", 0.5, Decimal("100"), [], decision)
        second = router.enqueue("CLM-B", 0.5, Decimal("100"), [], decision)
        assert first.item_id == "HITL-00001"
        assert second.item_id == "HITL-00002"
        assert [item.claim_id for item in router.queue] == ["CLM-A", "CLM-B"]


class TestConfigDriven:
    def test_custom_thresholds_respected(self, settings):
        custom = settings.model_copy(
            update={"confidence_threshold": 0.5, "claim_value_threshold": Decimal("100")}
        )
        router = HITLRouter(custom)
        assert not router.decide(0.6, Decimal("50"), []).route_to_human
        assert router.decide(0.4, Decimal("50"), []).route_to_human
        assert router.decide(0.6, Decimal("101"), []).route_to_human
