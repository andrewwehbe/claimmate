"""Appeal letter generation.

The LLM drafts prose from a structured AppealContext; the citations in that
context are loaded exclusively from data/rules/citations.json. The References
section is appended deterministically from those same citations after
drafting, so a fabricated citation can never reach the letter: the LLM is
explicitly instructed not to cite, and the only citations rendered are the
file-sourced ones.
"""

from __future__ import annotations

import json
from decimal import Decimal
from pathlib import Path

from rcm.llm.base import LLMClient
from rcm.denials.schemas import AppealDraft
from rcm.models.appeal import AppealContext, AppealLetter, Citation, DisputedService
from rcm.models.era import DenialAnalysis
from rcm.rules.loader import load_rules_json

SYSTEM_PROMPT = (
    "You draft payer appeal letters for a medical billing office. Write a "
    "firm, professional letter from the structured context. Do NOT cite any "
    "law, regulation, or policy from memory - the references section is "
    "appended separately from a verified source list."
)


class AppealGenerator:
    def __init__(self, llm: LLMClient, rules_dir: Path) -> None:
        self._llm = llm
        raw = load_rules_json(rules_dir, "citations.json")
        self._citations: dict[str, list[Citation]] = {
            category: [Citation(**c) for c in entries]
            for category, entries in raw.items()
            if not category.startswith("_")
        }

    def citations_for(self, category: str) -> list[Citation]:
        return list(self._citations.get(category, self._citations.get("other", [])))

    def build_context(
        self,
        analysis: DenialAnalysis,
        payer_name: str,
        clinical_summary: str,
        disputed_services: list[DisputedService],
    ) -> AppealContext:
        return AppealContext(
            claim_id=analysis.claim_id,
            payer_name=payer_name,
            denial_category=analysis.category,
            carc_code=analysis.carc_code,
            carc_description=analysis.carc_description,
            rarc_codes=analysis.rarc_codes,
            rarc_descriptions=analysis.rarc_descriptions,
            clinical_summary=clinical_summary,
            disputed_services=disputed_services,
            denied_amount=analysis.denied_amount,
            citations=self.citations_for(analysis.category.value),
        )

    def generate(self, context: AppealContext) -> AppealLetter:
        prompt = (
            "Draft the appeal letter body for this denial.\n"
            "CONTEXT_JSON:\n"
            + json.dumps(_context_for_prompt(context), indent=2)
        )
        draft: AppealDraft = self._llm.generate(AppealDraft, SYSTEM_PROMPT, prompt)

        references = "\n".join(
            f"  [{i}] {c.source}, {c.reference} - {c.summary}"
            for i, c in enumerate(context.citations, start=1)
        )
        body = draft.body.rstrip() + (
            "\n\nReferences (verified authorities):\n" + references
            if context.citations
            else ""
        )
        return AppealLetter(
            claim_id=context.claim_id,
            level=context.level,
            subject=draft.subject,
            body=body,
            citations=context.citations,
            generated_by=self._llm.name,
        )


def _context_for_prompt(context: AppealContext) -> dict:
    """Serialize the context for the prompt WITHOUT the citations - the LLM
    never sees or reproduces them; they are appended deterministically."""
    data = context.model_dump(mode="json", exclude={"citations"})
    data["denied_amount"] = f"{Decimal(str(context.denied_amount)):.2f}"
    return data
