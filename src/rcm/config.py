"""Application settings loaded from environment / .env (pydantic-settings).

No credentials are hardcoded anywhere in this codebase; see .env.example.
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_data_dir() -> Path:
    # repo_root/src/rcm/config.py -> repo_root/data
    return Path(__file__).resolve().parents[2] / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="RCM_", env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    llm_provider: Literal["mock", "openai"] = "mock"
    openai_api_key: str | None = Field(default=None, validation_alias="OPENAI_API_KEY")
    openai_model: str = "gpt-4o"

    confidence_threshold: float = Field(default=0.90, ge=0.0, le=1.0)
    claim_value_threshold: Decimal = Decimal("5000")
    timely_filing_days: int = Field(default=90, gt=0)

    data_dir: Path = Field(default_factory=_default_data_dir)

    @property
    def rules_dir(self) -> Path:
        return self.data_dir / "rules"

    @property
    def synthetic_dir(self) -> Path:
        return self.data_dir / "synthetic"
