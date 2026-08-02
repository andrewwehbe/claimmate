# RemitPath frontend (rcm-engine)

Multi-portal SPA for the RCM engine: Vite + React 18 + TypeScript (strict) +
Tailwind + TanStack Query + MSW. Runs fully standalone against an in-memory
mock API — **no backend, no real auth, all data synthetic**.

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
| `/` | Public landing + access point selector (stats read live from the mock store) |
| `/practice/signup` | Practice onboarding wizard (5 steps, Luhn NPI validation, persists to MSW store) |
| `/practice` | Practice portal: dashboard (volume, denial rate, recovered $, sync status) |
| `/practice/claims` | Read-only claim status list (PHI masked, click-to-reveal) |
| `/practice/integration` | Integration health: status, data-flow diagram, sync runs, re-run sync |
| `/ops/queue` | HITL review queue (filter tabs, confidence bars) |
| `/ops/claims/:id` | Claim detail: encounter / coded claim / scrub findings, raw 837P, approve-edit-reject |
| `/ops/denials` | Parsed 835 denials with CARC/RARC reference tooltips + appeal letter editor |
| `/ops/appeals` | Appeals workbench: SLA timers, payer deadlines, KPI strip vs. 14-day manual baseline |
| `/ops/clients` | Client practice management (includes wizard signups) with detail side panel |
| `/ops/dashboard` | Metrics: stat cards + clean-claim-rate line chart |
| `/payer` | Payer appeals inbox — Overturn / Uphold / Request records (reflects back into `/ops/appeals`) |
| `/payer/remittances` | 835s issued by the signed-in payer |

Legacy routes `/queue`, `/claims/:id`, `/denials`, `/dashboard` redirect to
their `/ops/...` equivalents.

## Demo identities (mock role gate)

Each portal shows a "Demo access" entry screen; the choice persists in
`localStorage` (`remitpath-demo-identity:<portal>`). Sign out from the TopBar.

- **Practice portal** — any onboarded practice, e.g. *Sunrise Family
  Medicine, S.C.* (connected), *Cedar Ridge Pediatrics* (degraded sync),
  *Granite State Behavioral Health* (integration pending). Completing the
  signup wizard auto-signs you in as the new practice.
- **Operations** — *Alex Reyes* (Denials Operations Lead) or *Mia Tran*
  (RCM Operations Analyst).
- **Payer portal** — *Aetna Health Inc* or *UnitedHealthcare* appeals
  reviewer (each sees only appeals filed with that payer).

## Where things live

- `src/types/` — TS mirrors of the backend Pydantic models
  (`src/rcm/models/*.py`); portal/API view models in `api.ts` + `portal.ts`
  (kept clearly separate from model mirrors).
- `src/mocks/` — MSW handlers + synthetic seed data (`seed.ts` for
  claims/denials, `seedPortal.ts` for practices/appeals/syncs/remittances).
  One in-memory store is shared by all portals, so payer decisions show up
  in ops and practice views.
- `src/lib/carcRarc.ts` — mirror of `data/rules/carc_rarc.json` (keep in sync).
- `src/lib/npi.ts` — Luhn NPI check (port of `rcm/models/validators.py`).
- `src/lib/identity.ts` — demo identity storage + portal registry.
- `src/components/` — shared console components (DataTable, StatusBadge,
  SeverityDot, ConfidenceBar, CodeChip, SidePanel, TopBar, SideNav, ...).
- `src/screens/` — screens grouped by portal (`practice/`, `ops/`, `payer/`).

## Design tokens

Inter for UI (13px body), JetBrains Mono for all codes/IDs/amounts; radii
4px inputs / 6px buttons+cards / 0 tables; single blue primary `#2563EB`;
severity ERROR `#DC2626`, WARNING `#D97706`, INFO `#6B7280`, PASS `#16A34A`
(dots/left-borders only, never full colored backgrounds). No gradients, no
emoji, no pill buttons, no shadows heavier than `shadow-sm`, no shimmer
skeletons.
