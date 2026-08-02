import { Link } from "react-router-dom";
import { ArrowRight, FileSearch, Gavel, PlugZap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useAppealCases, useDashboard } from "../api/queries";
import { formatPercent } from "../lib/format";
import { ClaimFlowDiagram } from "./marketing/ClaimFlowDiagram";

/**
 * Public homepage. Speaks only to medical practices: hero, claim-flow story,
 * proof stats, and links out to /how-it-works and /trust. Rendered inside
 * MarketingLayout (header/nav/footer live there).
 */
export function LandingScreen() {
  const appeals = useAppealCases();
  const dashboard = useDashboard();

  const kpis = appeals.data?.kpis;
  const series = dashboard.data?.clean_claim_rate_series;
  const cleanClaim =
    series && series.length > 0 ? series[series.length - 1].rate : null;

  return (
    <>
      {/* Hero */}
      <section className="mx-auto w-full max-w-[1360px] px-5 pb-20 pt-16 sm:pt-24 lg:px-10 lg:pb-28 lg:pt-32">
        <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
          Revenue cycle automation for private practices
        </p>
        <h1 className="mt-5 max-w-4xl text-[40px] font-semibold leading-[1.08] tracking-tight sm:text-[56px] lg:text-[68px]">
          Your claims, paid.
          <br />
          Your denials, fought.
        </h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-7 text-gray-600 sm:text-[19px] sm:leading-8">
          ClaimMate plugs into the EHR you already use, codes and scrubs every
          encounter, and submits clean claims the same day. When a payer says
          no, it appeals — automatically, with cited authority — and tracks
          every case to a decision.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link to="/practice/signup" className="btn-marketing-primary">
            Get started
            <ArrowRight size={18} />
          </Link>
          <Link to="/practice" className="btn-marketing-secondary">
            Practice sign in
          </Link>
        </div>
        <p className="mt-6 text-sm text-gray-400">
          Built for small and medium US practices. No new software for your
          front desk to learn.
        </p>
      </section>

      {/* Claim-flow story */}
      <section className="border-y border-gray-100 bg-gray-50/60">
        <div className="mx-auto w-full max-w-[1360px] px-5 py-16 lg:px-10 lg:py-24">
          <h2 className="max-w-2xl text-[28px] font-semibold leading-9 tracking-tight sm:text-[36px] sm:leading-[44px]">
            One system carries every claim from chart to cash.
          </h2>
          <div className="mt-10 rounded-xl border border-gray-200 bg-surface p-4 sm:p-8">
            <ClaimFlowDiagram />
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <ValueCard
              icon={PlugZap}
              title="Connects to your EHR"
              body="Vendor API, FHIR, or a nightly file drop — charts flow in on their own. Epic, athenahealth, eClinicalWorks, Tebra, DrChrono, AdvancedMD, and more."
            />
            <ValueCard
              icon={FileSearch}
              title="Clean claims, first pass"
              body="Every encounter is coded, checked against NCCI and payer rules, and eligibility-verified before it leaves. Anything uncertain goes to a certified coder first."
            />
            <ValueCard
              icon={Gavel}
              title="Denials that fight back"
              body="Denials are classified the moment the 835 lands, and appealable ones get a letter with real coverage citations — filed, tracked, and escalated to a decision."
            />
          </div>
        </div>
      </section>

      {/* Proof stats + links out */}
      <section className="mx-auto w-full max-w-[1360px] px-5 py-16 lg:px-10 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            <BigStat
              value={kpis ? `${kpis.avg_turnaround_days}` : "—"}
              unit="days"
              label="average appeal turnaround"
              note={`vs. a ${kpis?.manual_baseline_days ?? 14}-day manual baseline`}
            />
            <BigStat
              value={kpis ? formatPercent(kpis.overturn_rate, 0) : "—"}
              label="of decided appeals overturned"
              note="denied dollars back on remittances"
            />
            <BigStat
              value={cleanClaim !== null ? formatPercent(cleanClaim) : "—"}
              label="clean-claim rate"
              note="accepted on first submission"
            />
          </div>
          <div className="flex flex-col gap-3">
            <Link
              to="/how-it-works"
              className="inline-flex items-center gap-1.5 text-base font-medium text-primary hover:underline"
            >
              See how it works
              <ArrowRight size={16} />
            </Link>
            <Link
              to="/trust"
              className="inline-flex items-center gap-1.5 text-base font-medium text-gray-500 hover:text-ink"
            >
              Trust & compliance
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-gray-100">
        <div className="mx-auto flex w-full max-w-[1360px] flex-col items-start gap-6 px-5 py-16 lg:flex-row lg:items-center lg:justify-between lg:px-10 lg:py-20">
          <h2 className="max-w-xl text-[28px] font-semibold leading-9 tracking-tight sm:text-[34px] sm:leading-[42px]">
            Five minutes to sign up. Weeks of billing work back every month.
          </h2>
          <Link to="/practice/signup" className="btn-marketing-primary shrink-0">
            Get started
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}

function ValueCard({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-surface p-6">
      <Icon size={20} className="text-primary" aria-hidden />
      <h3 className="mt-4 text-[17px] font-semibold leading-6">{title}</h3>
      <p className="mt-2 text-[15px] leading-6 text-gray-600">{body}</p>
    </div>
  );
}

function BigStat({
  value,
  unit,
  label,
  note,
}: {
  value: string;
  unit?: string;
  label: string;
  note: string;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[48px] font-semibold leading-none tracking-tight sm:text-[56px]">
          {value}
        </span>
        {unit && (
          <span className="text-lg font-medium text-gray-500">{unit}</span>
        )}
      </div>
      <div className="mt-3 text-[15px] font-medium text-gray-700">{label}</div>
      <div className="mt-1 text-sm text-gray-400">{note}</div>
    </div>
  );
}
