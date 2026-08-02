"""NCCI (National Correct Coding Initiative) rule engine.

This module is fully deterministic. The provider is a pluggable interface:
`JsonNCCIRuleProvider` ships with a representative seed of real NCCI edits in
data/rules/ncci_rules.json (20-30 rules).

Swapping in the full CMS dataset in production
----------------------------------------------
CMS publishes the complete PTP (Procedure-to-Procedure) and MUE (Medically
Unlikely Edits) files quarterly at
https://www.cms.gov/medicare/coding-billing/ncci-medicare as CSV/Excel.
To use them: implement a new NCCIRuleProvider subclass (e.g.
CmsCsvNCCIRuleProvider) whose __init__ ingests those files into the same
in-memory index shape used here ({(column1, column2): PTPEdit},
{cpt: MUELimit}), then inject it wherever JsonNCCIRuleProvider is
constructed (CodingAgent, ClaimScrubber). No other code changes are needed -
all callers depend only on the NCCIRuleProvider interface.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

from rcm.rules.loader import load_rules_json

# Modifiers that attest to a distinct procedural service and unbundle a
# modifier-indicator-1 PTP pair (59 plus the X{EPSU} subset modifiers).
DISTINCT_SERVICE_MODIFIERS = frozenset({"59", "XE", "XP", "XS", "XU"})


class PTPEdit(BaseModel):
    """Procedure-to-procedure edit: column2 is not separately payable with
    column1 unless modifier_indicator is '1' and a distinct-service modifier
    is present on the column2 line."""

    column1: str
    column2: str
    modifier_indicator: Literal["0", "1"]
    rationale: str = ""


class MUELimit(BaseModel):
    """Medically Unlikely Edit: max units of service per code per day."""

    code: str
    max_units: int = Field(ge=1)
    rationale: str = ""


class NCCIRuleProvider(ABC):
    """Interface every NCCI data source must implement."""

    @abstractmethod
    def ptp_edit(self, column1: str, column2: str) -> PTPEdit | None:
        """Return the PTP edit for the ordered pair, or None if no edit exists."""

    @abstractmethod
    def mue_limit(self, code: str) -> MUELimit | None:
        """Return the MUE unit limit for a code, or None if unlimited/unknown."""

    @abstractmethod
    def mutually_exclusive(self, code_a: str, code_b: str) -> bool:
        """True if the two codes may never be reported together (either order)."""


class JsonNCCIRuleProvider(NCCIRuleProvider):
    """NCCI provider backed by the local JSON seed file (see module docstring
    for how to swap in the full CMS files in production)."""

    def __init__(self, rules_dir: Path, filename: str = "ncci_rules.json") -> None:
        raw = load_rules_json(rules_dir, filename)
        self._ptp: dict[tuple[str, str], PTPEdit] = {}
        for entry in raw["ptp_edits"]:
            edit = PTPEdit(**entry)
            self._ptp[(edit.column1, edit.column2)] = edit
        self._mue: dict[str, MUELimit] = {}
        for entry in raw["mue_limits"]:
            limit = MUELimit(**entry)
            self._mue[limit.code] = limit
        self._exclusive: set[frozenset[str]] = {
            frozenset(pair) for pair in raw["mutually_exclusive"]
        }

    def ptp_edit(self, column1: str, column2: str) -> PTPEdit | None:
        return self._ptp.get((column1, column2))

    def mue_limit(self, code: str) -> MUELimit | None:
        return self._mue.get(code)

    def mutually_exclusive(self, code_a: str, code_b: str) -> bool:
        return frozenset({code_a, code_b}) in self._exclusive
