"""Small JSON loader for rule/reference files under data/rules."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def load_rules_json(rules_dir: Path, name: str) -> Any:
    """Load a rules/reference JSON file by filename.

    Raises FileNotFoundError with a helpful message if the seed file is
    missing, since every rules engine depends on these files at startup.
    """
    path = rules_dir / name
    if not path.exists():
        raise FileNotFoundError(
            f"Rules file not found: {path}. Seed files ship in data/rules/; "
            f"check Settings.data_dir if you relocated them."
        )
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)
