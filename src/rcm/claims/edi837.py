"""X12 837P (professional claim) segment structures and renderer.

Fully deterministic: control numbers, dates, and times come from the
validated EDI837P input model (never wall-clock time), so identical input
always renders byte-for-byte identical output - which the golden-file test
asserts.

Rendering convention: elements joined with '*', trailing empty elements
trimmed (except ISA, which is fixed-width per X12), segments terminated with
'~' and separated by newlines for human readability. Clearinghouses accept
newline-separated segments; strip newlines if a target requires a continuous
stream.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from rcm.models.claim import CodedClaim, CodedProcedure
from rcm.models.edi import EDI837P

ELEMENT_SEP = "*"
SEGMENT_TERM = "~"
COMPONENT_SEP = ":"


@dataclass
class Segment:
    """One X12 segment: an ID plus positional elements."""

    seg_id: str
    elements: list[str] = field(default_factory=list)
    fixed_width: bool = False

    def render(self) -> str:
        elements = list(self.elements)
        if not self.fixed_width:
            while elements and elements[-1] == "":
                elements.pop()
        return ELEMENT_SEP.join([self.seg_id, *elements]) + SEGMENT_TERM


@dataclass
class ISASegment:
    sender_id: str
    receiver_id: str
    date_yymmdd: str
    time_hhmm: str
    control_number: int
    usage_indicator: str

    def to_segment(self) -> Segment:
        return Segment(
            "ISA",
            [
                "00", " " * 10, "00", " " * 10,
                "ZZ", self.sender_id.ljust(15),
                "ZZ", self.receiver_id.ljust(15),
                self.date_yymmdd, self.time_hhmm,
                "^", "00501",
                f"{self.control_number:09d}", "0", self.usage_indicator, COMPONENT_SEP,
            ],
            fixed_width=True,
        )


@dataclass
class GSSegment:
    sender_id: str
    receiver_id: str
    date_yyyymmdd: str
    time_hhmm: str
    control_number: int

    def to_segment(self) -> Segment:
        return Segment(
            "GS",
            [
                "HC", self.sender_id, self.receiver_id,
                self.date_yyyymmdd, self.time_hhmm,
                str(self.control_number), "X", "005010X222A1",
            ],
        )


@dataclass
class STSegment:
    control_number: str

    def to_segment(self) -> Segment:
        return Segment("ST", ["837", self.control_number, "005010X222A1"])


@dataclass
class BHTSegment:
    reference_id: str
    date_yyyymmdd: str
    time_hhmm: str

    def to_segment(self) -> Segment:
        return Segment(
            "BHT", ["0019", "00", self.reference_id, self.date_yyyymmdd, self.time_hhmm, "CH"]
        )


@dataclass
class NM1Segment:
    entity_code: str            # 41 submitter, 40 receiver, 85 billing, IL subscriber, PR payer, 82 rendering
    entity_type: str            # 1 person, 2 organization
    name_last_or_org: str
    name_first: str = ""
    id_qualifier: str = ""      # XX=NPI, MI=member ID, 46=ETIN, PI=payer ID
    id_value: str = ""

    def to_segment(self) -> Segment:
        return Segment(
            "NM1",
            [
                self.entity_code, self.entity_type, self.name_last_or_org,
                self.name_first, "", "", "", self.id_qualifier, self.id_value,
            ],
        )


@dataclass
class HLSegment:
    hierarchical_id: int
    parent_id: str              # "" for the root
    level_code: str             # 20 billing provider, 22 subscriber
    has_children: int

    def to_segment(self) -> Segment:
        return Segment(
            "HL",
            [str(self.hierarchical_id), self.parent_id, self.level_code, str(self.has_children)],
        )


@dataclass
class CLMSegment:
    claim_id: str
    total_charge: str
    place_of_service: str

    def to_segment(self) -> Segment:
        pos_composite = COMPONENT_SEP.join([self.place_of_service, "B", "1"])
        return Segment(
            "CLM",
            [self.claim_id, self.total_charge, "", "", pos_composite, "Y", "A", "Y", "Y"],
        )


@dataclass
class SV1Segment:
    procedure: CodedProcedure

    def to_segment(self) -> Segment:
        composite = COMPONENT_SEP.join(["HC", self.procedure.code, *self.procedure.modifiers])
        pointers = COMPONENT_SEP.join(str(p) for p in self.procedure.diagnosis_pointers)
        return Segment(
            "SV1",
            [
                composite, f"{self.procedure.charge:.2f}", "UN",
                str(self.procedure.units), "", "", pointers,
            ],
        )


def to_edi_string(segments: list[Segment]) -> str:
    return "\n".join(seg.render() for seg in segments) + "\n"


class EDI837Builder:
    """Renders a validated EDI837P model into X12 segments."""

    def build_segments(self, doc: EDI837P) -> list[Segment]:
        ic = doc.interchange
        claim = doc.claim
        bp = doc.billing_provider
        patient = claim.patient

        segments: list[Segment] = [
            ISASegment(
                sender_id=ic.sender_id,
                receiver_id=ic.receiver_id,
                date_yymmdd=ic.date_yyyymmdd[2:],
                time_hhmm=ic.time_hhmm,
                control_number=ic.interchange_control_number,
                usage_indicator=ic.usage_indicator,
            ).to_segment(),
            GSSegment(
                sender_id=ic.sender_id,
                receiver_id=ic.receiver_id,
                date_yyyymmdd=ic.date_yyyymmdd,
                time_hhmm=ic.time_hhmm,
                control_number=ic.group_control_number,
            ).to_segment(),
        ]

        transaction: list[Segment] = [
            STSegment(ic.transaction_control_number).to_segment(),
            BHTSegment(claim.claim_id, ic.date_yyyymmdd, ic.time_hhmm).to_segment(),
            NM1Segment("41", "2", bp.organization_name, "", "46", ic.sender_id).to_segment(),
            Segment("PER", ["IC", bp.contact_name, "TE", bp.contact_phone]),
            NM1Segment("40", "2", ic.receiver_name, "", "46", ic.receiver_id).to_segment(),
            HLSegment(1, "", "20", 1).to_segment(),
            NM1Segment("85", "2", bp.organization_name, "", "XX", bp.npi).to_segment(),
            Segment("N3", [bp.address_line1]),
            Segment("N4", [bp.city, bp.state, bp.zip_code]),
            Segment("REF", ["EI", bp.tax_id]),
            HLSegment(2, "1", "22", 0).to_segment(),
            Segment("SBR", ["P", "18", patient.group_number or "", "", "", "", "", "", "CI"]),
            NM1Segment(
                "IL", "1", patient.last_name.upper(), patient.first_name.upper(),
                "MI", patient.member_id,
            ).to_segment(),
            Segment("N3", [patient.address_line1]),
            Segment("N4", [patient.city, patient.state, patient.zip_code]),
            Segment(
                "DMG", ["D8", patient.date_of_birth.strftime("%Y%m%d"), patient.gender]
            ),
            NM1Segment("PR", "2", patient.payer_name, "", "PI", patient.payer_id or "").to_segment(),
            CLMSegment(
                claim.claim_id, f"{claim.total_charge:.2f}", claim.place_of_service
            ).to_segment(),
            self._hi_segment(claim),
            self._rendering_provider(claim),
        ]

        service_date = claim.encounter.service_date.strftime("%Y%m%d")
        for idx, proc in enumerate(claim.procedures, start=1):
            transaction.append(Segment("LX", [str(idx)]))
            transaction.append(SV1Segment(proc).to_segment())
            transaction.append(Segment("DTP", ["472", "D8", service_date]))

        # SE01 counts every segment from ST through SE inclusive
        transaction.append(
            Segment("SE", [str(len(transaction) + 1), ic.transaction_control_number])
        )

        segments.extend(transaction)
        segments.append(Segment("GE", ["1", str(ic.group_control_number)]))
        segments.append(Segment("IEA", ["1", f"{ic.interchange_control_number:09d}"]))
        return segments

    def build(self, doc: EDI837P) -> str:
        return to_edi_string(self.build_segments(doc))

    @staticmethod
    def _hi_segment(claim: CodedClaim) -> Segment:
        elements: list[str] = []
        for idx, dx in enumerate(claim.diagnoses):
            qualifier = "ABK" if idx == 0 else "ABF"
            elements.append(COMPONENT_SEP.join([qualifier, dx.code.replace(".", "")]))
        return Segment("HI", elements)

    @staticmethod
    def _rendering_provider(claim: CodedClaim) -> Segment:
        name = claim.encounter.provider_name
        for suffix in (", MD", ", DO", ", NP", ", PA", " MD", " DO"):
            if name.endswith(suffix):
                name = name[: -len(suffix)]
                break
        parts = name.strip().split()
        last = parts[-1].upper() if parts else "UNKNOWN"
        first = " ".join(parts[:-1]).upper()
        return NM1Segment(
            "82", "1", last, first, "XX", claim.encounter.provider_npi
        ).to_segment()
