import { Receipt } from "lucide-react";

import { useOpsRemittances, usePostRemittance } from "../../api/queries";
import { CodeChip } from "../../components/CodeChip";
import { DataTable, type Column } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { StatusBadge } from "../../components/StatusBadge";
import { TopBar } from "../../components/TopBar";
import { formatDate, formatMoney } from "../../lib/format";
import type { RemittanceRow } from "../../types";

export function OpsRemittances() {
  const { data, isLoading, isError, error } = useOpsRemittances();
  const post = usePostRemittance();

  const unposted = (data ?? []).filter((r) => !r.posted);

  const columns: Column<RemittanceRow>[] = [
    {
      key: "remit",
      header: "Remittance",
      className: "font-mono text-xs",
      sortValue: (r) => r.remit_id,
      render: (r) => r.remit_id,
    },
    {
      key: "payer",
      header: "Payer",
      className: "text-gray-600",
      sortValue: (r) => r.payer_name,
      render: (r) => r.payer_name,
    },
    {
      key: "claim",
      header: "Claim",
      className: "font-mono text-xs text-gray-600",
      sortValue: (r) => r.claim_id ?? "",
      render: (r) =>
        r.claim_id ?? <span className="text-gray-400">batch ({r.claims_count})</span>,
    },
    {
      key: "lines",
      header: "CPT Lines",
      render: (r) =>
        r.service_lines.length > 0 ? (
          <span className="inline-flex gap-1">
            {r.service_lines.map((l) => (
              <CodeChip
                key={l.procedure_code}
                code={l.procedure_code}
                title={`Paid ${formatMoney(l.paid_amount)}`}
              />
            ))}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
    {
      key: "adjustments",
      header: "Adjustments",
      render: (r) =>
        r.adjustments.length > 0 ? (
          <span className="inline-flex gap-1">
            {r.adjustments.map((a, i) => (
              <CodeChip
                key={i}
                code={`${a.group_code}-${a.reason_code}`}
                title={`Adjustment ${formatMoney(a.amount)}`}
              />
            ))}
          </span>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
    {
      key: "paid",
      header: "Paid",
      className: "text-right font-mono text-xs tabular-nums",
      headerClassName: "text-right",
      sortValue: (r) => Number(r.payment_amount),
      render: (r) => formatMoney(r.payment_amount),
    },
    {
      key: "date",
      header: "Date",
      className: "text-xs text-gray-500",
      sortValue: (r) => r.payment_date,
      render: (r) => formatDate(r.payment_date),
    },
    {
      key: "posted",
      header: "Posting",
      sortValue: (r) => (r.posted ? 1 : 0),
      render: (r) =>
        r.posted ? (
          <StatusBadge label="Posted" tone="green" />
        ) : (
          <button
            type="button"
            className="btn-secondary h-6 px-2 text-xs"
            disabled={post.isPending}
            onClick={() => post.mutate(r.remit_id)}
          >
            Post
          </button>
        ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        title="Remittances"
        meta={
          data
            ? `${data.length} parsed 835s · ${unposted.length} unposted`
            : undefined
        }
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
            Failed to load remittances: {error?.message}
          </div>
        ) : (
          <>
            {post.isError && (
              <div className="mb-3 text-xs text-severity-error">
                Posting failed: {post.error?.message}
              </div>
            )}
            <DataTable
              columns={columns}
              rows={data ?? []}
              rowKey={(r) => r.remit_id}
              compact
              emptyState={
                <EmptyState
                  icon={Receipt}
                  title="No remittances"
                  description="Parsed 835s appear here; posting marks the payment applied to the practice ledger."
                />
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
