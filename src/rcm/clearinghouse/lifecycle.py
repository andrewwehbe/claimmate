"""Claim lifecycle state machine.

generated -> submitted_to_clearinghouse -> clearinghouse_accepted (999)
                                        -> clearinghouse_rejected -> (resubmit)
clearinghouse_accepted -> clearinghouse_rejected   (999 passed, 277CA rejected)
clearinghouse_accepted -> payer_received -> paid | denied
denied -> paid (appeal overturned and reprocessed)

The two-stage acknowledgment flow is normal: the 999 is a batch syntax ack
and the 277CA is the per-claim business ack, so a claim can be accepted at
the 999 stage and still reject at the 277CA stage.

Pure Python; transitions outside the map raise IllegalTransition rather than
silently corrupting claim state, and a lifecycle whose status/history
disagree is rejected at construction.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field, model_validator


class ClaimStatus(str, Enum):
    GENERATED = "generated"
    SUBMITTED_TO_CLEARINGHOUSE = "submitted_to_clearinghouse"
    CLEARINGHOUSE_ACCEPTED = "clearinghouse_accepted"
    CLEARINGHOUSE_REJECTED = "clearinghouse_rejected"
    PAYER_RECEIVED = "payer_received"
    PAID = "paid"
    DENIED = "denied"


_TRANSITIONS: dict[ClaimStatus, frozenset[ClaimStatus]] = {
    ClaimStatus.GENERATED: frozenset({ClaimStatus.SUBMITTED_TO_CLEARINGHOUSE}),
    ClaimStatus.SUBMITTED_TO_CLEARINGHOUSE: frozenset(
        {ClaimStatus.CLEARINGHOUSE_ACCEPTED, ClaimStatus.CLEARINGHOUSE_REJECTED}
    ),
    ClaimStatus.CLEARINGHOUSE_ACCEPTED: frozenset(
        {ClaimStatus.PAYER_RECEIVED, ClaimStatus.CLEARINGHOUSE_REJECTED}
    ),
    ClaimStatus.CLEARINGHOUSE_REJECTED: frozenset(
        {ClaimStatus.SUBMITTED_TO_CLEARINGHOUSE}
    ),
    ClaimStatus.PAYER_RECEIVED: frozenset({ClaimStatus.PAID, ClaimStatus.DENIED}),
    ClaimStatus.PAID: frozenset(),
    ClaimStatus.DENIED: frozenset({ClaimStatus.PAID}),
}


class IllegalTransition(Exception):
    pass


class ClaimLifecycle(BaseModel):
    claim_id: str
    status: ClaimStatus = ClaimStatus.GENERATED
    history: list[ClaimStatus] = Field(default_factory=lambda: [ClaimStatus.GENERATED])

    @model_validator(mode="after")
    def _status_matches_history(self) -> "ClaimLifecycle":
        if not self.history:
            self.history = [self.status]
        elif self.history[-1] != self.status:
            raise ValueError(
                f"{self.claim_id}: status {self.status.value} disagrees with "
                f"history tail {self.history[-1].value}"
            )
        return self

    def advance(self, to: ClaimStatus, reason: str = "") -> "ClaimLifecycle":
        allowed = _TRANSITIONS[self.status]
        if to not in allowed:
            raise IllegalTransition(
                f"{self.claim_id}: cannot move {self.status.value} -> {to.value}; "
                f"allowed: {sorted(s.value for s in allowed) or 'none (terminal)'}"
                + (f" ({reason})" if reason else "")
            )
        self.status = to
        self.history.append(to)
        return self

    def apply_clearinghouse_ack(self, accepted: bool, reason: str = "") -> "ClaimLifecycle":
        target = (
            ClaimStatus.CLEARINGHOUSE_ACCEPTED
            if accepted
            else ClaimStatus.CLEARINGHOUSE_REJECTED
        )
        return self.advance(target, reason)

    @property
    def is_terminal(self) -> bool:
        return not _TRANSITIONS[self.status]
