"""Deterministic format validators shared by all models.

These are pure Python and are the authoritative gate for every code that an
LLM suggests: anything that fails here is rejected, never auto-corrected.
"""

from __future__ import annotations

import re
from datetime import date

ICD10_RE = re.compile(r"^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$")
CPT_RE = re.compile(r"^\d{5}$")
HCPCS_RE = re.compile(r"^[A-V]\d{4}$")
MODIFIER_RE = re.compile(r"^[A-Z0-9]{2}$")
NPI_RE = re.compile(r"^\d{10}$")

# CMS place-of-service code set (representative; full list at cms.gov)
VALID_POS_CODES = frozenset(
    {
        "01", "02", "03", "04", "09", "10", "11", "12", "13", "14", "15", "16",
        "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "31", "32",
        "33", "34", "41", "42", "49", "50", "51", "52", "53", "54", "55", "56",
        "57", "58", "60", "61", "62", "65", "71", "72", "81", "99",
    }
)

MAX_PATIENT_AGE_YEARS = 130


def luhn_check_digit(digits: str) -> int:
    """Luhn check digit for a numeric payload (check digit appended after)."""
    total = 0
    for i, ch in enumerate(reversed(digits)):
        d = int(ch)
        if i % 2 == 0:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return (10 - total % 10) % 10


def is_valid_npi(npi: str) -> bool:
    """NPI check per CMS: Luhn over '80840' + first 9 digits, 10th is check digit."""
    if not NPI_RE.fullmatch(npi):
        return False
    return luhn_check_digit("80840" + npi[:9]) == int(npi[9])


def is_valid_icd10(code: str) -> bool:
    return bool(ICD10_RE.fullmatch(code))


def is_valid_procedure_code(code: str) -> bool:
    """CPT (5 digits) or HCPCS Level II (letter + 4 digits)."""
    return bool(CPT_RE.fullmatch(code) or HCPCS_RE.fullmatch(code))


def is_valid_modifier(modifier: str) -> bool:
    return bool(MODIFIER_RE.fullmatch(modifier))


def is_valid_pos(pos: str) -> bool:
    return pos in VALID_POS_CODES


def is_sane_dob(dob: date) -> bool:
    today = date.today()
    if dob > today:
        return False
    return (today.year - dob.year) <= MAX_PATIENT_AGE_YEARS


def is_em_code(cpt: str) -> bool:
    """Evaluation & Management CPT ranges (office, inpatient, ED, preventive)."""
    if not CPT_RE.fullmatch(cpt):
        return False
    n = int(cpt)
    return (
        99202 <= n <= 99215
        or 99221 <= n <= 99239
        or 99281 <= n <= 99285
        or 99341 <= n <= 99350
        or 99381 <= n <= 99397
    )


def is_lab_code(cpt: str) -> bool:
    """Pathology/laboratory CPT range (exempt from modifier-25 pairing rule)."""
    if not CPT_RE.fullmatch(cpt):
        return False
    return 80047 <= int(cpt) <= 89398
