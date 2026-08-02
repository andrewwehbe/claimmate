import { useMemo, useState } from "react";
import { Check, FileQuestion, Inbox, X } from "lucide-react";

import { useAppealCases, useAppealDecision } from "../../api/queries";
import { CodeChip } from "../../components/CodeChip";
import { InfoTip } from "../../components/InfoTip";
import { DataTable, type Column } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { SidePanel } from "../../components/SidePanel";
import { StatusBadge } from "../../components/StatusBadge";
import { TopBar } from "../../components/TopBar";
import {
  APPEAL_STATUS_LABELS,
  APPEAL_STATUS_TONE,
} from "../../lib/appealUi";
import { carcDescription } from "../../lib/carcRarc";
import { ageFrom, formatMoney } from "../../lib/format";
import { PAYER_SIMULATOR_NOTE, usePortalSession } from "../../lib/identity";
import type { AppealCase } from "../../types";

export function PayerInbox() {
  const session = usePortalSession();
  const payerName = session?.identity.payer_name ?? null;
  const { data, isLoading, isError, error } = useAppealCases();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The payer sees appeals actually filed with them (drafts are internal).
  const rows = useMemo(
    () =>
      (data?.appeals ?? []).filter(
        (a) => a.payer_name === payerName && a.submitted_at !== null,
      ),
    [data, payerName],
  );

  const selected = rows.find((a) => a.appeal_id === selectedId) ?? null;
  const open = rows.filter(
    (a) => a.status !== "overturned" && a.status !== "upheld",
  );

  const columns: Column<AppealCase>[] = [
    {
      key: "claim",
      header: "Claim",
      className: "font-mono text-xs",
      sortValue: (a) => a.claim_id,
      render: (a) => a.claim_id,
    },
    {
      key: "practice",
      header: "Practice",
      className: "max-w-[240px] truncate text-gray-600",
      sortValue: (a) => a.practice_name,
      render: (a) => a.practice_name,
    },
    {
      key: "carc",
      header: "CARC",
      render: (a) => (
        <CodeChip code={`CO-${a.carc_code}`} title={carcDescription(a.carc_code)} />
      ),
    },
    {
      key: "amount",
      header: "Amount",
      className: "text-right font-mono text-xs tabular-nums",
      headerClassName: "text-right",
      sortValue: (a) => Number(a.denied_amount),
      render: (a) => formatMoney(a.denied_amount),
    },
    {
      key: "received",
      header: "Received",
      className: "text-right text-xs text-gray-500",
      headerClassName: "text-right",
      sortValue: (a) => a.submitted_at ?? "",
      render: (a) => `${ageFrom(a.submitted_at!)} ago`,
    },
    {
      key: "status",
      header: "Status",
      sortValue: (a) => a.status,
      render: (a) => (
        <StatusBadge
          label={APPEAL_STATUS_LABELS[a.status]}
          tone={APPEAL_STATUS_TONE[a.status]}
        />
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        title="Appeals Inbox"
        meta={
          payerName
            ? `${open.length} open of ${rows.length} received — ${payerName}`
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
            Failed to load inbox: {error?.message}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(a) => a.appeal_id}
            onRowClick={(a) => setSelectedId(a.appeal_id)}
            compact
            emptyState={
              <EmptyState
                icon={Inbox}
                title="No appeals received"
                description="Appeals filed with your organization by provider practices appear here."
              />
            }
          />
        )}
      </div>

      <SidePanel
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected ? selected.claim_id : ""}
        subtitle={
          selected
            ? `From ${selected.practice_name} · received ${ageFrom(selected.submitted_at!)} ago`
            : undefined
        }
        width={640}
      >
        {selected && (
          <PayerAppealDetail
            appeal={selected}
            onDecided={() => setSelectedId(null)}
          />
        )}
      </SidePanel>
    </div>
  );
}

function PayerAppealDetail({
  appeal,
  onDecided,
}: {
  appeal: AppealCase;
  onDecided: () => void;
}) {
  const decision = useAppealDecision();
  const decided = appeal.status === "overturned" || appeal.status === "upheld";

  const act = (action: "overturn" | "uphold" | "request_records") => {
    decision.mutate(
      { appealId: appeal.appeal_id, action },
      { onSuccess: () => (action === "request_records" ? undefined : onDecided()) },
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            label={APPEAL_STATUS_LABELS[appeal.status]}
            tone={APPEAL_STATUS_TONE[appeal.status]}
          />
          <CodeChip
            code={`CO-${appeal.carc_code}`}
            title={carcDescription(appeal.carc_code)}
          />
          <span className="font-mono text-sm tabular-nums text-ink">
            {formatMoney(appeal.denied_amount)}
          </span>
        </div>

        <section>
          <Label>Original denial</Label>
          <p className="border-l-2 border-severity-info bg-gray-50 p-3 text-sm leading-5 text-gray-700">
            CARC {appeal.carc_code}: {carcDescription(appeal.carc_code)}
          </p>
        </section>

        <section>
          <Label>Claim service lines</Label>
          <div className="border border-gray-200">
            {appeal.disputed_services.map((s) => (
              <div
                key={s.procedure_code}
                className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 last:border-b-0"
              >
                <CodeChip code={s.procedure_code} />
                <span className="min-w-0 flex-1 truncate text-sm text-gray-600">
                  {s.description}
                </span>
                <span className="font-mono text-xs tabular-nums">
                  {formatMoney(s.charge_amount)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <Label>Appeal letter</Label>
          <div className="mb-1.5 text-sm font-medium text-ink">
            {appeal.letter_subject}
          </div>
          <pre className="whitespace-pre-wrap border border-gray-200 bg-gray-50 p-3 font-mono text-xs leading-5 text-gray-700">
            {appeal.letter_body}
          </pre>
        </section>

        <section>
          <Label>Cited authorities</Label>
          <div className="space-y-1.5">
            {appeal.citations.map((c) => (
              <div
                key={c.reference}
                className="border-l-2 border-gray-300 bg-gray-50 p-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium text-ink">
                    {c.reference}
                  </span>
                  <span className="text-xs text-gray-500">{c.source}</span>
                </div>
                <p className="mt-0.5 text-xs leading-4 text-gray-600">
                  {c.summary}
                </p>
              </div>
            ))}
          </div>
        </section>

        {appeal.payer_response && (
          <section>
            <Label>Your response on file</Label>
            <p className="border-l-2 border-gray-300 bg-gray-50 p-3 text-sm leading-5 text-gray-700">
              {appeal.payer_response}
            </p>
          </section>
        )}

        {decision.isError && (
          <p className="text-xs text-severity-error">
            Action failed — status rolled back: {decision.error?.message}
          </p>
        )}
      </div>

      {/* Decision bar */}
      <footer className="flex shrink-0 items-center gap-2 border-t border-gray-200 bg-white p-3">
        {decided ? (
          <span className="text-xs text-gray-500">
            Decision recorded: this appeal was {appeal.status}.
          </span>
        ) : (
          <>
            <button
              type="button"
              className="btn-primary"
              disabled={decision.isPending}
              onClick={() => act("overturn")}
            >
              <Check size={14} /> Overturn
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={decision.isPending}
              onClick={() => act("uphold")}
            >
              <X size={14} /> Uphold
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={decision.isPending || appeal.status === "payer_responded"}
              onClick={() => act("request_records")}
            >
              <FileQuestion size={14} /> Request records
            </button>
          </>
        )}
      </footer>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </div>
  );
}
