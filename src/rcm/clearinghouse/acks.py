"""Parsers for clearinghouse acknowledgments. Pure Python.

- 999 Implementation Acknowledgment: did the functional group / transaction
  pass syntax validation (AK9 / IK5)?
- 277CA Claim Acknowledgment: per-claim accept/reject for adjudication
  (STC status categories A1/A2 = accepted, A3/A4/A6/A7/A8 = rejected),
  claims identified by TRN*2*<claim_id>.

Both parsers accept the simplified segment stream this platform emits and
ignore unknown segments, so fuller real-world files still parse.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

_ACCEPT_CATEGORIES = frozenset({"A1", "A2"})
_REJECT_CATEGORIES = frozenset({"A3", "A4", "A6", "A7", "A8"})

_CATEGORY_MESSAGES = {
    "A1": "Acknowledged - received",
    "A2": "Accepted for adjudication",
    "A3": "Rejected - returned unprocessed",
    "A4": "Rejected - not found",
    "A6": "Rejected - missing information",
    "A7": "Rejected - invalid information",
    "A8": "Rejected - relational field error",
}


class AckParseError(Exception):
    pass


class Ack999(BaseModel):
    functional_group_accepted: bool
    transaction_accepted: bool
    error_codes: list[str] = Field(default_factory=list)

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


def parse_999(edi_text: str) -> Ack999:
    """Parse a 999: AK9 (group disposition), IK5 (transaction disposition)."""
    ak9_disposition: str | None = None
    ik5_disposition: str | None = None
    error_codes: list[str] = []

    for elements in _segments(edi_text):
        seg_id = elements[0]
        if seg_id == "IK5":
            ik5_disposition = elements[1] if len(elements) > 1 else ""
            error_codes.extend(e for e in elements[2:] if e)
        elif seg_id == "AK9":
            ak9_disposition = elements[1] if len(elements) > 1 else ""
        elif seg_id == "IK3":
            # segment-level error note: IK3*<segment>*<position>...
            if len(elements) > 1 and elements[1]:
                error_codes.append(f"IK3:{elements[1]}")

    if ak9_disposition is None:
        raise AckParseError("999 is missing the AK9 functional group response")

    return Ack999(
        functional_group_accepted=ak9_disposition == "A",
        transaction_accepted=(ik5_disposition or "A") == "A",
        error_codes=error_codes,
    )


def parse_277ca(edi_text: str) -> list[ClaimAck]:
    """Parse a 277CA into per-claim accept/reject statuses.

    Claim reference: TRN*2*<claim_id>. Status: the next STC segment, whose
    STC01 composite is <category>:<status>[:<entity>].
    """
    acks: list[ClaimAck] = []
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
                raise AckParseError(
                    f"Unknown 277CA status category {category!r} for claim {current_claim}"
                )
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

    if not acks:
        raise AckParseError("277CA contained no TRN/STC claim status pairs")
    return acks
