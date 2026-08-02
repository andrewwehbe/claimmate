"""X12 835 (ERA) parser. Pure Python, no LLM.

Parses the segments needed for denial management: BPR (payment), TRN (trace),
N1 (payer/payee), CLP (claim payment), CAS (adjustments with CARC codes),
SVC (service lines), and LQ (RARC remark codes). Unknown segments are
ignored, so real-world 835s with additional loops still parse.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from rcm.models.era import ERA835, Adjustment, ClaimPayment, ServiceLinePayment

SEGMENT_TERM = "~"
ELEMENT_SEP = "*"
COMPONENT_SEP = ":"


class ERAParseError(Exception):
    pass


def parse_835(edi_text: str) -> ERA835:
    segments = _split_segments(edi_text)
    if not segments:
        raise ERAParseError("No segments found in 835 input")

    payer_name = ""
    payee_name: str | None = None
    payee_npi: str | None = None
    payment_amount: Decimal | None = None
    payment_method = "NON"
    payment_date = ""
    trace_number: str | None = None
    payer_id: str | None = None

    claims: list[ClaimPayment] = []
    current_claim: ClaimPayment | None = None
    current_line: ServiceLinePayment | None = None

    for elements in segments:
        seg_id = elements[0]

        if seg_id == "BPR":
            payment_amount = _money(_get(elements, 2), "BPR02")
            payment_method = _get(elements, 4) or "NON"
            payment_date = _get(elements, 16)
        elif seg_id == "TRN":
            trace_number = _get(elements, 2) or None
        elif seg_id == "N1":
            entity = _get(elements, 1)
            if entity == "PR":
                payer_name = _get(elements, 2)
                payer_id = _get(elements, 4) or None
            elif entity == "PE":
                payee_name = _get(elements, 2) or None
                payee_npi = _get(elements, 4) or None
        elif seg_id == "CLP":
            current_line = None
            status_raw = _get(elements, 2)
            try:
                status = int(status_raw)
            except ValueError as exc:
                raise ERAParseError(f"Non-numeric CLP02 claim status: {status_raw!r}") from exc
            current_claim = ClaimPayment(
                claim_id=_get(elements, 1),
                status_code=status,
                charge_amount=_money(_get(elements, 3), "CLP03"),
                paid_amount=_money(_get(elements, 4), "CLP04"),
                patient_responsibility=_money(_get(elements, 5) or "0", "CLP05"),
                payer_claim_number=_get(elements, 7) or None,
            )
            claims.append(current_claim)
        elif seg_id == "SVC":
            if current_claim is None:
                raise ERAParseError("SVC segment before any CLP segment")
            composite = _get(elements, 1)
            parts = composite.split(COMPONENT_SEP)
            code = parts[1] if len(parts) > 1 and parts[0] == "HC" else parts[0]
            current_line = ServiceLinePayment(
                procedure_code=code,
                charge_amount=_money(_get(elements, 2), "SVC02"),
                paid_amount=_money(_get(elements, 3), "SVC03"),
            )
            current_claim.service_lines.append(current_line)
        elif seg_id == "CAS":
            if current_claim is None:
                raise ERAParseError("CAS segment before any CLP segment")
            for adjustment in _parse_cas(elements):
                if current_line is not None:
                    current_line.adjustments.append(adjustment)
                else:
                    current_claim.adjustments.append(adjustment)
        elif seg_id == "LQ":
            if current_claim is None:
                continue
            code = _get(elements, 2)
            if not code:
                continue
            if current_line is not None:
                current_line.remark_codes.append(code)
            else:
                current_claim.remark_codes.append(code)

    if payment_amount is None:
        raise ERAParseError("835 is missing the BPR payment segment")
    if not payment_date or len(payment_date) != 8:
        raise ERAParseError(f"835 BPR16 payment date missing or malformed: {payment_date!r}")

    return ERA835(
        payer_name=payer_name or "UNKNOWN PAYER",
        payer_id=payer_id,
        payee_name=payee_name,
        payee_npi=payee_npi,
        payment_amount=payment_amount,
        payment_method=payment_method,
        payment_date=payment_date,
        trace_number=trace_number,
        claims=claims,
    )


def _split_segments(edi_text: str) -> list[list[str]]:
    segments: list[list[str]] = []
    for chunk in edi_text.replace("\r", "").replace("\n", "").split(SEGMENT_TERM):
        chunk = chunk.strip()
        if chunk:
            segments.append(chunk.split(ELEMENT_SEP))
    return segments


def _get(elements: list[str], index: int) -> str:
    return elements[index].strip() if index < len(elements) else ""


def _money(raw: str, position: str) -> Decimal:
    try:
        return Decimal(raw)
    except (InvalidOperation, ValueError) as exc:
        raise ERAParseError(f"Non-numeric amount in {position}: {raw!r}") from exc


def _parse_cas(elements: list[str]) -> list[Adjustment]:
    """CAS = group code + up to 6 (reason, amount, quantity) triplets."""
    group = _get(elements, 1)
    if group not in ("CO", "PR", "OA", "PI", "CR"):
        raise ERAParseError(f"Invalid CAS group code: {group!r}")
    adjustments: list[Adjustment] = []
    index = 2
    while index < len(elements):
        reason = _get(elements, index)
        if not reason:
            break
        amount = _money(_get(elements, index + 1) or "0", f"CAS{index + 1:02d}")
        quantity_raw = _get(elements, index + 2)
        quantity = int(quantity_raw) if quantity_raw.isdigit() else None
        adjustments.append(
            Adjustment(group_code=group, reason_code=reason, amount=amount, quantity=quantity)
        )
        index += 3
    return adjustments
