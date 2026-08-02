import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { useAppealCases, useDashboard } from "../../api/queries";
import { formatMoney, formatPercent } from "../../lib/format";
import { classNames } from "../../lib/format";
import { ClaimFlowDiagram } from "./ClaimFlowDiagram";

/**
 * The connect -> code/scrub -> fight-denials story, with room to breathe:
 * wide alternating step sections, drawn visuals, and the efficiency stats.
 */
export function HowItWorksScreen() {
  const appeals = useAppealCases();
  const dashboard = useDashboard();
  const kpis = appeals.data?.kpis;
  const series = dashboard.data?.clean_claim_rate_series;
  const cleanClaim =
    series && series.length > 0 ? series[series.length - 1].rate : null;

  return (
    <>
      {/* Page hero */}
      <section className="mx-auto w-full max-w-[1360px] px-5 pb-14 pt-16 sm:pt-24 lg:px-10">
        <h1 className="max-w-3xl text-[36px] font-semibold leading-[1.1] tracking-tight sm:text-[48px] lg:text-[56px]">
          How ClaimMate works
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-7 text-gray-600 sm:text-[19px] sm:leading-8">
          Three stages, one system. Your practice keeps seeing patients; the
          revenue cycle runs itself, with a certified coder in the loop for
          anything the automation isn't sure about.
        </p>
      </section>

      <section className="mx-auto w-full max-w-[1360px] px-5 lg:px-10">
        <div className="rounded-xl border border-gray-200 bg-surface p-4 sm:p-8">
          <ClaimFlowDiagram />
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto w-full max-w-[1360px] px-5 py-16 lg:px-10 lg:py-24">
        <Step
          n="01"
          title="Connect your EHR — once"
          body="ClaimMate reads encounters straight from the system you already chart in. Choose your vendor's partner API, a FHIR endpoint, or a scheduled file export; our team manages payer EDI enrollment for claims, remittances, and eligibility. After setup, charts arrive on their own — no double entry, nothing new for your staff."
          visual={<ConnectVisual />}
        />
        <Step
          n="02"
          title="Every encounter coded, scrubbed, and checked"
          flip
          body="Each note becomes a coded claim: ICD-10 and CPT with per-code confidence, NCCI and payer-rule scrubbing, and a live eligibility check before submission. Clean claims go out the same day. Low confidence, high value, or any error finding routes the claim to a certified coder — automation never guesses on your revenue."
          visual={<ScrubVisual />}
        />
        <Step
          n="03"
          title="Denials fought to a decision"
          body="When an 835 lands with a denial, ClaimMate classifies the reason code, drafts an appeal letter with citations from real coverage authority, files it inside the payer's deadline window, and tracks the case — escalating upheld appeals level by level. Recovered dollars post back to your ledger where you can see them."
          visual={<AppealVisual />}
        />
      </section>

      {/* Efficiency stats */}
      <section className="border-y border-gray-100 bg-gray-50/60">
        <div className="mx-auto w-full max-w-[1360px] px-5 py-16 lg:px-10 lg:py-24">
          <h2 className="max-w-2xl text-[28px] font-semibold leading-9 tracking-tight sm:text-[36px] sm:leading-[44px]">
            Measured against the way billing teams work today.
          </h2>
          <div className="mt-12 grid gap-12 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              value={kpis ? `${kpis.avg_turnaround_days}d` : "—"}
              label="Average appeal turnaround"
              note={`Manual billing teams average ~${kpis?.manual_baseline_days ?? 14} days from denial to filed appeal.`}
            />
            <Stat
              value={kpis ? formatPercent(kpis.overturn_rate, 0) : "—"}
              label="Overturn rate"
              note={`Across ${kpis?.decided_count ?? 0} decided appeals in the demo data set.`}
            />
            <Stat
              value={cleanClaim !== null ? formatPercent(cleanClaim) : "—"}
              label="Clean-claim rate"
              note="Share of claims accepted by the payer on first submission."
            />
            <Stat
              value={kpis ? formatMoney(kpis.recovered_per_fte) : "—"}
              label="Recovered per FTE-equivalent"
              note={`At ${kpis?.fte_equivalent ?? 0.35} FTE of human reviewer time.`}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto flex w-full max-w-[1360px] flex-col items-start gap-6 px-5 py-16 lg:flex-row lg:items-center lg:justify-between lg:px-10 lg:py-20">
        <h2 className="max-w-xl text-[28px] font-semibold leading-9 tracking-tight sm:text-[34px] sm:leading-[42px]">
          See it with your own claims.
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/practice/signup" className="btn-marketing-primary">
            Get started
            <ArrowRight size={18} />
          </Link>
          <Link to="/trust" className="btn-marketing-secondary">
            Trust & compliance
          </Link>
        </div>
      </section>
    </>
  );
}

// ------------------------------------------------------------------ pieces

function Step({
  n,
  title,
  body,
  visual,
  flip,
}: {
  n: string;
  title: string;
  body: string;
  visual: React.ReactNode;
  flip?: boolean;
}) {
  return (
    <div
      className={classNames(
        "grid items-center gap-10 py-10 lg:grid-cols-2 lg:gap-16 lg:py-14",
      )}
    >
      <div className={classNames(flip && "lg:order-2")}>
        <span className="font-mono text-sm font-medium text-primary">{n}</span>
        <h2 className="mt-3 text-[26px] font-semibold leading-8 tracking-tight sm:text-[32px] sm:leading-10">
          {title}
        </h2>
        <p className="mt-4 max-w-xl text-[16px] leading-7 text-gray-600">
          {body}
        </p>
      </div>
      <div className={classNames(flip && "lg:order-1")}>{visual}</div>
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
    <div>
      <div className="font-mono text-[52px] font-semibold leading-none tracking-tight">
        {value}
      </div>
      <div className="mt-3 text-[16px] font-semibold text-ink">{label}</div>
      <p className="mt-1.5 max-w-xs text-sm leading-5 text-gray-500">{note}</p>
    </div>
  );
}

/* Step visuals: drawn with the product palette, no images. */

function VisualFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-surface p-6 sm:p-8">
      {children}
    </div>
  );
}

function ConnectVisual() {
  const rows = [
    { name: "PM/EHR vendor API", note: "registered partner app", active: true },
    { name: "FHIR R4 API", note: "OAuth-secured endpoint", active: false },
    { name: "SFTP file export", note: "nightly CSV / X12 drop", active: false },
  ];
  return (
    <VisualFrame>
      <div className="text-sm font-medium text-gray-500">
        Choose a connection
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((r) => (
          <div
            key={r.name}
            className={classNames(
              "flex items-center gap-3 rounded-lg border p-4",
              r.active
                ? "border-primary bg-primary-subtle"
                : "border-gray-200",
            )}
          >
            <span
              className={classNames(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                r.active ? "bg-primary" : "bg-gray-300",
              )}
            />
            <div className="min-w-0">
              <div className="text-[15px] font-medium text-ink">{r.name}</div>
              <div className="text-sm text-gray-500">{r.note}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-lg bg-gray-50 p-3 text-sm leading-5 text-gray-500">
        Payer EDI enrollment (claims · ERA · eligibility) handled by our team —
        typically 2-6 weeks per payer.
      </div>
    </VisualFrame>
  );
}

function ScrubVisual() {
  return (
    <VisualFrame>
      <div className="text-sm font-medium text-gray-500">
        Coded claim, before submission
      </div>
      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip>E11.9</Chip>
          <Chip>I10</Chip>
          <Chip>99214</Chip>
          <Chip>93000</Chip>
          <span className="text-sm text-gray-500">confidence</span>
          <span className="font-mono text-sm">0.94</span>
          <span className="inline-block h-1.5 w-16 rounded-none bg-gray-200">
            <span className="block h-full w-[94%] bg-severity-pass" />
          </span>
        </div>
        <CheckRow tone="pass" text="NCCI pairs clean · modifiers valid" />
        <CheckRow tone="pass" text="Eligibility active on date of service" />
        <CheckRow
          tone="warn"
          text="Unspecified diagnosis — routed to certified coder"
        />
      </div>
      <div className="mt-5 rounded-lg bg-gray-50 p-3 text-sm leading-5 text-gray-500">
        Auto-submit only when everything checks out; humans review the rest.
      </div>
    </VisualFrame>
  );
}

function AppealVisual() {
  const steps = [
    { label: "Denial received — CO-50, medical necessity", done: true },
    { label: "Appeal drafted with cited authority", done: true },
    { label: "Filed within the payer's deadline window", done: true },
    { label: "Overturned — $1,240 recovered", done: true, green: true },
  ];
  return (
    <VisualFrame>
      <div className="text-sm font-medium text-gray-500">
        One appeal, start to finish
      </div>
      <div className="mt-5">
        {steps.map((s, i) => (
          <div key={s.label} className="flex gap-4">
            <div className="flex flex-col items-center">
              <span
                className={classNames(
                  "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                  s.green ? "bg-severity-pass" : "bg-primary",
                )}
              />
              {i < steps.length - 1 && (
                <span className="w-px flex-1 bg-gray-200" />
              )}
            </div>
            <p
              className={classNames(
                "pb-6 text-[15px] leading-6",
                s.green ? "font-medium text-ink" : "text-gray-600",
              )}
            >
              {s.label}
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-gray-50 p-3 text-sm leading-5 text-gray-500">
        Upheld anyway? ClaimMate escalates — reconsideration to Level 1, Level
        2, and external review — each with a fresh deadline clock.
      </div>
    </VisualFrame>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center rounded-sm border border-gray-200 bg-gray-50 px-2 font-mono text-sm text-gray-900">
      {children}
    </span>
  );
}

function CheckRow({ tone, text }: { tone: "pass" | "warn"; text: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 p-3">
      <span
        className={classNames(
          "h-2 w-2 shrink-0 rounded-full",
          tone === "pass" ? "bg-severity-pass" : "bg-severity-warning",
        )}
      />
      <span className="text-[15px] text-gray-700">{text}</span>
    </div>
  );
}
