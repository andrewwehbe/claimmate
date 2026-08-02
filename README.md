# Claimate (rcm-engine)

A modular, HIPAA-conscious Revenue Cycle Management platform in Python 3.11+.
It processes medical charts, automates claim generation (X12 837P), predicts
denial risk via deterministic scrubbing, analyzes 835 remittances, and drafts
appeal letters — with a hard boundary between probabilistic LLM steps and
deterministic billing logic.

Everything runs offline by default (MockLLM); no API keys are required for
tests or the demo.

## Quickstart

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
.\.venv\Scripts\python -m pytest          # 110 tests, offline
.\.venv\Scripts\python scripts\demo.py    # both pipelines end-to-end
```

## Architecture

```
                 raw SOAP note                      835 / ERA text
                      |                                   |
              [ extraction/ ]  LLM                 [ denials/era_parser ]  pure Python
              SOAPExtractor -> ClinicalEncounter   parse_835 -> ERA835
                      |                                   |
              [ coding/ ]      LLM suggests        [ denials/taxonomy ]   pure Python
              CodingAgent      codes; NCCI/format  DenialClassifier
                      |        validation is       CARC/RARC -> category
                      |        pure Python                |
              [ claims/ ]      pure Python         [ denials/appeals ]    LLM drafts;
              ClaimScrubber -> ScrubFindings       AppealGenerator        citations from
              EDI837Builder -> 837P string         -> AppealLetter        local JSON only
                      |
              [ hitl/ ]        pure Python
              HITLRouter: confidence < 0.90 | value > $5,000 | ERROR finding
                      |
        auto-submit  or  human review queue
```

Module layout (`src/rcm/`):

| Module | Responsibility | LLM? |
|---|---|---|
| `models/` | Pydantic v2 domain models + format validators (NPI Luhn, ICD-10, CPT, POS, DOB) | no |
| `llm/` | Single `LLMClient` interface: `MockLLM` (offline) and `InstructorLLM` (real) | — |
| `extraction/` | SOAP note -> `ClinicalEncounter` with per-field confidence | yes |
| `eligibility/` | 270/271 verification: pluggable `EligibilityProvider`, DOS-effective coverage status | no |
| `coding/` | Code suggestion (LLM) + deterministic NCCI PTP/MUE/exclusivity validation | suggest only |
| `rules/` | Pluggable `NCCIRuleProvider` + JSON seed loaders | no |
| `claims/` | 837P segment dataclasses + renderer; deterministic scrubber | no |
| `clearinghouse/` | Claim lifecycle state machine; 999 + 277CA acknowledgment parsing | no |
| `denials/` | 835 parser, CARC/RARC taxonomy, appeal generation, appeal-level deadline rules | draft only |
| `hitl/` | Routing thresholds and review queue | no |
| `pipeline.py` | Orchestrators + structlog logging with PHI redaction | — |

Claims pipeline order: extraction -> **eligibility (270/271)** -> coding ->
scrubbing -> 837P -> HITL routing. Inactive/terminated/not-found coverage on
the date of service produces an ERROR finding (`ELIGIBILITY_INACTIVE`) that
forces human review before submission.

### The determinism boundary

LLMs are used for exactly three things: clinical note extraction, code
suggestion, and appeal letter prose. Everything with compliance or money
consequences is pure Python:

- **Format validation** — every LLM-suggested code is re-validated (ICD-10
  regex, CPT/HCPCS format, NPI Luhn). Failures are rejected and flagged,
  never auto-corrected.
- **NCCI validation** — PTP edit pairs (e.g. 80048 + 82947 unbundling),
  MUE unit limits, mutually exclusive codes.
- **EDI formatting** — 837P output is rendered from typed dataclasses with
  caller-supplied control numbers/timestamps: identical input produces
  byte-for-byte identical output (golden-file tested).
- **Scrubbing** — modifier 25/59 checks, prior-auth list, NPI checks,
  diagnosis-procedure medical necessity, timely filing window.
- **Appeal citations** — letters may only cite entries from
  `data/rules/citations.json`. The LLM is instructed not to cite anything,
  and the References section is appended deterministically from the file, so
  a fabricated regulation citation cannot reach a letter.
- **HITL routing** — threshold rules from config, not model judgment.

Confidence model: `overall = min(all field and per-code confidences) x
validation_score`, where each NCCI violation deducts 0.25 from the
validation score.

## Swapping MockLLM for a real provider

1. Copy `.env.example` to `.env`.
2. Set `RCM_LLM_PROVIDER=openai` and `OPENAI_API_KEY=sk-...`
   (`RCM_OPENAI_MODEL` to pick the model).
3. Construct pipelines through the factory:

```python
from rcm.config import Settings
from rcm.llm.factory import get_llm_client

settings = Settings()
llm = get_llm_client(settings)   # MockLLM or InstructorLLM per env
```

`InstructorLLM` wraps the OpenAI SDK with [Instructor](https://python.useinstructor.com/)
for validated structured output and retries. To use another provider
(Anthropic, Azure), change one line in
`src/rcm/llm/instructor_client.py` (`instructor.from_openai(...)`) — the
rest of the platform depends only on `LLMClient.generate()`.

## Loading full CMS rule files in production

The repo ships representative seeds (20-30 real rules each) in `data/rules/`:

| File | Seed contents | Production source |
|---|---|---|
| `ncci_rules.json` | PTP edits, MUE limits, mutually exclusive pairs | CMS quarterly NCCI files: cms.gov/medicare/coding-billing/ncci-medicare |
| `carc_rarc.json` | CARC/RARC descriptions + denial taxonomy mapping | Full X12 code lists: x12.org/codes |
| `scrub_rules.json` | Prior-auth CPT list, CPT -> covered ICD-10 prefixes | Payer portals; LCD/NCD coverage tables |
| `citations.json` | Appeal citation authorities per denial category | Compliance-reviewed policy library |
| `fee_schedule.json` | Practice charge master | Practice PM system / contracted fees |
| `eligibility.json` | Mock member coverage roster for the 270/271 simulator | Real-time 270/271 via clearinghouse (Availity, Change Healthcare) |
| `appeal_deadlines.json` | Appeal filing windows per level with per-payer overrides | Payer contracts / regulatory windows (e.g. Medicare statutory) |

For NCCI specifically, implement a new `NCCIRuleProvider` subclass that
ingests the CMS CSVs into the same in-memory shape and inject it where
`JsonNCCIRuleProvider` is constructed — no other code changes needed (see
the docstring in `src/rcm/rules/ncci.py`). The other files can simply be
replaced wholesale; the JSON shapes are documented in each file's
`_comment` key.

## Data & privacy

- All test data is synthetic: invented names, member IDs, NPIs (valid Luhn
  but fabricated), and no real-looking SSNs.
- Structured logs pass through a PHI redaction processor
  (`src/rcm/logging_config.py`): identity fields are `[REDACTED]` and
  SSN-shaped strings are masked. Claim IDs and codes are logged; identities
  are not.
- No credentials in code; config via pydantic-settings + `.env`.

## Frontend

`frontend/` contains the Claimate multi-portal app (React 18 + TypeScript +
Vite + Tailwind, MSW-mocked API): practice portal, internal operations
console, payer simulator, public landing + trust pages, dark mode by
default. See `frontend/README.md` and `APP-GUIDE.md`.

## Repo map

```
src/rcm/            engine (see table above)
tests/              110 offline tests incl. golden-file 837P test
data/rules/         pluggable rule seeds
data/synthetic/     3 SOAP notes, clean 835, CO-50 denial 835
scripts/demo.py     end-to-end demo of both pipelines
DECISIONS.md        autonomous design decisions log
```
