import { Link } from "react-router-dom";
import { CircleCheck } from "lucide-react";

import { usePracticeOverview } from "../../api/queries";
import { CodeChip } from "../../components/CodeChip";
import { DataTable, type Column } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { StatusBadge, type BadgeTone } from "../../components/StatusBadge";
import { TopBar } from "../../components/TopBar";
import { ageFrom, formatMoney, formatPercent } from "../../lib/format";
import { usePortalSession } from "../../lib/identity";
import type { IntegrationStatus, RecoveredDenialRow } from "../../types";

export const INTEGRATION_TONE: Record<IntegrationStatus, BadgeTone> = {
  connected: "green",
  degraded: "amber",
  error: "red",
  pending: "neutral",
};

export function PracticeDashboard() {
  const session = usePortalSession();
  const practiceId = session?.identity.practice_id;
  const { data, isLoading, isError, error } = usePracticeOverview(practiceId);

  const pending = data?.account.integration_status === "pending";

  const columns: Column<RecoveredDenialRow>[] = [
    {
      key: "claim",
      header: "Claim",
      className: "font-mono text-xs",
      sortValue: (r) => r.claim_id,
      render: (r) => r.claim_id,
    },
    {
      key: "payer",
      header: "Payer",
      className: "text-gray-600",
      render: (r) => r.payer_name,
    },
    {
      key: "carc",
      header: "Denial Reason",
      render: (r) => <CodeChip code={`CO-${r.carc_code}`} />,
    },
    {
      key: "amount",
      header: "Recovered",
      className: "text-right font-mono text-xs tabular-nums",
      headerClassName: "text-right",
      sortValue: (r) => Number(r.recovered_amount),
      render: (r) => formatMoney(r.recovered_amount),
    },
    {
      key: "when",
      header: "Decided",
      className: "text-right text-xs text-gray-500",
      headerClassName: "text-right",
      sortValue: (r) => r.decided_at,
      render: (r) => `${ageFrom(r.decided_at)} ago`,
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        title="Dashboard"
        meta={data ? data.account.legal_name : undefined}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 border border-gray-200 bg-gray-100" />
            ))}
          </div>
        ) : isError || !data ? (
          <div className="border border-gray-200 bg-white p-6 text-sm text-severity-error">
            Failed to load overview: {error?.message}
          </div>
        ) : (
          <>
            {pending && (
              <div className="mb-6 border-l-2 border-severity-warning bg-white p-4">
                <div className="text-sm font-medium text-ink">
                  Integration pending
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Your account is created and our onboarding team is completing
                  the {data.account.ehr_system} connection. Claim data will
                  appear here after the first sync.{" "}
                  <Link
                    to="/practice/integration"
                    className="font-medium text-primary hover:underline"
                  >
                    View integration status
                  </Link>
                </p>
              </div>
            )}

            <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
              <Card
                label="Claims this month"
                value={data.claims_this_month.toLocaleString("en-US")}
              />
              <Card
                label="Denial rate"
                value={formatPercent(data.denial_rate)}
                note="of adjudicated claims"
              />
              <Card
                label="Recovered this quarter"
                value={formatMoney(data.recovered_this_quarter)}
                note="from overturned denials"
              />
              <div className="border border-gray-200 bg-white p-4">
                <div className="text-xs font-medium text-gray-500">
                  Integration sync
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge
                    label={data.account.integration_status}
                    tone={INTEGRATION_TONE[data.account.integration_status]}
                  />
                  {data.last_sync && (
                    <span className="text-xs text-gray-500">
                      {ageFrom(data.last_sync.started_at)} ago
                    </span>
                  )}
                </div>
                {data.last_sync ? (
                  <div className="mt-1.5 font-mono text-xs tabular-nums text-gray-600">
                    {data.last_sync.rows_imported} imported ·{" "}
                    {data.last_sync.rows_failed} failed
                  </div>
                ) : (
                  <div className="mt-1.5 text-xs text-gray-400">
                    No syncs yet
                  </div>
                )}
              </div>
            </div>

            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Denials recovered
            </h2>
            <DataTable
              columns={columns}
              rows={data.recovered_denials}
              rowKey={(r) => r.appeal_id}
              compact
              emptyState={
                <EmptyState
                  icon={CircleCheck}
                  title="No recovered denials yet"
                  description={
                    pending
                      ? "Recoveries will appear once your integration is live and denials are being worked."
                      : "When RemitPath overturns a denial for your practice, it appears here with the recovered amount."
                  }
                />
              }
            />
          </>
        )}
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-ink">
        {value}
      </div>
      {note && <div className="mt-0.5 text-xs text-gray-400">{note}</div>}
    </div>
  );
}
