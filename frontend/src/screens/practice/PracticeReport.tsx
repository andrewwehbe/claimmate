import { Link, Navigate } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";

import {
  useAppealCases,
  useDashboard,
  usePracticeOverview,
} from "../../api/queries";
import { formatDate, formatMoney, formatPercent } from "../../lib/format";
import { loadIdentity } from "../../lib/identity";
import type { PlanType, PracticeOverview } from "../../types";

/** Assumed rates, stated verbatim on the report. */
const ASSUMED_AVG_COLLECTED_PER_CLAIM = 118;
const PLAN_FEE_NOTES: Record<PlanType, string> = {
  performance: "Performance plan: 5% of collections (collections estimated at $118 avg per claim).",
  hybrid: "Hybrid plan: $500 per provider per month + $3 per claim.",
  denial_recovery_share: "Denial recovery share plan: 20% of recovered denial dollars.",
};

function estimateFees(o: PracticeOverview): { fee: number; note: string } {
  const a = o.account;
  switch (a.plan) {
    case "performance": {
      const collections = o.claims_this_month * ASSUMED_AVG_COLLECTED_PER_CLAIM;
      return { fee: collections * 0.05, note: PLAN_FEE_NOTES.performance };
    }
    case "hybrid":
      return {
        fee: a.providers_count * 500 + o.claims_this_month * 3,
        note: PLAN_FEE_NOTES.hybrid,
      };
    case "denial_recovery_share":
      return {
        fee: Number(o.recovered_this_quarter) * 0.2,
        note: PLAN_FEE_NOTES.denial_recovery_share,
      };
  }
}

function lastFullMonthLabel(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return prev.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/**
 * Print-optimized monthly report. Reached from the practice dashboard;
 * uses window.print() — the header controls are hidden in print.
 */
export function PracticeReport() {
  const identity = loadIdentity("practice");
  const practiceId = identity?.practice_id;
  const overview = usePracticeOverview(practiceId);
  const dashboard = useDashboard();
  const appeals = useAppealCases();

  if (!identity) return <Navigate to="/practice" replace />;

  const o = overview.data;
  const series = dashboard.data?.clean_claim_rate_series;
  const cleanClaim =
    series && series.length > 0 ? series[series.length - 1].rate : null;
  const denialsCount = (appeals.data?.appeals ?? []).filter(
    (a) => a.practice_id === practiceId,
  ).length;

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="flex h-12 items-center justify-between border-b border-gray-200 px-6 print:hidden">
        <Link
          to="/practice"
          className="flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-ink"
        >
          <ArrowLeft size={13} /> Back to dashboard
        </Link>
        <button
          type="button"
          className="btn-primary h-8 px-3 text-xs"
          onClick={() => window.print()}
        >
          <Printer size={13} /> Print / save as PDF
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-8 py-10">
        {overview.isLoading || !o ? (
          <div className="h-64 border border-gray-200 bg-gray-100 print:hidden" />
        ) : (
          <>
            <div className="flex items-baseline justify-between border-b-2 border-ink pb-3">
              <div>
                <div className="flex items-center">
                  <span className="text-sm font-semibold tracking-tight">
                    ClaimMate
                  </span>
                </div>
                <h1 className="mt-2 text-lg font-semibold tracking-tight">
                  Monthly performance report
                </h1>
              </div>
              <div className="text-right text-xs text-gray-500">
                <div className="text-sm font-medium text-ink">
                  {o.account.legal_name}
                </div>
                <div>
                  {o.account.specialty} · {o.account.state} · NPI{" "}
                  <span className="font-mono">{o.account.group_npi}</span>
                </div>
                <div className="mt-1">Period: {lastFullMonthLabel()}</div>
              </div>
            </div>

            <table className="mt-6 w-full border-collapse text-sm">
              <tbody>
                <Row label="Claims volume (monthly)">
                  {o.claims_this_month.toLocaleString("en-US")}
                </Row>
                <Row label="Clean-claim rate">
                  {cleanClaim !== null ? formatPercent(cleanClaim) : "—"}
                </Row>
                <Row label="Denial rate">
                  {o.claims_this_month === 0 ? "—" : formatPercent(o.denial_rate)}
                </Row>
                <Row label="Denials worked (appeal cases)">
                  {String(denialsCount)}
                </Row>
                <Row label="Recovered from overturned denials (quarter)">
                  {formatMoney(o.recovered_this_quarter)}
                </Row>
                <Row label="Posted to your ledger">
                  {formatMoney(o.posted_to_ledger)}
                </Row>
                <Row label="Estimated ClaimMate fees (period)">
                  {formatMoney(estimateFees(o).fee)}
                </Row>
              </tbody>
            </table>

            <p className="mt-4 text-xs leading-5 text-gray-500">
              Fee basis — {estimateFees(o).note} Figures are drawn from the live
              demo data store at the time this report was generated; all data
              is synthetic.
            </p>

            {o.recovered_denials.length > 0 && (
              <>
                <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Recovered denials
                </h2>
                <table className="mt-2 w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-300 text-left text-gray-500">
                      <th className="py-1.5 pr-3 font-medium">Claim</th>
                      <th className="py-1.5 pr-3 font-medium">Payer</th>
                      <th className="py-1.5 pr-3 font-medium">CARC</th>
                      <th className="py-1.5 pr-3 text-right font-medium">
                        Recovered
                      </th>
                      <th className="py-1.5 text-right font-medium">Decided</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.recovered_denials.map((r) => (
                      <tr key={r.appeal_id} className="border-b border-gray-100">
                        <td className="py-1.5 pr-3 font-mono">{r.claim_id}</td>
                        <td className="py-1.5 pr-3">{r.payer_name}</td>
                        <td className="py-1.5 pr-3 font-mono">
                          CO-{r.carc_code}
                        </td>
                        <td className="py-1.5 pr-3 text-right font-mono tabular-nums">
                          {formatMoney(r.recovered_amount)}
                        </td>
                        <td className="py-1.5 text-right text-gray-500">
                          {formatDate(r.decided_at.slice(0, 10))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <p className="mt-10 border-t border-gray-200 pt-3 text-xs text-gray-400">
              ClaimMate, Inc. (fictional, demo) · Generated{" "}
              {new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}{" "}
              · Questions: billing-support@claimate.example
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <tr className="border-b border-gray-100">
      <td className="py-2 pr-4 text-gray-600">{label}</td>
      <td className="py-2 text-right font-mono tabular-nums text-ink">
        {children}
      </td>
    </tr>
  );
}
