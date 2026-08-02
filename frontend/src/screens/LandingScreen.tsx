import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Building2,
  FileSearch,
  Gavel,
  Landmark,
  PlugZap,
} from "lucide-react";

import { useAppealCases, useDashboard } from "../api/queries";
import { formatMoney, formatPercent } from "../lib/format";

/**
 * Public landing + access point selector. Stats are read live from the demo
 * store so marketing numbers always match what the portals show.
 */
export function LandingScreen() {
  const appeals = useAppealCases();
  const dashboard = useDashboard();

  const kpis = appeals.data?.kpis;
  const series = dashboard.data?.clean_claim_rate_series;
  const cleanClaim =
    series && series.length > 0 ? series[series.length - 1].rate : null;

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Site header */}
      <header className="border-b border-gray-200">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-6">
          <span className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-ink font-mono text-xs font-semibold text-white">
              R
            </span>
            <span className="text-sm font-semibold tracking-tight">RemitPath</span>
          </span>
          <nav className="flex items-center gap-4 text-xs text-gray-500">
            <a href="#portals" className="transition-colors hover:text-ink">
              Portals
            </a>
            <a href="#how" className="transition-colors hover:text-ink">
              How it works
            </a>
            <Link to="/practice/signup" className="btn-primary h-8 px-3 text-xs">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        {/* Hero */}
        <section className="border-b border-gray-100 py-16">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
            Revenue cycle automation for small and medium US private practices
          </p>
          <h1 className="max-w-2xl text-xl font-semibold leading-8 tracking-tight">
            Denials worked like your best billing team.
            <br />
            At software speed, at software cost.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-6 text-gray-600">
            RemitPath plugs into your EHR, scrubs and submits your claims, and —
            when payers deny — drafts, files, and tracks appeals automatically.
            Every letter cites real coverage authority; every case is a
            structured record, not a fax in a folder.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Link to="/practice/signup" className="btn-primary">
              Get started
              <ArrowRight size={14} />
            </Link>
            <a href="#portals" className="btn-secondary">
              Choose your portal
            </a>
          </div>
        </section>

        {/* Efficiency stats vs. manual baseline (live from demo store) */}
        <section className="grid grid-cols-2 gap-px border-b border-gray-100 bg-gray-100 md:grid-cols-4">
          <Stat
            value={kpis ? `${kpis.avg_turnaround_days} days` : "—"}
            label="Avg appeal turnaround"
            note={`vs. ${kpis?.manual_baseline_days ?? 14}-day manual-biller baseline`}
          />
          <Stat
            value={kpis ? formatPercent(kpis.overturn_rate, 0) : "—"}
            label="Appeal overturn rate"
            note={`across ${kpis?.decided_count ?? 0} decided appeals`}
          />
          <Stat
            value={cleanClaim !== null ? formatPercent(cleanClaim) : "—"}
            label="Clean-claim rate"
            note="accepted on first submission"
          />
          <Stat
            value={kpis ? formatMoney(kpis.recovered_per_fte) : "—"}
            label="Recovered per FTE-equivalent"
            note={`at ${kpis?.fte_equivalent ?? 0.35} FTE of reviewer time`}
          />
        </section>

        {/* How it works */}
        <section id="how" className="border-b border-gray-100 py-12">
          <h2 className="mb-6 text-lg font-semibold tracking-tight">
            How it works
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            <Step
              icon={PlugZap}
              n="01"
              title="Connect your system"
              body="Direct database, FHIR API, or SFTP flat-file export from Epic, athenahealth, eClinicalWorks, Tebra, DrChrono, AdvancedMD, and more. Charts flow in on a schedule you control."
            />
            <Step
              icon={FileSearch}
              n="02"
              title="Scrub and submit"
              body="Notes are coded, scrubbed against NCCI and payer rules, and routed: clean claims go straight out; anything uncertain goes to a human reviewer first."
            />
            <Step
              icon={Gavel}
              n="03"
              title="Appeal and recover"
              body="Denials are classified by CARC/RARC, matched to appealable categories, and appealed with cited authority — then tracked to a payer decision."
            />
          </div>
        </section>

        {/* Access points */}
        <section id="portals" className="py-12">
          <h2 className="mb-1 text-lg font-semibold tracking-tight">
            Sign in to your portal
          </h2>
          <p className="mb-6 text-sm text-gray-500">
            Demo environment — all data is synthetic. Each portal uses seeded
            demo identities.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <PortalCard
              icon={Building2}
              to="/practice"
              title="Practice Portal"
              body="For medical practices: claim status, recovered revenue, and integration health."
              cta="Enter Practice Portal"
            />
            <PortalCard
              icon={Gavel}
              to="/ops"
              title="Operations"
              body="Internal staff: review queue, appeals workbench, denials, and client management."
              cta="Enter Operations"
            />
            <PortalCard
              icon={Landmark}
              to="/payer"
              title="Payer Portal"
              body="For insurance company reviewers: appeal inbox, decisions, and remittance history."
              cta="Enter Payer Portal"
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-6 py-6 text-xs text-gray-400">
          <span>RemitPath, Inc. — a fictional company for this demo.</span>
          <span>
            All patients, claims, providers, and dollar amounts are synthetic.
          </span>
        </div>
      </footer>
    </div>
  );
}

function Stat({
  value,
  label,
  note,
}: {
  value: string;
  label: string;
  note: string;
}) {
  return (
    <div className="bg-white p-6">
      <div className="font-mono text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-sm font-medium text-gray-700">{label}</div>
      <div className="mt-0.5 text-xs text-gray-500">{note}</div>
    </div>
  );
}

function Step({
  icon: Icon,
  n,
  title,
  body,
}: {
  icon: LucideIcon;
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon size={15} className="text-gray-400" />
        <span className="font-mono text-xs text-gray-400">{n}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-sm leading-5 text-gray-600">{body}</p>
    </div>
  );
}

function PortalCard({
  icon: Icon,
  to,
  title,
  body,
  cta,
}: {
  icon: LucideIcon;
  to: string;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col border border-gray-200 p-5 transition-colors hover:border-gray-300 hover:bg-gray-50"
    >
      <Icon size={16} className="mb-3 text-gray-500" />
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 flex-1 text-sm leading-5 text-gray-600">{body}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary">
        {cta}
        <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
