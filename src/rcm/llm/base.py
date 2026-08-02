"""Single LLM entry point.

Every LLM interaction in the platform (clinical extraction, code suggestion,
appeal drafting) goes through this interface and returns a validated Pydantic
model. Deterministic logic never lives behind this interface.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LLMClient(ABC):
    @abstractmethod
    def generate(self, response_model: type[T], system_prompt: str, user_prompt: str) -> T:
        """Run one structured-output completion and return a validated instance
        of response_model."""

    @property
    def name(self) -> str:
        return type(self).__name__
