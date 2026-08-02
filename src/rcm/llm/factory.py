"""LLM client factory driven by Settings."""

from __future__ import annotations

from rcm.config import Settings
from rcm.llm.base import LLMClient
from rcm.llm.mock import MockLLM


def get_llm_client(settings: Settings) -> LLMClient:
    if settings.llm_provider == "mock":
        return MockLLM()
    from rcm.llm.instructor_client import InstructorLLM

    if not settings.openai_api_key:
        raise ValueError(
            "RCM_LLM_PROVIDER=openai but OPENAI_API_KEY is not set. "
            "Add it to .env or the environment (see .env.example)."
        )
    return InstructorLLM(api_key=settings.openai_api_key, model=settings.openai_model)
