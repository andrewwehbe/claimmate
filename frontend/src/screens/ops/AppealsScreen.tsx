import { useMemo, useState } from "react";
import { Gavel } from "lucide-react";

import { useAppealCases } from "../../api/queries";
import { CodeChip } from "../../components/CodeChip";
import { DataTable, type Column } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { SidePanel } from "../../components/SidePanel";
import { StatusBadge } from "../../components/StatusBadge";
import { TopBar } from "../../components/TopBar";
import {
  APPEAL_STATUS_LABELS,
  APPEAL_STATUS_TONE,
  daysToDeadline,
} from "../../lib/appealUi";
import { carcDescription } from "../../lib/carcRarc";
import {
  ageFrom,
  classNames,
  formatMoney,
  formatPercent,
} from "../../lib/format";
import type { AppealCase, AppealsKpis } from "../../types";

export function AppealsScreen() {
  const { data, isLoading, isError, error } = useAppealCases();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => (data?.appeals ?? []).find((a) => a.appeal_id === selectedId) ?? null,
    [data, selectedId],
  );

  const active = (data?.appeals ?? []).filter(
    (a) => a.status !== "overturned" && a.status !== "upheld",
  );

  const columns: Column<AppealCase>[] = [
    {
      key: "appeal",
      header: "Appeal",
      className: "font-mono text-xs",
      sortValue: (a) => a.appeal_id,
      render: (a) => a.appeal_id,
    },
    {
      key: "claim",
      header: "Claim",
      className: "font-mono text-xs text-gray-600",
      sortValue: (a) => a.claim_id,
      render: (a) => a.claim_id,
    },
    {
      key: "practice",
      header: "Practice",
      className: "max-w-[220px] truncate text-gray-600",
      sortValue: (a) => a.practice_name,
      render: (a) => a.practice_name,
    },
    {
      key: "payer",
      header: "Payer",
      className: "text-gray-600",
      sortValue: (a) => a.payer_name,
      render: (a) => a.payer_name,
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
      header: "Denied",
      className: "text-right font-mono text-xs tabular-nums",
      headerClassName: "text-right",
      sortValue: (a) => Number(a.denied_amount),
      render: (a) => formatMoney(a.denied_amount),
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
    {
      key: "sla",
      header: "SLA Age",
      className: "text-right font-mono text-xs tabular-nums text-gray-600",
      headerClassName: "text-right",
      sortValue: (a) => new Date(a.opened_at).getTime(),
      render: (a) =>
        a.decided_at ? (
          <span className="text-gray-400">closed</span>
        ) : (
          ageFrom(a.opened_at)
        ),
    },
    {
      key: "deadline",
      header: "Deadline",
      className: "text-right font-mono text-xs tabular-nums",
      headerClassName: "text-right",
      sortValue: (a) => daysToDeadline(a.appeal_deadline),
      render: (a) => {
        if (a.decided_at) return <span className="text-gray-400">—</span>;
        const days = daysToDeadline(a.appeal_deadline);
        return (
          <span
            className={classNames(
              days < 0
                ? "text-severity-error"
                : days <= 14
                  ? "text-severity-warning"
                  : "text-gray-600",
            )}
          >
            {days < 0 ? `${-days}d over` : `${days}d left`}
          </span>
        );
      },
    },
    {
      key: "letter",
      header: "Letter",
      render: (a) => (
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedId(a.appeal_id);
          }}
        >
          view
        </button>
      ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        title="Appeals Workbench"
        meta={
          data
            ? `${active.length} active / ${data.appeals.length} total`
            : undefined
        }
      />

      {data && <KpiStrip kpis={data.kpis} />}

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-px border border-gray-200 bg-white p-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <div className="border border-gray-200 bg-white p-6 text-sm text-severity-error">
            Failed to load appeals: {error?.message}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={data?.appeals ?? []}
            rowKey={(a) => a.appeal_id}
            onRowClick={(a) => setSelectedId(a.appeal_id)}
            compact
            emptyState={
              <EmptyState
                icon={Gavel}
                title="No appeals"
                description="Denied claims classified as appealable are opened as cases here."
              />
            }
          />
        )}
      </div>

      <SidePanel
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected ? `${selected.appeal_id} · ${selected.claim_id}` : ""}
        subtitle={
          selected
            ? `${selected.practice_name} → ${selected.payer_name}`
            : undefined
        }
        width={640}
      >
        {selected && <AppealDetail appeal={selected} />}
      </SidePanel>
    </div>
  );
}

// -------------------------------------------------------------- KPI strip

function KpiStrip({ kpis }: { kpis: AppealsKpis }) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-px border-b border-gray-200 bg-gray-200 lg:grid-cols-4">
      <Kpi
        value={`${kpis.avg_turnaround_days}d`}
        label="Avg turnaround"
        note={`manual baseline ${kpis.manual_baseline_days}d`}
        good
      />
      <Kpi
        value={formatPercent(kpis.overturn_rate, 0)}
        label="Overturn rate"
        note={`${kpis.decided_count} decided appeals`}
      />
      <Kpi
        value={formatMoney(kpis.recovered_total)}
        label="Recovered"
        note="overturned denials, this period"
      />
      <Kpi
        value={formatMoney(kpis.recovered_per_fte)}
        label="Recovered / FTE-equivalent"
        note={`${kpis.fte_equivalent} FTE reviewer time`}
      />
    </div>
  );
}

function Kpi({
  value,
  label,
  note,
  good,
}: {
  value: string;
  label: string;
  note: string;
  good?: boolean;
}) {
  return (
    <div className="bg-white px-6 py-3">
      <span className="flex items-baseline gap-2">
        <span className="font-mono text-lg font-semibold tabular-nums text-ink">
          {value}
        </span>
        {good && (
          <span className="text-xs font-medium text-severity-pass">
            4x faster
          </span>
        )}
      </span>
      <span className="block text-xs font-medium text-gray-600">{label}</span>
      <span className="block text-xs text-gray-400">{note}</span>
    </div>
  );
}

// ---------------------------------------------------------------- detail

function AppealDetail({ appeal }: { appeal: AppealCase }) {
  return (
    <div className="space-y-5 p-4">
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
        {!appeal.decided_at && (
          <span className="ml-auto text-xs text-gray-500">
            deadline in {daysToDeadline(appeal.appeal_deadline)}d
          </span>
        )}
      </div>

      <section>
        <Label>Disputed services</Label>
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
        <Label>Timeline</Label>
        <div className="space-y-0">
          {appeal.events.map((e, i) => (
            <div key={i} className="flex gap-3 pb-3 last:pb-0">
              <div className="flex flex-col items-center">
                <span
                  className={classNames(
                    "mt-1 h-2 w-2 shrink-0 rounded-full",
                    i === appeal.events.length - 1
                      ? "bg-primary"
                      : "bg-gray-300",
                  )}
                />
                {i < appeal.events.length - 1 && (
                  <span className="w-px flex-1 bg-gray-200" />
                )}
              </div>
              <div className="min-w-0 pb-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-ink">{e.label}</span>
                  <span className="text-xs text-gray-400">
                    {ageFrom(e.at)} ago
                  </span>
                </div>
                {e.detail && (
                  <p className="mt-0.5 text-xs leading-4 text-gray-500">
                    {e.detail}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {appeal.payer_response && (
        <section>
          <Label>Payer response</Label>
          <div className="border-l-2 border-gray-300 bg-gray-50 p-3 text-sm leading-5 text-gray-700">
            {appeal.payer_response}
          </div>
        </section>
      )}

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
        <Label>Citations (from local reference)</Label>
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
