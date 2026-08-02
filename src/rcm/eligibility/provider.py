"""Eligibility verification against a pluggable provider.

Real-world flow: the engine issues an X12 270 eligibility inquiry through a
clearinghouse (Availity, Change Healthcare, ...) and parses the payer's 271
response for active coverage, plan, copay/deductible, and termination.

Here `JsonEligibilityProvider` simulates the payer side from a local roster
(data/rules/eligibility.json) while `generate_270` renders the actual
inquiry we would transmit. To go live, implement EligibilityProvider with a
clearinghouse client that sends `generate_270(...)` output and parses the
271 - the pipeline depends only on the interface.

All adjudication logic here is deterministic: the effective status on the
date of service (including termination-before-DOS) is computed in code,
never inferred by an LLM.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import date
from decimal import Decimal
from pathlib import Path

from rcm.models.eligibility import CoverageStatus, EligibilityRequest, EligibilityResult
from rcm.rules.loader import load_rules_json


class EligibilityProvider(ABC):
    @abstractmethod
    def check(self, request: EligibilityRequest) -> EligibilityResult:
        """Resolve coverage for a member on a service date."""


class JsonEligibilityProvider(EligibilityProvider):
    """Mock payer eligibility backed by the local JSON roster."""

    def __init__(self, rules_dir: Path, filename: str = "eligibility.json") -> None:
        raw = load_rules_json(rules_dir, filename)
        self._members: dict[str, dict] = raw["members"]

    def check(self, request: EligibilityRequest) -> EligibilityResult:
        record = self._members.get(request.member_id)
        if record is None:
            return EligibilityResult(
                member_id=request.member_id,
                status=CoverageStatus.NOT_FOUND,
                service_date=request.service_date,
                notes="Subscriber not found by payer (271 AAA*75 equivalent)",
            )

        termination_date = (
            date.fromisoformat(record["termination_date"])
            if record.get("termination_date")
            else None
        )
        status = CoverageStatus(record["status"])
        notes = ""
        if status == CoverageStatus.ACTIVE and termination_date is not None:
            if termination_date < request.service_date:
                status = CoverageStatus.TERMINATED
                notes = (
                    f"Coverage terminated {termination_date.isoformat()}, before "
                    f"date of service {request.service_date.isoformat()}"
                )
            else:
                notes = f"Coverage terminates {termination_date.isoformat()}"

        return EligibilityResult(
            member_id=request.member_id,
            status=status,
            plan_name=record.get("plan_name"),
            copay=_money_or_none(record.get("copay")),
            deductible_remaining=_money_or_none(record.get("deductible_remaining")),
            termination_date=termination_date,
            service_date=request.service_date,
            notes=notes,
        )


def _money_or_none(raw: object) -> Decimal | None:
    """Zero is a real answer (no copay); only absent values become None.
    Values pass through str() so numeric JSON never rides float artifacts."""
    if raw is None:
        return None
    return Decimal(str(raw))


def generate_270(request: EligibilityRequest, control_number: int = 1) -> str:
    """Render the X12 270 inquiry that a live provider would transmit.

    Minimal 005010X279A1 structure: enough to document the outbound shape
    and keep the audit trail honest about what would be sent.
    """
    dos = request.service_date.strftime("%Y%m%d")
    dob = request.subscriber_dob.strftime("%Y%m%d")
    segments = [
        f"ST*270*{control_number:04d}*005010X279A1",
        f"BHT*0022*13*ELIG{control_number:06d}*{dos}*0000",
        "HL*1**20*1",
        f"NM1*PR*2*PAYER*****PI*{request.payer_id}",
        "HL*2*1*21*1",
        f"NM1*1P*2*PROVIDER*****XX*{request.provider_npi}",
        "HL*3*2*22*0",
        f"NM1*IL*1*{request.subscriber_last_name.upper()}*"
        f"{request.subscriber_first_name.upper()}****MI*{request.member_id}",
        f"DMG*D8*{dob}",
        f"DTP*291*D8*{dos}",
        "EQ*30",
        f"SE*12*{control_number:04d}",
    ]
    return "~\n".join(segments) + "~\n"
