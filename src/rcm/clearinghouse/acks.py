"""Parsers for clearinghouse acknowledgments. Pure Python.

- 999 Implementation Acknowledgment: did the functional group / transactions
  pass syntax validation (AK9 / IK5)?
- 277CA Claim Acknowledgment: per-claim accept/reject for adjudication
  (STC status categories), claims identified by TRN*2*<claim_id>.

Disposition semantics (X12):
- A = accepted, E = accepted with errors noted (the claims DID go through),
  R = rejected, M/W/X = rejected (authentication/assurance/decryption),
  P = partially accepted (AK9 only; some transactions rejected).
- Unknown dispositions and status categories raise AckParseError - never
  guessed (DECISIONS.md #37).

A 999 may acknowledge several 837 transactions (one AK2/IK5 loop each); all
IK5 dispositions are collected and the 999 counts as accepted only when the
group was not rejected AND every transaction was accepted.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

_DISPOSITION_ACCEPT = frozenset({"A", "E"})
_DISPOSITION_REJECT = frozenset({"R", "M", "W", "X"})

# 277CA claim status categories: accepted/in-flight vs rejected
_ACCEPT_CATEGORIES = frozenset({"A0", "A1", "A2", "A5"})
_REJECT_CATEGORIES = frozenset({"A3", "A4", "A6", "A7", "A8"})

_CATEGORY_MESSAGES = {
    "A0": "Acknowledged - forwarded to another entity",
    "A1": "Acknowledged - received",
    "A2": "Accepted for adjudication",
    "A5": "Split claim - accepted in parts",
    "A3": "Rejected - returned unprocessed",
    "A4": "Rejected - not found",
    "A6": "Rejected - missing information",
    "A7": "Rejected - invalid information",
    "A8": "Rejected - relational field error",
}


class AckParseError(Exception):
    pass


class Ack999(BaseModel):
    ak9_disposition: str
    ik5_dispositions: list[str] = Field(default_factory=list)
    error_codes: list[str] = Field(default_factory=list)

    @property
    def functional_group_accepted(self) -> bool:
        return self.ak9_disposition not in _DISPOSITION_REJECT

    @property
    def transaction_accepted(self) -> bool:
        return all(d in _DISPOSITION_ACCEPT for d in self.ik5_dispositions)

    @property
    def accepted(self) -> bool:
        return self.functional_group_accepted and self.transaction_accepted


class ClaimAck(BaseModel):
    claim_id: str
    accepted: bool
    category_code: str
    status_code: str
    message: str


def _segments(edi_text: str) -> list[list[str]]:
    out: list[list[str]] = []
    for chunk in edi_text.replace("\r", "").replace("\n", "").split("~"):
        chunk = chunk.strip()
        if chunk:
            out.append(chunk.split("*"))
    return out


def _validate_disposition(value: str, segment: str) -> str:
    if value not in _DISPOSITION_ACCEPT | _DISPOSITION_REJECT | {"P"}:
        raise AckParseError(f"Unknown {segment} disposition: {value!r}")
    return value


def parse_999(edi_text: str) -> Ack999:
    """Parse a 999: AK9 (group disposition) + every IK5 (per-transaction)."""
    ak9_disposition: str | None = None
    ik5_dispositions: list[str] = []
    error_codes: list[str] = []

    for elements in _segments(edi_text):
        seg_id = elements[0]
        if seg_id == "IK5":
            disposition = _validate_disposition(
                elements[1] if len(elements) > 1 else "", "IK5"
            )
            ik5_dispositions.append(disposition)
            error_codes.extend(e for e in elements[2:] if e)
        elif seg_id == "AK9":
            ak9_disposition = _validate_disposition(
                elements[1] if len(elements) > 1 else "", "AK9"
            )
        elif seg_id == "IK3":
            # segment-level error note: IK3*<segment>*<position>...
            if len(elements) > 1 and elements[1]:
                error_codes.append(f"IK3:{elements[1]}")

    if ak9_disposition is None:
        raise AckParseError("999 is missing the AK9 functional group response")
    if not ik5_dispositions:
        raise AckParseError("999 is missing the IK5 transaction response")

    return Ack999(
        ak9_disposition=ak9_disposition,
        ik5_dispositions=ik5_dispositions,
        error_codes=error_codes,
    )


def parse_277ca(edi_text: str) -> list[ClaimAck]:
    """Parse a 277CA into per-claim accept/reject statuses.

    Claim reference: TRN*2*<claim_id>. Status: the next STC segment, whose
    STC01 composite is <category>:<status>[:<entity>]. Unknown categories
    are collected and raised together after the full pass, so the error
    reports every offending claim, but no partial result is ever returned
    for a file the parser did not fully understand.
    """
    acks: list[ClaimAck] = []
    unknown: list[str] = []
    current_claim: str | None = None

    for elements in _segments(edi_text):
        seg_id = elements[0]
        if seg_id == "TRN" and len(elements) > 2 and elements[1] == "2":
            current_claim = elements[2]
        elif seg_id == "STC" and current_claim is not None:
            composite = elements[1] if len(elements) > 1 else ""
            parts = composite.split(":")
            category = parts[0] if parts else ""
            status = parts[1] if len(parts) > 1 else ""
            if category in _ACCEPT_CATEGORIES:
                accepted = True
            elif category in _REJECT_CATEGORIES:
                accepted = False
            else:
                unknown.append(f"{current_claim}:{category or '(empty)'}")
                current_claim = None
                continue
            free_text = elements[12] if len(elements) > 12 and elements[12] else ""
            acks.append(
                ClaimAck(
                    claim_id=current_claim,
                    accepted=accepted,
                    category_code=category,
                    status_code=status,
                    message=free_text or _CATEGORY_MESSAGES[category],
                )
            )
            current_claim = None

    if unknown:
        raise AckParseError(
            "Unknown 277CA status categories (claim:category): " + ", ".join(unknown)
        )
    if not acks:
        raise AckParseError("277CA contained no TRN/STC claim status pairs")
    return acks
