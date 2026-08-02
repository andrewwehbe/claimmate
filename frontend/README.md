# Claimate frontend (rcm-engine)

Multi-portal SPA for the RCM engine: Vite + React 18 + TypeScript (strict) +
Tailwind + TanStack Query + MSW. Runs fully standalone against an in-memory
mock API — **no backend, no real auth, all data synthetic**.

Dark mode is the default; a sun/moon toggle in the TopBar (and on the public
landing and /trust pages) switches themes, persisted under the
`claimate-theme` localStorage key. The printable report always prints light.

## Commands

```powershell
cd C:\Users\HP\rcm-engine\frontend
npm install       # first time
npm run dev       # http://localhost:5173
npm run build     # type-check (tsc) + production build
```

## Portal map

| Route | What it is |
|---|---|
| `/` | Public landing + access point selector (stats read live from the mock store, labeled "Simulated demo data") |
| `/trust` | Public trust & security page: HIPAA posture, PHI handling, audit logging, HITL thresholds, SOC 2 roadmap |
| `/practice/signup` | Practice onboarding wizard (5 steps, Luhn NPI validation, vendor API / FHIR / SFTP methods, payer EDI enrollment note) |
| `/practice` | Practice portal: dashboard (volume, denial rate, recovered $, posted-to-ledger $, sync status) + "Download monthly report" |
| `/practice/report` | Print-optimized monthly report (window.print) with estimated plan fees, from live store data |
| `/practice/claims` | Read-only claim status list using the clearinghouse lifecycle vocabulary (PHI masked, click-to-reveal) |
| `/practice/integration` | Integration health: status, data-flow diagram, sync runs, re-run sync (audit-logged) |
| `/ops/queue` | HITL review queue (tabs: All / Low Confidence / High Value / Scrub Errors / Eligibility) |
| `/ops/claims/:id` | Claim detail: lifecycle stepper, eligibility (270/271) block, encounter / coded claim / findings, raw 837P, approve-edit-reject, recent audit activity |
| `/ops/denials` | Parsed 835 denials with CARC/RARC reference tooltips + appeal letter editor |
| `/ops/appeals` | Appeals workbench: levels (Recon/L1/L2/External), level+payer deadline rules, submission channels, SLA timers, KPI strip, escalate-on-uphold, audit trail |
| `/ops/remittances` | Payment posting: parsed 835 rows with CPT lines + CARC adjustment chips; Post is one-way and audit-logged |
| `/ops/clients` | Client practice management (includes wizard signups) with detail side panel |
| `/ops/audit` | Append-only audit log: filter by actor, action, entity, date range; populated by seeded history + live session actions |
| `/ops/dashboard` | Metrics: stat cards + clean-claim-rate line chart |
| `/payer` | **Payer Simulator** appeals inbox — Overturn / Uphold / Request records (reflects into `/ops/appeals`; overturns generate unposted remittances) |
| `/payer/remittances` | 835s issued by the signed-in simulated payer |

Legacy routes `/queue`, `/claims/:id`, `/denials`, `/dashboard` redirect to
their `/ops/...` equivalents.

## Demo behaviors worth knowing

- **Payer Simulator** (renamed from "Payer Portal"): in production, appeals are
  submitted to payer-owned portals (e.g. Availity), fax, or mail; the
  simulator plays the payer's role. An info tip repeats this in the UI.
- **Escalation ladder**: reconsideration -> level_1 -> level_2 ->
  external_review (terminal). Upholding an appeal in the simulator enables
  "Escalate to next level" in `/ops/appeals`; the successor starts in
  drafting with a fresh deadline from the uphold date, and both cases link to
  each other in their timelines.
- **Deadline rules**: days-from-denial per level — defaults
  {reconsideration: 90, level_1: 60, level_2: 60, external_review: 120}, with
  per-payer overrides (Aetna reconsideration: 180). See
  `src/lib/appealRules.ts` (mirror of the engine's rule table).
- **Claim lifecycle**: generated -> submitted_to_clearinghouse ->
  clearinghouse_accepted | clearinghouse_rejected -> payer_received -> paid |
  denied. Rendered as a stepper on claim detail; approving a generated or
  rejected claim (re)submits it to the clearinghouse.
- **Eligibility**: every claim carries a 270/271 result; claims with
  ELIGIBILITY_INACTIVE findings route to the queue's Eligibility tab.
- **Audit log**: every state-changing action in any portal appends an audit
  event with the acting demo identity (sent via `x-demo-actor` headers).
  There is no edit/delete path.
- **Payment posting**: payer overturns generate an Unposted remittance in
  `/ops/remittances`; posting it feeds the practice dashboard's
  "Posted to your ledger" figure.

## Demo identities (mock role gate)

Each portal shows a "Demo access" entry screen; the choice persists in
`localStorage` (`claimate-demo-identity:<portal>`). Sign out from the TopBar.

- **Practice portal** — any onboarded practice, e.g. *Sunrise Family
  Medicine, S.C.* (connected), *Cedar Ridge Pediatrics* (degraded sync),
  *Granite State Behavioral Health* (integration pending). Completing the
  signup wizard auto-signs you in as the new practice.
- **Operations** — *Alex Reyes* (Denials Operations Lead) or *Mia Tran*
  (RCM Operations Analyst).
- **Payer Simulator** — *Aetna Health Inc* or *UnitedHealthcare* appeals
  reviewer (each sees only appeals filed with that payer).

## Where things live

- `src/types/` — TS mirrors of the backend Pydantic models
  (`src/rcm/models/*.py`); portal/API view models in `api.ts` + `portal.ts`
  (kept clearly separate from model mirrors).
- `src/mocks/` — MSW handlers + synthetic seed data (`seed.ts` for
  claims/denials/eligibility, `seedPortal.ts` for
  practices/appeals/syncs/remittances/audit history). One in-memory store is
  shared by all portals.
- `src/lib/carcRarc.ts` — mirror of `data/rules/carc_rarc.json` (keep in sync).
- `src/lib/appealRules.ts` — appeal levels, deadline rules, submission channels.
- `src/lib/npi.ts` — Luhn NPI check (port of `rcm/models/validators.py`).
- `src/lib/identity.ts` — demo identity storage, portal registry, active
  session for audit actor attribution.
- `src/components/` — shared console components (DataTable, StatusBadge,
  SeverityDot, ConfidenceBar, CodeChip, SidePanel, TopBar, SideNav,
  ClaimStepper, AuditTrail, InfoTip, ...).
- `src/screens/` — screens grouped by portal (`practice/`, `ops/`, `payer/`).

## Design tokens

Inter for UI (13px body), JetBrains Mono for all codes/IDs/amounts; radii
4px inputs / 6px buttons+cards / 0 tables; single blue primary `#2563EB`;
severity ERROR/WARNING/INFO/PASS as dots/left-borders only, never full
colored backgrounds. No gradients, no emoji, no pill buttons, no shadows
heavier than `shadow-sm`, no shimmer skeletons.

Theming: every surface/text/border color routes through CSS variables (RGB
triplets in `src/index.css`, consumed via the Tailwind config as
`rgb(var(--x) / <alpha>)`). Light values live in `:root`, dark values under
`.dark` on `<html>` (applied pre-paint by an inline script in `index.html`).
Dark surfaces are near-black (`#0A0A0A` base, `#111113`/`#161618` raised),
text is near-white (`#F0F0F2`, never pure white), borders in the `#26262A`
range; severity hues brighten slightly for contrast; primary hover lightens
to `#3B82F6`. `@media print` forces the light values regardless of theme.
