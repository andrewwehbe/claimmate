"""Instructor-backed LLM client (OpenAI-compatible providers).

Imports are lazy so that offline environments (tests, demo, CI) never need
the network or an API key unless this client is actually constructed.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, TypeVar

from pydantic import BaseModel

from rcm.llm.base import LLMClient

if TYPE_CHECKING:  # pragma: no cover - typing only
    pass

T = TypeVar("T", bound=BaseModel)


class InstructorLLM(LLMClient):
    """Structured-output client using Instructor over the OpenAI SDK.

    Swap providers by changing `instructor.from_openai(...)` to any client
    Instructor supports (Anthropic, Azure OpenAI, etc.); the rest of the
    platform depends only on LLMClient.generate().
    """

    def __init__(self, api_key: str, model: str) -> None:
        if not api_key:
            raise ValueError(
                "InstructorLLM requires an API key. Set OPENAI_API_KEY, or use "
                "RCM_LLM_PROVIDER=mock for offline operation."
            )
        import instructor
        from openai import OpenAI

        self._client = instructor.from_openai(OpenAI(api_key=api_key))
        self._model = model

    def generate(self, response_model: type[T], system_prompt: str, user_prompt: str) -> T:
        return self._client.chat.completions.create(
            model=self._model,
            response_model=response_model,
            max_retries=2,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        )
