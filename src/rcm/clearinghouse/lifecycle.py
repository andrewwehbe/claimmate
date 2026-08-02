"""Claim lifecycle state machine.

generated -> submitted_to_clearinghouse -> clearinghouse_accepted (999/277CA)
                                        -> clearinghouse_rejected -> (resubmit)
clearinghouse_accepted -> payer_received -> paid | denied
denied -> paid (appeal overturned and reprocessed)

Pure Python; transitions outside the map raise IllegalTransition rather than
silently corrupting claim state.
"""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


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
    ClaimStatus.CLEARINGHOUSE_ACCEPTED: frozenset({ClaimStatus.PAYER_RECEIVED}),
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
