import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

import { useQueue } from "../api/queries";
import { ConfidenceBar } from "../components/ConfidenceBar";
import { DataTable, type Column } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { MaskedName } from "../components/MaskedName";
import { StatusBadge, type BadgeTone } from "../components/StatusBadge";
import { TopBar } from "../components/TopBar";
import { ageFrom, classNames, formatMoney } from "../lib/format";
import type { QueueItemView } from "../types";

type Tab =
  | "all"
  | "low_confidence"
  | "high_value"
  | "scrub_errors"
  | "eligibility";

const HIGH_VALUE_THRESHOLD = 1000;
const LOW_CONFIDENCE_THRESHOLD = 0.7;

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "low_confidence", label: "Low Confidence" },
  { id: "high_value", label: "High Value" },
  { id: "scrub_errors", label: "Scrub Errors" },
  { id: "eligibility", label: "Eligibility" },
];

function matchesTab(item: QueueItemView, tab: Tab): boolean {
  switch (tab) {
    case "all":
      return true;
    case "low_confidence":
      return item.confidence < LOW_CONFIDENCE_THRESHOLD;
    case "high_value":
      return Number(item.claim_value) >= HIGH_VALUE_THRESHOLD;
    case "scrub_errors":
      return item.findings.some((f) => f.severity === "ERROR");
    case "eligibility":
      return item.findings.some((f) => f.rule_id.startsWith("ELIGIBILITY"));
  }
}

function reasonTone(reason: string): BadgeTone {
  const r = reason.toLowerCase();
  if (r.includes("scrub error")) return "red";
  if (r.includes("eligibility")) return "red";
  if (r.includes("clearinghouse")) return "red";
  if (r.includes("high-value")) return "blue";
  if (r.includes("confidence")) return "amber";
  return "neutral";
}

export function QueueScreen() {
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useQueue();
  const [tab, setTab] = useState<Tab>("all");

  const pending = useMemo(
    () => (data ?? []).filter((q) => q.review_status === "pending"),
    [data],
  );
  const rows = useMemo(
    () => pending.filter((q) => matchesTab(q, tab)),
    [pending, tab],
  );

  const columns: Column<QueueItemView>[] = [
    {
      key: "claim_id",
      header: "Claim",
      className: "font-mono text-xs",
      sortValue: (r) => r.claim_id,
      render: (r) => r.claim_id,
    },
    {
      key: "patient",
      header: "Patient",
      render: (r) => (
        <MaskedName firstName={r.patient_first_name} lastName={r.patient_last_name} />
      ),
    },
    {
      key: "provider",
      header: "Provider",
      className: "text-gray-600",
      sortValue: (r) => r.provider_name,
      render: (r) => r.provider_name,
    },
    {
      key: "value",
      header: "Value",
      className: "text-right font-mono text-xs tabular-nums",
      headerClassName: "text-right",
      sortValue: (r) => Number(r.claim_value),
      render: (r) => formatMoney(r.claim_value),
    },
    {
      key: "confidence",
      header: "Confidence",
      sortValue: (r) => r.confidence,
      render: (r) => <ConfidenceBar value={r.confidence} />,
    },
    {
      key: "reason",
      header: "Routing Reason",
      render: (r) => (
        <span className="inline-flex max-w-[320px] items-center gap-1 overflow-hidden">
          <StatusBadge
            label={r.reasons[0] ?? "Manual review"}
            tone={reasonTone(r.reasons[0] ?? "")}
            title={r.reasons.join("; ")}
          />
          {r.reasons.length > 1 && (
            <span className="text-xs text-gray-400">+{r.reasons.length - 1}</span>
          )}
        </span>
      ),
    },
    {
      key: "age",
      header: "Age",
      className: "text-right text-xs text-gray-500",
      headerClassName: "text-right",
      sortValue: (r) => new Date(r.enqueued_at).getTime(),
      render: (r) => ageFrom(r.enqueued_at),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        title="Review Queue"
        meta={
          data
            ? `${pending.length} pending / ${formatMoney(
                pending.reduce((s, q) => s + Number(q.claim_value), 0),
              )} total`
            : undefined
        }
      />

      <div className="flex items-center gap-1 border-b border-gray-200 bg-white px-6">
        {TABS.map((t) => {
          const count = pending.filter((q) => matchesTab(q, t.id)).length;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={classNames(
                "-mb-px flex h-9 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-ink"
                  : "border-transparent text-gray-500 hover:text-gray-700",
              )}
            >
              {t.label}
              <span
                className={classNames(
                  "font-mono text-xs tabular-nums",
                  active ? "text-gray-600" : "text-gray-400",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {isLoading ? (
          <QueueLoading />
        ) : isError ? (
          <div className="border border-gray-200 bg-white p-6 text-sm text-severity-error">
            Failed to load queue: {error?.message}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.item_id}
            onRowClick={(r) => navigate(`/ops/claims/${r.claim_id}`)}
            emptyState={
              <EmptyState
                icon={CheckCircle2}
                title="Queue is clear"
                description="No claims match this filter. Auto-approved claims bypass human review entirely."
              />
            }
          />
        )}
      </div>
    </div>
  );
}

/** Plain muted loading blocks — no shimmer. */
function QueueLoading() {
  return (
    <div className="border border-gray-200 bg-white">
      <div className="h-9 border-b border-gray-200 bg-gray-50" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex h-11 items-center gap-4 border-b border-gray-100 px-3 last:border-b-0">
          <div className="h-3 w-28 bg-gray-100" />
          <div className="h-3 w-20 bg-gray-100" />
          <div className="h-3 w-40 bg-gray-100" />
          <div className="ml-auto h-3 w-16 bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
