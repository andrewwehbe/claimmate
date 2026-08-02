# RemitPath - Full Application Guide

Live demo: https://rcm-engine-lovat.vercel.app
Repo: `C:\Users\HP\rcm-engine`

## What this app is

RemitPath (fictional brand) is the working prototype of an RCM (Revenue Cycle
Management) automation startup for small-to-medium private medical practices
in the US. The pitch: practices connect their EHR or practice-management
database to our platform, our engine reads their clinical charts, codes and
submits claims automatically, catches denial-causing errors before
submission, and - the core differentiator - works denials and appeals with
the speed and win rate of a dedicated human billing team, without the
headcount.

The product has two halves in this repo:

1. **The engine** (`src/rcm/`, Python) - the real processing logic: chart
   extraction, medical coding with NCCI validation, X12 837P claim
   generation, claim scrubbing, 835 remittance parsing, denial
   classification, appeal letter generation, and human-in-the-loop routing.
   110 tests, runs fully offline.
2. **The web app** (`frontend/`, React) - the deployed multi-portal
   interface with three access points (practices, our internal team,
   insurance payers) plus a public landing page. It currently runs against
   an in-browser mock API (MSW) seeded with synthetic data, so the deployed
   site works with no server. All three portals share one in-memory store,
   so actions in one portal visibly flow into the others - the same
   information flow the real product will have.

Nothing in the demo is real: no real auth, no real patients (all data is
synthetic), no real payer connections.

---

## Page-by-page

### `/` - Public landing page

The front door. What's on it:

- **Positioning copy** aimed at the niche: small/medium US private
  practices, automated claims plus denial/appeal recovery.
- **Live efficiency stats** - average appeal turnaround (about 3.5 days vs
  the 14-day manual-biller baseline), appeal overturn rate (about 67%), and
  clean-claim rate. These are not hardcoded marketing numbers; the page
  reads them from the same mock store the portals use, so the landing page
  can never contradict what a visitor then sees inside the demo.
- **How it works** - a three-step explanation (connect your EHR, we code
  and scrub every claim, we fight every denial).
- **Three entry cards** - Practice Portal, Operations, Payer Portal - the
  three access points of the platform.
- **Get started CTA** - routes straight into the practice signup wizard.

No sidebar navigation here; the console chrome only appears inside portals.

### Demo access screens (all three portals)

Each portal is gated by a "Demo access" screen instead of real login. You
pick an identity, it persists in the browser (localStorage), and the TopBar
then shows the portal name and who you are, with Switch portal / Sign out.
Deep links into a portal redirect here first if you have no identity.

Identities available:

| Portal | Identities |
|---|---|
| Practice | Any onboarded practice, e.g. Sunrise Family Medicine (healthy integration), Cedar Ridge Pediatrics (degraded sync), Granite State Behavioral Health (integration pending). Finishing the signup wizard signs you in as the new practice. |
| Operations | Alex Reyes (Denials Operations Lead) or Mia Tran (RCM Operations Analyst) |
| Payer | Aetna Health Inc or UnitedHealthcare appeals reviewer - each sees only appeals filed with that payer |

---

## Practice Portal (the client-facing product)

This is what a medical practice that hires us sees.

### `/practice/signup` - Onboarding wizard

Five steps, persisting to the shared store on submit:

1. **Practice info** - legal name, specialty, provider count, state, and
   group NPI. The NPI field runs the real CMS checksum (Luhn over
   "80840" + the first 9 digits) in the browser, the same algorithm the
   Python engine uses, so an invalid NPI cannot be submitted.
2. **EHR / PM system** - Epic, athenahealth, eClinicalWorks, Kareo/Tebra,
   DrChrono, AdvancedMD, or Other.
3. **Integration method** - how their data will flow to us: direct
   database connection, FHIR API, or SFTP flat-file export. Each method
   shows its own connection fields (demo-optional, labeled as such).
4. **Plan selection** - the three commercial models: Performance
   (% of net collections), Hybrid SaaS + per-claim, or Denial Recovery
   Share (% of recovered revenue only).
5. **Review and submit** - lands on the practice dashboard in an
   "integration pending" state, and the new practice immediately appears in
   our internal Operations client list.

### `/practice` - Practice dashboard

The practice's view of the work we do for them: claims volume, current
denial rate, revenue recovered this quarter, integration sync status (last
sync time, charts imported, failed rows), and a table of denials we
recovered on their behalf.

### `/practice/claims` - Claim status

Read-only list of their claims with status (submitted / paid / denied /
appealing / recovered). Patient names are masked ("J. D-") with a
click-to-reveal eye icon - the same PHI discipline used everywhere in the
app.

### `/practice/integration` - Integration health

The data-pipeline page: connection status, a diagram of the flow direction
(their EHR/database into our engine), a history of recent sync runs with
row counts and error counts, and a re-run sync button (mocked, but it
persists a new run to the store).

---

## Operations Portal (our internal software)

This is our company's working console - where our team actually runs the
RCM business. It contains the original engine console plus business
management screens.

### `/ops/queue` - HITL review queue (ops home)

The human-in-the-loop queue. The engine auto-approves claims only when
everything checks out; anything else lands here. A claim is routed to a
human when any of these hold: overall confidence below 0.90, claim value
above $5,000, or any ERROR-severity scrub finding. The table shows claim
ID, masked patient, provider, claim value, a confidence bar (green at or
above 0.90, amber 0.70-0.89, red below), the routing reason, and age in
queue. Filter tabs: All / Low Confidence / High Value / Scrub Errors.
Clicking a row opens the claim detail.

### `/ops/claims/:id` - Claim detail

The full anatomy of one claim in three columns:

- **Left** - the extracted clinical encounter: chief complaint, HPI,
  diagnoses, procedures, provider NPI, with the per-field extraction
  confidence and any extraction warnings. SOAP sections are collapsible.
- **Center** - the coded claim: ICD-10 and CPT codes as mono chips
  (copy-on-click) with per-code confidence and modifiers, plus an inline
  code editor.
- **Right** - scrub findings grouped by severity (ERROR / WARNING / INFO),
  e.g. missing modifier 25, NCCI unbundling, prior auth missing, timely
  filing risk.

Below is a collapsible drawer with the raw X12 837P output (the actual EDI
we would transmit) in mono with segment IDs bolded. A sticky action bar
offers Approve / Edit Codes / Reject; approvals update optimistically and
reflect back into the queue.

### `/ops/denials` - Denials

Parsed 835 remittances: each denial shows its CARC/RARC codes as chips with
hover tooltips giving the official code meaning (from our local reference
table), the denial taxonomy category (medical necessity, coding error, auth
missing, timely filing, COB), and appeal status. The side panel shows the
generated appeal letter with an inline editor and a Regenerate button.

### `/ops/appeals` - Appeals workbench (the flagship screen)

Where the "as good as human billers" claim is proven. The header strip
shows our KPIs against the manual baseline: average turnaround (ours vs the
14-day industry manual benchmark), overturn rate, and dollars recovered per
FTE-equivalent. The table lists every active appeal with an SLA age timer,
status (drafting / awaiting payer / payer responded / overturned / upheld),
CARC chip, denied amount, and color-coded days remaining until the payer's
appeal-filing deadline. The detail panel shows the appeal letter, an event
timeline, and the payer's response when one exists. When a payer decides an
appeal in the Payer Portal, the decision appears here.

### `/ops/clients` - Client management

Our book of business: every onboarded practice (including ones created live
through the signup wizard), with specialty, state, plan, integration
status, monthly claim volume, and denial rate. Row click opens a side panel
with contacts, integration detail, and an activity feed.

### `/ops/dashboard` - Metrics

Four stat cards (claims processed, auto-approval rate, denial rate, dollars
sitting in the HITL queue) and a clean-claim-rate line chart.

---

## Payer Portal (for insurance companies)

The third access point: a lightweight interface for insurer appeal
reviewers who want to interact with us electronically instead of by fax
and mail.

### `/payer` - Appeals inbox

The appeals we have formally submitted to the signed-in payer (each payer
identity sees only its own). Columns: claim ID, practice, CARC, amount,
received date, status. The detail panel shows the full appeal letter with
its cited authorities (which come from our verified local citation
reference, never invented), and the claim's service lines. Three actions:

- **Overturn** - the denial is reversed; the appeal flips to overturned in
  our `/ops/appeals` workbench, the recovered-dollars KPI increases, and a
  remittance row is issued.
- **Uphold** - the denial stands; status reflects back to ops.
- **Request records** - asks us for supporting documentation; shows up in
  the appeal's timeline.

A decided appeal cannot be decided twice.

### `/payer/remittances` - Remittances

The 835 payment/denial files this payer has issued, including ones
generated by their own overturn decisions in this session.

---

## How the portals connect (the information flow)

One shared in-memory store backs all three portals in the demo, mirroring
the real product's central database:

- Practice signup -> appears in `/ops/clients`.
- Engine output (queue, coded claims, scrub findings, 837P) -> reviewed in
  `/ops`, visible read-only to the practice in `/practice/claims`.
- Ops drafts and submits appeals -> they arrive in the payer's `/payer`
  inbox.
- Payer decisions -> flow back into `/ops/appeals` KPIs and the practice's
  recovered-revenue numbers.

## What is real vs demo

| Real today | Demo / mocked today |
|---|---|
| The Python engine: extraction, coding, NCCI validation, 837P generation, scrubbing, 835 parsing, denial taxonomy, appeal generation, HITL routing (110 passing tests) | The web app's API (MSW in-browser mocks; the engine is not yet served over HTTP) |
| NPI checksum validation in the signup wizard | Authentication (localStorage demo identities, no passwords, no tenancy enforcement) |
| CARC/RARC meanings, denial taxonomy, citation references | All patients, practices, payers' numbers, claims, and dollars (synthetic) |
| The X12 837P/835 formats shown | EHR integrations (connection forms are non-functional placeholders) |

Next steps to make it production-real, in order: serve the Python engine as
an HTTP API and point the frontend at it, real authentication and
per-tenant authorization, a durable database replacing the in-memory
stores, then actual EHR/clearinghouse connectivity.

## Related docs

- `README.md` - engine architecture, how to swap MockLLM for a real LLM,
  how to load full CMS rule files.
- `DECISIONS.md` - all 33 design decisions with rationale.
- `frontend/README.md` - frontend commands, portal map, demo identities,
  design tokens.
