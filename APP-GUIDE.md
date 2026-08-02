# ClaimMate - Full Application Guide

Live demo: https://rcm-engine-lovat.vercel.app
Repo: `C:\Users\HP\rcm-engine`

## What this app is

ClaimMate (fictional brand) is the working prototype of an RCM (Revenue Cycle
Management) automation startup for small-to-medium private medical practices
in the US. The pitch: practices connect their EHR or practice-management
system to our platform, our engine verifies eligibility, reads their
clinical charts, codes and submits claims automatically, catches
denial-causing errors before submission, and - the core differentiator -
works denials and appeals with the speed and win rate of a dedicated human
billing team, without the headcount.

The product has two halves in this repo:

1. **The engine** (`src/rcm/`, Python) - the real processing logic:
   eligibility verification (270/271), chart extraction, medical coding with
   NCCI validation, X12 837P claim generation, claim scrubbing,
   clearinghouse acknowledgment handling (999/277CA) with a strict claim
   lifecycle, 835 remittance parsing, denial classification, appeal letter
   generation with leveled deadlines, and human-in-the-loop routing.
   151 tests, runs fully offline.
2. **The web app** (`frontend/`, React) - the deployed multi-portal
   interface: a practice portal, our internal operations console, and a
   payer simulator, plus a multi-page marketing site (home, how-it-works,
   trust). It runs against an in-browser mock API (MSW) seeded with
   synthetic data, so the deployed site works with no server. All portals
   share one in-memory store, so actions in one portal visibly flow into
   the others. Light theme only, by design: clinical white cleanliness.

Nothing in the demo is real: no real auth, no real patients (all data is
synthetic), no real payer or clearinghouse connections.

---

## Page-by-page

### `/` - Homepage

Speaks only to medical practices: a large hero (48-68px display type),
"Get started" into the signup wizard, "Practice sign in", a wide drawn
claim-flow diagram (EHR into the ClaimMate engine, out to the payer, with
the auto-appeal loop on denials), three value cards, and big live
efficiency numerals read from the same store the portals use. Wide,
iOS-inspired layout that fills a 16:9 desktop and collapses cleanly to
mobile with a hamburger nav. Operations and the Payer Simulator are no
longer advertised here - they live on one discreet footer line for staff
and demo use.

### `/how-it-works` - How it works

Its own page (marketing content links out to pages instead of stacking on
one scroll): the three-step story - connect your EHR, we code and scrub
every claim, we fight every denial - each step a wide section with a drawn
visual (connection picker, coded-claim scrub, appeal timeline), plus the
efficiency stats against the 14-day manual baseline and a closing CTA.

### `/trust` - Trust & compliance

Plain-language page for buyers: HIPAA posture and BAAs, PHI handling
(masking, no PHI in logs), the append-only audit log, the exact
human-in-the-loop thresholds (confidence below 0.90, value above $5,000,
any ERROR finding goes to a certified coder), and the SOC 2 Type II
roadmap. Written in honest tense: what the demo does today vs what
production adds.

### Demo access screens (all three portals)

Each portal is gated by a "Demo access" screen instead of real login; the
identity persists in the browser and appears in the TopBar with Switch
portal / Sign out. Practice identities include healthy, degraded, and
pending-integration practices; operations identities are internal staff;
payer identities are per-insurer reviewers who see only their own appeals.

---

## Practice Portal

### `/practice/signup` - Onboarding wizard

Five steps: practice info (with real CMS Luhn validation on the group NPI),
EHR/PM system selection, integration method (**PM/EHR vendor API, FHIR API,
or SFTP flat-file export** - direct database access is not offered because
no PM vendor grants it), plan selection (Performance % / Hybrid SaaS +
per-claim / Denial recovery share), then review and submit. The plan step
includes an informational note that production onboarding also involves
per-payer EDI enrollment, typically 2-6 weeks per payer. Submitting lands
on the dashboard in "integration pending" state and the practice appears in
our ops client list.

### `/practice` - Practice dashboard

Claims volume, denial rate, revenue recovered this quarter, **"Posted to
your ledger"** (dollars from remittances our team has actually posted),
integration sync status, a denials-recovered table, and a **"Download
monthly report"** button that opens a print-optimized report (claims
volume, clean-claim rate, denials, recoveries, and estimated fees under the
practice's chosen plan, with every fee assumption stated on the page).

### `/practice/claims` - Claim status

Read-only list using the full lifecycle vocabulary (submitted, accepted or
rejected at clearinghouse, with the payer, paid, denied, appealing,
recovered). Patient names masked with click-to-reveal.

### `/practice/integration` - Integration health

Connection status, data-flow direction diagram, recent sync runs with row
and error counts, and a re-run sync button.

---

## Operations Portal (our internal software)

### `/ops/queue` - HITL review queue

Claims the engine would not auto-submit, with confidence bars, value, and
routing reason. Filter tabs: All / Low Confidence / High Value / Scrub
Errors / **Eligibility** (claims whose coverage came back inactive,
terminated, or member-not-found on the date of service - checked before
anything else in the pipeline, because a claim for dead coverage is a
guaranteed denial no matter how well it is coded).

### `/ops/claims/:id` - Claim detail

A **lifecycle stepper** across the top shows where the claim stands:
generated, submitted to clearinghouse, accepted or rejected (999 syntax ack
and 277CA business ack), with the payer, paid or denied. Three columns
below: the extracted encounter **plus the eligibility (270/271) result**
(coverage status, plan, copay, deductible); the coded claim with per-code
confidence and an inline editor; scrub findings grouped by severity, plus
the claim's **last five audit events**. The raw 837P drawer and the
Approve / Edit Codes / Reject action bar remain; approving a
clearinghouse-rejected claim resubmits it.

### `/ops/denials` - Denials

Parsed 835s with CARC/RARC tooltips, taxonomy badges, and the appeal letter
editor.

### `/ops/appeals` - Appeals workbench

KPI strip vs the manual baseline, plus per appeal: **level chip**
(reconsideration, level 1, level 2, external review), **submission
channel** (payer portal, fax, certified mail, electronic 275 attachment -
shown because in the real world appeals go outbound into payer-owned
channels), SLA age, and a deadline countdown computed from **per-payer,
per-level filing windows** (e.g. Aetna reconsiderations get 180 days vs the
90-day default). When a payer upholds a denial, the panel offers
**"Escalate to next level"**, creating a linked successor appeal with a
fresh deadline; external review is terminal. The panel shows the letter,
the full event timeline, payer responses, and the appeal's audit trail.

### `/ops/clients` - Client management

The book of business, including practices created live through the signup
wizard.

### `/ops/remittances` - Payment posting

Ops-side view of every 835: paid amounts, CARC adjustments as chips, and a
one-way **Post** action per remittance (audit-logged). A payer overturn
generates an unposted remittance here; posting it moves those dollars into
the practice's "posted to your ledger" figure.

### `/ops/audit` - Audit log

The compliance differentiator: an append-only record of every
state-changing action across all portals - who (the acting identity), where
(portal), what (approve, reject, code edit, appeal submit, escalate, payer
decision, remittance post, sync re-run, signup), on which entity, with a
before/after summary. Filterable by actor, action type, entity, and date.
No edit or delete path exists.

### `/ops/dashboard` - Metrics

Stat cards and the clean-claim-rate chart.

---

## Payer Simulator

Renamed from "payer portal" deliberately: real insurers never adopt a
vendor's portal - appeals are submitted outbound to payer-owned channels.
This access point stays because it lets a demo audience play the payer's
role and watch the loop close; a badge and tooltip on every screen say
exactly that.

### `/payer` - Appeals inbox

Appeals submitted to the signed-in payer, with letter, citations, and
service lines. Actions: **Overturn** (reverses the denial, flips the ops
appeal to overturned, generates an unposted remittance), **Uphold** (which
unlocks escalation on our side), **Request records** (lands in the appeal
timeline). Decisions are audit-logged and cannot be made twice.

### `/payer/remittances` - Remittances

The 835s this payer has issued, including ones created by overturn
decisions this session.

---

## Theming

Light mode only - white surfaces, near-black text, a single blue primary,
severity colors as dots and borders. The marketing pages use larger type
and 12-16px radii; the console keeps its dense 13px/6px design language.
No gradients, no emoji, no stock imagery anywhere.

## How the portals connect

One shared in-memory store backs everything: signups flow to ops clients;
engine output flows to the queue and practice views; submitted appeals flow
to the payer simulator; payer decisions flow back into ops appeals, the
remittance ledger, practice recovered/posted figures - and every step of
all of it lands in the audit log.

## What is real vs demo

| Real today | Demo / mocked today |
|---|---|
| The Python engine: eligibility (270/271) with DOS-effective coverage, extraction, coding, NCCI validation, 837P generation, scrubbing, 999/277CA parsing with a strict lifecycle state machine, 835 parsing, denial taxonomy, leveled appeal deadlines, appeal generation, HITL routing (151 passing tests) | The web app's API (MSW in-browser mocks; the engine is not yet served over HTTP) |
| NPI checksum validation (signup wizard and engine) | Authentication (localStorage demo identities, no passwords, no tenancy enforcement) |
| CARC/RARC meanings, denial taxonomy, citation references, appeal filing windows | All patients, practices, payer decisions, and dollars (synthetic) |
| The X12 837P/835/270/999/277CA structures shown | EHR/clearinghouse/payer connectivity (connection forms and syncs are simulated) |
| The audit-log design (append-only, actor-attributed) | Audit persistence (in-memory, resets on reload; production needs a durable store) |

Next steps to production, in order: serve the Python engine as an HTTP API
and point the frontend at it, real authentication and per-tenant
authorization, a durable database (including the audit log), then actual
EHR integrations, clearinghouse connectivity, and payer EDI enrollment.

## Related docs

- `README.md` - engine architecture, how to swap MockLLM for a real LLM,
  how to load full CMS rule files.
- `DECISIONS.md` - all design decisions with rationale (41 and counting).
- `frontend/README.md` - frontend commands, portal map, demo identities,
  design tokens.
