import { Receipt } from "lucide-react";

import { useRemittances } from "../../api/queries";
import { DataTable, type Column } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { InfoTip } from "../../components/InfoTip";
import { TopBar } from "../../components/TopBar";
import { formatDate, formatMoney } from "../../lib/format";
import { PAYER_SIMULATOR_NOTE, usePortalSession } from "../../lib/identity";
import type { RemittanceRow } from "../../types";

export function PayerRemittances() {
  const session = usePortalSession();
  const payerName = session?.identity.payer_name ?? null;
  const { data, isLoading, isError, error } = useRemittances(payerName);

  const columns: Column<RemittanceRow>[] = [
    {
      key: "remit",
      header: "Remittance",
      className: "font-mono text-xs",
      sortValue: (r) => r.remit_id,
      render: (r) => r.remit_id,
    },
    {
      key: "date",
      header: "Payment Date",
      className: "text-xs text-gray-500",
      sortValue: (r) => r.payment_date,
      render: (r) => formatDate(r.payment_date),
    },
    {
      key: "method",
      header: "Method",
      className: "font-mono text-xs text-gray-600",
      sortValue: (r) => r.payment_method,
      render: (r) => r.payment_method,
    },
    {
      key: "claims",
      header: "Claims",
      className: "text-right font-mono text-xs tabular-nums",
      headerClassName: "text-right",
      sortValue: (r) => r.claims_count,
      render: (r) => r.claims_count,
    },
    {
      key: "amount",
      header: "Amount",
      className: "text-right font-mono text-xs tabular-nums",
      headerClassName: "text-right",
      sortValue: (r) => Number(r.payment_amount),
      render: (r) => formatMoney(r.payment_amount),
    },
    {
      key: "trace",
      header: "Trace #",
      className: "font-mono text-xs text-gray-500",
      render: (r) => r.trace_number,
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        title="Remittances"
        meta={
          data
            ? `${data.length} issued 835s — ${payerName ?? "all payers"}`
            : undefined
        }
        actions={
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            Simulator
            <InfoTip text={PAYER_SIMULATOR_NOTE} />
          </span>
        }
      />
      <div className="min-h-0 flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-px border border-gray-200 bg-white p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <div className="border border-gray-200 bg-white p-6 text-sm text-severity-error">
            Failed to load remittances: {error?.message}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={data ?? []}
            rowKey={(r) => r.remit_id}
            compact
            emptyState={
              <EmptyState
                icon={Receipt}
                title="No remittances"
                description="835 remittance advices issued by your organization appear here."
              />
            }
          />
        )}
      </div>
    </div>
  );
}
