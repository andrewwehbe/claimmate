# CLAUDE.md - rcm-engine

## Project header
- **Stack:** Python 3.11+ (3.12 venv), Pydantic v2, pydantic-settings, structlog, Instructor (LLM), pytest. Frontend: React 18 + TS + Vite + Tailwind + TanStack Query + MSW in `frontend/`.
- **Users:** medical billers / certified coders (HITL reviewers); practice owners (metrics).
- **Tenancy:** single-tenant engine (per-practice deployment assumed); no multi-tenant auth yet.
- **Auth:** none yet - engine is a library + demo; frontend runs on MSW mocks.
- **Money:** claims carry real dollar amounts as `Decimal`; no payments are moved by this system.
- **Stage:** Gate 0 prototype. Synthetic data only. Not connected to any EHR, clearinghouse, or payer.

## Non-negotiables for this repo
- Deterministic logic (EDI rendering, NCCI validation, scrubbing, HITL routing, citation selection) stays pure Python. LLMs only: note extraction, code suggestion, appeal prose.
- Every LLM call goes through `rcm.llm.base.LLMClient`. Tests and demo must pass offline with MockLLM and zero API keys.
- No PII/PHI in logs - all logging through `rcm.logging_config` (redaction processor). No real patient data anywhere; synthetic only, no real-looking SSNs.
- No credentials in code. Config via pydantic-settings + `.env` (see `.env.example`).
- 837P output is golden-file tested - any renderer change requires regenerating `tests/golden/expected_837p.txt` deliberately and reviewing the diff.
- Rules engines are pluggable JSON seeds in `data/rules/` - never hardcode CARC/NCCI/fee data in Python.

## Standing engineering rules (Andrew)
Never: N+1 queries, unpaginated reads, missing timeouts, icon-only controls without labels, optimistic UI without rollback, swallowed errors, secrets client-side, dev bypasses, client-trusted authorization.
Always: server-side authz per role+tenant (when auth lands), boundary validation, loading/empty/error states, idempotency, no PII in logs, reversible migrations, transactions, DB constraints, failure-path tests.

End-of-task report format: (1) what changed file by file, (2) what was deliberately not handled and why, (3) what breaks first under load/abuse.

## Commands
```powershell
.\.venv\Scripts\python -m pytest          # full suite, offline
.\.venv\Scripts\python scripts\demo.py    # end-to-end demo
```
Note: pip on this machine needs `--trusted-host pypi.org --trusted-host files.pythonhosted.org` (SSL interception).
