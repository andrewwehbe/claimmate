import { useMemo, useState } from "react";
import { ArrowUpRight, Gavel } from "lucide-react";

import { useAppealCases, useEscalateAppeal } from "../../api/queries";
import { AuditTrail } from "../../components/AuditTrail";
import { CodeChip } from "../../components/CodeChip";
import { DataTable, type Column } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { SidePanel } from "../../components/SidePanel";
import { StatusBadge } from "../../components/StatusBadge";
import { TopBar } from "../../components/TopBar";
import {
  APPEAL_LEVEL_LABELS,
  APPEAL_LEVEL_LONG,
  deadlineDays,
  isPayerOverride,
  NEXT_LEVEL,
  SUBMISSION_CHANNEL_LABELS,
} from "../../lib/appealRules";
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
      key: "level",
      header: "Level",
      sortValue: (a) => a.level,
      render: (a) => (
        <StatusBadge
          label={APPEAL_LEVEL_LABELS[a.level]}
          title={APPEAL_LEVEL_LONG[a.level]}
        />
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
          className="text-xs font-medium text-accent hover:underline"
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
          <div className="space-y-px border border-gray-200 bg-surface p-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <div className="border border-gray-200 bg-surface p-6 text-sm text-severity-error">
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
        {selected && (
          <AppealDetail appeal={selected} onSelectAppeal={setSelectedId} />
        )}
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
    <div className="bg-surface px-6 py-3">
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

function AppealDetail({
  appeal,
  onSelectAppeal,
}: {
  appeal: AppealCase;
  onSelectAppeal: (id: string) => void;
}) {
  const escalate = useEscalateAppeal();
  const nextLevel = NEXT_LEVEL[appeal.level];
  const canEscalate =
    appeal.status === "upheld" && nextLevel !== null && !appeal.successor_id;
  const windowDays = deadlineDays(appeal.level, appeal.payer_name);

  return (
    <div className="space-y-5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge
          label={APPEAL_STATUS_LABELS[appeal.status]}
          tone={APPEAL_STATUS_TONE[appeal.status]}
        />
        <StatusBadge
          label={APPEAL_LEVEL_LABELS[appeal.level]}
          title={APPEAL_LEVEL_LONG[appeal.level]}
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

      <div className="space-y-0.5 text-xs text-gray-500">
        <div>
          Submission channel:{" "}
          <span className="text-gray-700">
            {SUBMISSION_CHANNEL_LABELS[appeal.submission_channel]}
          </span>
        </div>
        <div>
          Filing window: {windowDays} days ({APPEAL_LEVEL_LONG[appeal.level]},{" "}
          {isPayerOverride(appeal.level, appeal.payer_name)
            ? `${appeal.payer_name} override`
            : "default rule"}
          ) — deadline{" "}
          <span className="font-mono text-gray-700">{appeal.appeal_deadline}</span>
        </div>
        {appeal.predecessor_id && (
          <div>
            Created from upheld{" "}
            <button
              type="button"
              className="font-mono text-accent hover:underline"
              onClick={() => onSelectAppeal(appeal.predecessor_id!)}
            >
              {appeal.predecessor_id}
            </button>
          </div>
        )}
        {appeal.successor_id && (
          <div>
            Escalated to{" "}
            <button
              type="button"
              className="font-mono text-accent hover:underline"
              onClick={() => onSelectAppeal(appeal.successor_id!)}
            >
              {appeal.successor_id}
            </button>
          </div>
        )}
      </div>

      {appeal.status === "upheld" && (
        <div className="flex items-center gap-2 border-l-2 border-severity-warning bg-amber-50/60 p-3 dark:bg-amber-500/10">
          {canEscalate ? (
            <>
              <span className="flex-1 text-sm text-gray-700">
                Upheld at {APPEAL_LEVEL_LONG[appeal.level].toLowerCase()}. Next
                step: {APPEAL_LEVEL_LONG[nextLevel!].toLowerCase()} (
                {deadlineDays(nextLevel!, appeal.payer_name)}-day window from
                the uphold date).
              </span>
              <button
                type="button"
                className="btn-secondary shrink-0"
                disabled={escalate.isPending}
                onClick={() =>
                  escalate.mutate(appeal.appeal_id, {
                    onSuccess: (successor) =>
                      onSelectAppeal(successor.appeal_id),
                  })
                }
              >
                <ArrowUpRight size={14} />
                {escalate.isPending ? "Escalating…" : "Escalate to next level"}
              </button>
            </>
          ) : (
            <span className="text-sm text-gray-600">
              {appeal.successor_id
                ? `Already escalated to ${appeal.successor_id}.`
                : "External review is the final level; no further escalation is available."}
            </span>
          )}
          {escalate.isError && (
            <span className="text-xs text-severity-error">
              {escalate.error?.message}
            </span>
          )}
        </div>
      )}

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

      <section>
        <Label>Recent activity</Label>
        <AuditTrail entityId={appeal.appeal_id} />
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
