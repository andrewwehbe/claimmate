# Design Decisions

Autonomous decisions made during the build, with rationale. Ordered by phase.

## Environment

1. **Python 3.12 venv with `--trusted-host` pip flags.** The machine's network
   intercepts SSL (pip failed with CERTIFICATE_VERIFY_FAILED against PyPI).
   Dependencies installed with `--trusted-host pypi.org --trusted-host
   files.pythonhosted.org`. Remove the flags on a network with a clean
   certificate chain.

## Phase 1 - Models

2. **NPI validation uses the CMS algorithm exactly**: Luhn over `80840` +
   first 9 digits, 10th digit is the check digit. Verified against the CMS
   documentation example NPI 1234567893. All synthetic NPIs in the repo pass
   the real checksum.
3. **ICD-10 regex excludes U-codes** (`[A-TV-Z]`), matching the classic
   ICD-10-CM structure. ICD-10-CM later added U07/U09 (COVID-era); if you
   need them, widen the first character class in
   `src/rcm/models/validators.py`. Documented rather than silently allowed.
4. **POS codes are a representative frozen set**, not the full CMS list;
   same swap-in pattern as the rules files.
5. **Money is `Decimal` everywhere.** Charges, payments, adjustments -
   floats never touch dollar amounts.
6. **Field confidence lives on `ClinicalEncounter.field_confidence`**
   (dict field -> score) rather than a parallel wrapper object, so the claim
   carries its provenance through coding, scrubbing, and HITL.

## Phase 2 - Extraction

7. **Extraction hard-fails (ExtractionError) when NPI, service date, or all
   diagnoses are missing** instead of producing a partial encounter. A claim
   cannot be billed without them, and a human must look at the source note -
   there is no safe automated fallback.
8. **MockLLM is a real heuristic parser**, not canned fixtures: regex SOAP
   section detection, abbreviation expansion (HTN, DM2, c/o, ...), keyword
   -> code tables, and template letter assembly. Confidence drops when
   abbreviations were expanded or sections were missing, so the HITL
   confidence paths are exercised honestly by the tests and demo.

## Phase 3 - Coding

9. **Validation score = 1 - 0.25 per NCCI violation (floor 0)**; overall
   confidence = min(all field confidences and per-code confidences) x
   validation score, per the spec's formula. min() (not mean) so one weak
   link drags the whole claim into review.
10. **Claims with NCCI violations are still built and rendered** (violations
    recorded in `validation_flags`) rather than blocked outright - the HITL
    router guarantees a human sees them, and reviewers need the full claim
    context to fix them. Claims with zero valid diagnoses or procedures are
    not built (`CodingResult.claim = None`).
11. **PTP indicator-1 pairs without a 59/X modifier are flagged in both the
    coding agent and the scrubber.** Redundant on purpose: the coding check
    prices the confidence penalty, the scrub finding carries the ERROR
    severity that forces HITL routing.
12. **Fees come from a local fee schedule JSON** with a default fee for
    unknown codes; production should load the practice charge master.

## Phase 4 - Claims / EDI

13. **837P segments are rendered with `~` terminator + newline separators**
    for readability; golden-file test asserts byte-for-byte stability.
    Clearinghouses accept newline-separated EDI; strip newlines if a target
    requires a continuous stream.
14. **Control numbers, dates, and times are caller-supplied via
    `InterchangeConfig`** - the builder never reads the clock, which is what
    makes byte-for-byte golden testing possible and reruns idempotent.
15. **Modifier-25 rule approximation**: an E/M billed same-day with any
    surgical (10004-69990) or medicine (90281-99199) procedure requires
    modifier 25; lab codes (80047-89398), venipuncture 36415, and HCPCS
    drugs/supplies are exempt. The real rule keys on global-period
    indicators from the MPFS relative value file - swap the predicate in
    `ClaimScrubber._requires_mod25_pairing` when that file is loaded.
16. **Timely filing is checked against a caller-supplied submission date**
    (no wall-clock reads in the scrubber), with an ERROR past the window and
    a WARNING inside the final 14 days.
17. **Medical necessity checking is allow-list based and only for codes
    present in the map** - codes absent from `scrub_rules.json` are skipped
    rather than warned, because a seed table cannot enumerate all coverage.

## Phase 5 - Denials / Appeals

18. **A claim counts as denied** when CLP02 = 4, or when paid = 0 with CO/PI
    adjustments present (covers partial reversals in real 835s).
19. **Primary denial reason = the CO/PI/OA adjustment with the largest
    amount**; denied amount = sum of all CO/PI/OA adjustments. PR
    (patient-responsibility) groups never trigger appeals.
20. **Anti-fabrication design for citations**: the LLM prompt excludes the
    citation list entirely and instructs the model not to cite; the
    References section is appended deterministically from
    `data/rules/citations.json`. A hallucinated citation cannot appear
    because citations never pass through the model.
21. **CARC 45/18 and PR-group codes are marked non-appealable** in the seed
    taxonomy (contractual/duplicate); unknown CARCs default to
    OTHER/appealable with a note, biasing toward human review rather than
    silent write-off.

## Phase 6 - HITL / Orchestration

22. **Routing thresholds are strict inequalities** (`< 0.90`, `> $5,000`) so
    a claim exactly at threshold auto-approves; boundary tested.
23. **WARNING findings do not route by themselves** - only ERROR severity,
    low confidence, or high value do. Warnings ride along in the queue item
    for reviewer context.
24. **PHI redaction is a structlog processor** applied before rendering:
    identity keys are `[REDACTED]` recursively and SSN-shaped strings are
    masked defensively. Pipelines log claim IDs, codes, and confidence -
    never names, DOBs, member IDs, or addresses.
25. **The HITL queue is in-memory** (list on the router). Production needs a
    durable store (DB table + assignment workflow); the routing decision
    logic is the part meant to be reused.

## Cross-cutting

26. **Demo and tests pin submission date to 2026-08-02** and note dates to
    July 2026 so timely-filing results never drift as real time passes.
27. **The 2-page blueprint PDF** (medworx-deck) matches this build's
    architecture: deterministic validation layered over LLM output, <0.90
    confidence to human review, traceable references on every appeal.
28. **Frontend lives in `frontend/`** as a standalone Vite SPA with MSW
    mocks (the spec's `src/types/` is `frontend/src/types/`), keeping the
    Python `src/` layout untouched.

## Multi-portal architecture (2026-08-02, second iteration)

29. **Three access points + public landing**: `/` (marketing + portal
    selector), `/practice` (client practices: signup wizard, dashboard,
    integration health, claim status), `/ops` (internal RCM operations -
    the original four screens moved here, plus client management and the
    appeals workbench), `/payer` (insurer appeal inbox + remittances).
    Old top-level routes redirect to `/ops/...`.
30. **Auth is demo-grade by design**: localStorage identity per portal with
    labeled "Demo access" entry screens. Real deployment needs actual
    authentication (per-tenant practice logins, staff SSO, payer accounts)
    plus server-side authorization - the portal shells are structured so a
    real auth provider can replace `lib/identity.ts`.
31. **All three portals share one MSW in-memory store**, so payer decisions
    (overturn/uphold) flow back into the ops appeals view and practice
    signups appear in ops client management - the demo shows the actual
    information flow the product promises.
32. **Landing-page stats are computed from the live mock store**, not
    hardcoded copy, so marketing numbers can never contradict the demo.
33. **Company branded as fictional "RemitPath"** (labeled fictional);
    real insurer names appear only as payer labels; every number is
    synthetic.

## RCM-realism upgrade (2026-08-02, third iteration)

34. **Payer portal reframed as "Payer Simulator."** Real payers do not adopt
    vendor portals; appeals go outbound into payer-owned channels (Availity,
    fax, certified mail, 275 electronic attachments). The portal stays
    because it demos the full loop, but it is labeled as playing the
    payer's role, and every appeal now carries a `submission_channel` so
    the outbound model is visible in the UI.
35. **Eligibility runs before coding and scrubbing** in the claims pipeline.
    A claim for inactive coverage is a guaranteed denial no matter how well
    it is coded, so the check happens as early as the data allows (right
    after extraction). Implemented as a pluggable `EligibilityProvider`;
    the JSON-backed mock simulates the 271 answer while `generate_270`
    renders the real inquiry we would transmit.
36. **NOT_FOUND eligibility is treated like inactive coverage** (ERROR
    finding, HITL route). A subscriber the payer cannot identify will
    reject at the clearinghouse or deny; a human must fix the member ID
    before submission. Termination is evaluated against the date of
    service: an "active" plan terminated before the DOS comes back
    TERMINATED.
37. **Claim lifecycle is an explicit state machine**
    (generated -> submitted_to_clearinghouse -> accepted/rejected ->
    payer_received -> paid/denied, rejected -> resubmit, denied -> paid
    after overturn). Illegal transitions raise instead of silently
    corrupting state. 999 (AK9/IK5) and 277CA (TRN/STC categories A1-A8)
    acknowledgment parsing is deterministic with unknown-category failures
    loud, not guessed.
38. **Appeals have levels with per-payer filing windows**
    (reconsideration -> level 1 -> level 2 -> external review, terminal).
    Windows load from `data/rules/appeal_deadlines.json` (defaults +
    per-payer overrides); the deadline clock restarts at each level from
    the prior decision date. An upheld appeal escalates by creating a
    linked successor, preserving each level's own record.
39. **Audit log is append-only by design** (frontend store today, DB table
    in production): every state-changing action records timestamp, actor,
    portal, action, entity, and a before/after summary. No edit or delete
    path exists. This is the compliance differentiator and the basis for
    the /trust page's claims.
40. **"Direct database connection" removed from onboarding.** No PM/EHR
    vendor grants third-party DB access; the realistic options are vendor
    APIs, FHIR, or SFTP flat-file exports, and production onboarding also
    requires per-payer EDI enrollment (2-6 weeks), now stated in the
    wizard so sales expectations match operational reality.
41. **Landing stats are labeled "Simulated demo data."** The demo's
    credibility with technical buyers depends on never blurring simulated
    and real performance.
42. **Product renamed "Claimate"** (2026-08-02, founder decision),
    replacing the placeholder "RemitPath" everywhere user-facing and in
    frontend metadata. Earlier decisions referencing RemitPath are left
    as written for historical accuracy.
43. **Dark mode is the default theme** with a persisted light/dark toggle.
    Same token discipline in both themes (near-black surfaces, no pure
    white text, single blue primary, severity hues adjusted only for
    contrast); the printable monthly report always renders light.
    *(Superseded by #45.)*

## Marketing redesign (2026-08-02, fourth iteration - founder direction)

44. **Brand spelling is "ClaimMate"** (capital M). Internal storage keys
    and demo domains keep the lowercase `claimate-*` form (keys are not
    brand typography). The wordmark is plain type - the leftover monogram
    chip next to the name was removed.
45. **Light mode only; dark mode removed** (reverses #43, founder
    decision): the product should reflect clinical cleanliness and
    trustworthiness - white coats, white surfaces. The CSS-variable token
    system stays (light values only) so retheming later is cheap.
46. **The homepage sells to practices only.** The three-portal selector is
    gone; Operations and the Payer Simulator moved to a discreet footer
    line - they are demo/staff surfaces, not customer acquisition paths.
    The "Simulated demo data" caption was removed from homepage stats at
    the founder's direction; the /trust page still discloses demo status.
47. **Marketing is multi-page, wide, and iOS-inspired** - /, /how-it-works,
    and /trust share a MarketingLayout (sticky header nav, mobile menu)
    with 48-68px display type, layouts that fill 16:9 desktops
    (~1280-1440px containers), large drawn SVG graphics in the product
    palette, and 12-16px radii ON MARKETING PAGES ONLY. The console keeps
    the dense 6px design language; still no gradients, emoji, or stock
    imagery anywhere.
