"""Deterministic human-in-the-loop router.

A claim goes to a certified coder when any of the following holds:
- overall confidence < Settings.confidence_threshold (default 0.90)
- claim value > Settings.claim_value_threshold (default $5,000)
- any ERROR-severity scrub finding
"""

from __future__ import annotations

from decimal import Decimal
from itertools import count

from rcm.config import Settings
from rcm.models.hitl import HITLQueueItem, RoutingDecision, ScrubFinding, Severity


class HITLRouter:
    def __init__(self, settings: Settings) -> None:
        self._confidence_threshold = settings.confidence_threshold
        self._value_threshold = settings.claim_value_threshold
        self._queue: list[HITLQueueItem] = []
        self._counter = count(1)

    @property
    def queue(self) -> list[HITLQueueItem]:
        return list(self._queue)

    def decide(
        self,
        confidence: float,
        claim_value: Decimal,
        findings: list[ScrubFinding],
    ) -> RoutingDecision:
        reasons: list[str] = []
        if confidence < self._confidence_threshold:
            reasons.append(
                f"confidence {confidence:.2f} below threshold {self._confidence_threshold:.2f}"
            )
        if claim_value > self._value_threshold:
            reasons.append(
                f"claim value {claim_value:.2f} exceeds threshold {self._value_threshold:.2f}"
            )
        errors = [f for f in findings if f.severity == Severity.ERROR]
        if errors:
            reasons.append(
                "ERROR scrub findings: " + "; ".join(f.rule_id for f in errors)
            )
        return RoutingDecision(route_to_human=bool(reasons), reasons=reasons)

    def enqueue(
        self,
        claim_id: str,
        confidence: float,
        claim_value: Decimal,
        findings: list[ScrubFinding],
        decision: RoutingDecision,
    ) -> HITLQueueItem:
        item = HITLQueueItem(
            item_id=f"HITL-{next(self._counter):05d}",
            claim_id=claim_id,
            reasons=decision.reasons,
            confidence=confidence,
            claim_value=claim_value,
            findings=findings,
        )
        self._queue.append(item)
        return item
