import { ListChecks } from "lucide-react";

import { usePracticeClaims } from "../../api/queries";
import { DataTable, type Column } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { MaskedName } from "../../components/MaskedName";
import { StatusBadge, type BadgeTone } from "../../components/StatusBadge";
import { TopBar } from "../../components/TopBar";
import { formatDate, formatMoney } from "../../lib/format";
import { usePortalSession } from "../../lib/identity";
import type { ClaimLifecycleStatus, PracticeClaimRow } from "../../types";

/** Same lifecycle vocabulary as ops, with practice-friendly labels. */
const STATUS_LABELS: Record<ClaimLifecycleStatus, string> = {
  generated: "Preparing",
  submitted_to_clearinghouse: "Submitted",
  clearinghouse_accepted: "Accepted at clearinghouse",
  clearinghouse_rejected: "Rejected at clearinghouse",
  payer_received: "With payer",
  paid: "Paid",
  denied: "Denied",
};

const STATUS_TONE: Record<ClaimLifecycleStatus, BadgeTone> = {
  generated: "neutral",
  submitted_to_clearinghouse: "blue",
  clearinghouse_accepted: "blue",
  clearinghouse_rejected: "red",
  payer_received: "amber",
  paid: "green",
  denied: "red",
};

export function PracticeClaims() {
  const session = usePortalSession();
  const practiceId = session?.identity.practice_id;
  const { data, isLoading, isError, error } = usePracticeClaims(practiceId);

  const columns: Column<PracticeClaimRow>[] = [
    {
      key: "claim",
      header: "Claim",
      className: "font-mono text-xs",
      sortValue: (r) => r.claim_id,
      render: (r) => r.claim_id,
    },
    {
      key: "patient",
      header: "Patient",
      render: (r) => (
        <MaskedName
          firstName={r.patient_first_name}
          lastName={r.patient_last_name}
        />
      ),
    },
    {
      key: "dos",
      header: "Service Date",
      className: "text-xs text-gray-500",
      sortValue: (r) => r.service_date,
      render: (r) => formatDate(r.service_date),
    },
    {
      key: "payer",
      header: "Payer",
      className: "text-gray-600",
      sortValue: (r) => r.payer_name,
      render: (r) => r.payer_name,
    },
    {
      key: "amount",
      header: "Amount",
      className: "text-right font-mono text-xs tabular-nums",
      headerClassName: "text-right",
      sortValue: (r) => Number(r.amount),
      render: (r) => formatMoney(r.amount),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => (
        <StatusBadge
          label={STATUS_LABELS[r.status]}
          tone={STATUS_TONE[r.status]}
          title={r.status}
        />
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        title="Claims"
        meta={data ? `${data.length} recent claims (read-only)` : undefined}
      />
      <div className="min-h-0 flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-px border border-gray-200 bg-surface p-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <div className="border border-gray-200 bg-surface p-6 text-sm text-severity-error">
            Failed to load claims: {error?.message}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={data ?? []}
            rowKey={(r) => r.claim_id}
            compact
            emptyState={
              <EmptyState
                icon={ListChecks}
                title="No claims imported yet"
                description="Claims appear after your integration's first successful sync."
              />
            }
          />
        )}
      </div>
    </div>
  );
}
