import { useEffect, useMemo, useState } from "react";
import { FileWarning, RefreshCw } from "lucide-react";

import { useAppeal, useDenials, useRegenerateAppeal } from "../api/queries";
import { CodeChip } from "../components/CodeChip";
import { DataTable, type Column } from "../components/DataTable";
import { EmptyState } from "../components/EmptyState";
import { SidePanel } from "../components/SidePanel";
import { StatusBadge, type BadgeTone } from "../components/StatusBadge";
import { TopBar } from "../components/TopBar";
import {
  carcDescription,
  DENIAL_CATEGORY_LABELS,
  rarcDescription,
} from "../lib/carcRarc";
import { formatMoney, formatX12Date } from "../lib/format";
import type { AppealStatus, DenialCategory, DenialRecordView } from "../types";

const CATEGORY_TONE: Record<DenialCategory, BadgeTone> = {
  medical_necessity: "amber",
  coding_error: "red",
  auth_missing: "red",
  timely_filing: "amber",
  cob: "blue",
  patient_responsibility: "neutral",
  contractual: "neutral",
  other: "neutral",
};

const APPEAL_TONE: Record<AppealStatus, BadgeTone> = {
  none: "neutral",
  draft: "blue",
  submitted: "amber",
  won: "green",
  lost: "red",
};

/** Denial ids are derived from the claim id suffix (DEN-XXXX seed convention). */
function denialId(rec: DenialRecordView): string {
  return `DEN-${rec.analysis.claim_id.slice(-4)}`;
}

export function DenialsScreen() {
  const { data, isLoading, isError, error } = useDenials();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => (data ?? []).find((r) => denialId(r) === selectedId) ?? null,
    [data, selectedId],
  );

  const columns: Column<DenialRecordView>[] = [
    {
      key: "claim",
      header: "Claim",
      className: "font-mono text-xs",
      sortValue: (r) => r.analysis.claim_id,
      render: (r) => r.analysis.claim_id,
    },
    {
      key: "payer",
      header: "Payer",
      className: "text-gray-600",
      sortValue: (r) => r.payer_name,
      render: (r) => r.payer_name,
    },
    {
      key: "carc",
      header: "CARC",
      render: (r) => (
        <CodeChip
          code={`CO-${r.analysis.carc_code}`}
          title={carcDescription(r.analysis.carc_code)}
        />
      ),
    },
    {
      key: "rarc",
      header: "RARC",
      render: (r) => (
        <span className="inline-flex gap-1">
          {r.analysis.rarc_codes.length === 0 && (
            <span className="text-xs text-gray-400">—</span>
          )}
          {r.analysis.rarc_codes.map((c) => (
            <CodeChip key={c} code={c} title={rarcDescription(c)} />
          ))}
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      sortValue: (r) => r.analysis.category,
      render: (r) => (
        <StatusBadge
          label={DENIAL_CATEGORY_LABELS[r.analysis.category]}
          tone={CATEGORY_TONE[r.analysis.category]}
        />
      ),
    },
    {
      key: "denied",
      header: "Denied",
      className: "text-right font-mono text-xs tabular-nums",
      headerClassName: "text-right",
      sortValue: (r) => Number(r.analysis.denied_amount),
      render: (r) => formatMoney(r.analysis.denied_amount),
    },
    {
      key: "date",
      header: "Remit Date",
      className: "text-xs text-gray-500",
      sortValue: (r) => r.payment_date,
      render: (r) => formatX12Date(r.payment_date),
    },
    {
      key: "appeal",
      header: "Appeal",
      sortValue: (r) => r.appeal_status,
      render: (r) =>
        r.analysis.is_appealable ? (
          <StatusBadge
            label={r.appeal_status}
            tone={APPEAL_TONE[r.appeal_status]}
          />
        ) : (
          <span className="text-xs text-gray-400">not appealable</span>
        ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        title="Denials & Appeals"
        meta={
          data
            ? `${data.length} denials / ${formatMoney(
                data.reduce((s, r) => s + Number(r.analysis.denied_amount), 0),
              )} denied`
            : undefined
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
            Failed to load denials: {error?.message}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={data ?? []}
            rowKey={denialId}
            onRowClick={(r) => setSelectedId(denialId(r))}
            compact
            emptyState={
              <EmptyState
                icon={FileWarning}
                title="No denials"
                description="Parsed 835 remittances with denied claim payments will appear here."
              />
            }
          />
        )}
      </div>

      <SidePanel
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected?.analysis.claim_id ?? ""}
        subtitle={
          selected
            ? `${selected.payer_name} • remit ${formatX12Date(selected.payment_date)}`
            : undefined
        }
        width={640}
      >
        {selected && <DenialDetail rec={selected} denialId={selectedId!} />}
      </SidePanel>
    </div>
  );
}

// ------------------------------------------------------------- detail

function DenialDetail({
  rec,
  denialId: id,
}: {
  rec: DenialRecordView;
  denialId: string;
}) {
  const a = rec.analysis;
  return (
    <div className="space-y-5 p-4">
      <section>
        <PanelLabel>Denial</PanelLabel>
        <div className="border border-gray-200">
          <Row label="Category">
            <StatusBadge
              label={DENIAL_CATEGORY_LABELS[a.category]}
              tone={CATEGORY_TONE[a.category]}
            />
          </Row>
          <Row label="CARC">
            <span className="flex items-start gap-2">
              <CodeChip code={`CO-${a.carc_code}`} />
              <span className="text-sm text-gray-600">{a.carc_description}</span>
            </span>
          </Row>
          {a.rarc_codes.map((c) => (
            <Row key={c} label="RARC">
              <span className="flex items-start gap-2">
                <CodeChip code={c} />
                <span className="text-sm text-gray-600">
                  {a.rarc_descriptions[c] ?? rarcDescription(c)}
                </span>
              </span>
            </Row>
          ))}
          <Row label="Denied amount">
            <span className="font-mono text-sm tabular-nums text-ink">
              {formatMoney(a.denied_amount)}
            </span>
          </Row>
          <Row label="Payer claim #">
            <span className="font-mono text-xs">
              {rec.payment.payer_claim_number ?? "—"}
            </span>
          </Row>
        </div>
        {a.notes && <p className="mt-2 text-sm leading-5 text-gray-600">{a.notes}</p>}
      </section>

      <section>
        <PanelLabel>Service lines (835)</PanelLabel>
        <div className="border border-gray-200">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-500">
            <span>Procedure</span>
            <span className="text-right">Billed</span>
            <span className="text-right">Paid</span>
          </div>
          {rec.payment.service_lines.map((l, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-gray-100 px-2.5 py-1.5 last:border-b-0"
            >
              <span className="flex items-center gap-1.5">
                <CodeChip code={l.procedure_code} />
                {l.adjustments.map((adj, j) => (
                  <span key={j} className="font-mono text-xs text-gray-400">
                    {adj.group_code}-{adj.reason_code}
                  </span>
                ))}
              </span>
              <span className="text-right font-mono text-xs tabular-nums">
                {formatMoney(l.charge_amount)}
              </span>
              <span className="text-right font-mono text-xs tabular-nums">
                {formatMoney(l.paid_amount)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {a.is_appealable ? (
        <AppealEditor denialId={id} appealStatus={rec.appeal_status} />
      ) : (
        <section className="border-l-2 border-severity-info bg-gray-50 p-3 text-sm text-gray-600">
          This denial is not appealable (CARC {a.carc_code}).{" "}
          {a.category === "contractual"
            ? "Contractual adjustments are written off per the payer agreement."
            : "Correct and resubmit where applicable."}
        </section>
      )}
    </div>
  );
}

function AppealEditor({
  denialId: id,
  appealStatus,
}: {
  denialId: string;
  appealStatus: AppealStatus;
}) {
  const { data, isLoading, isError, error } = useAppeal(id, true);
  const regenerate = useRegenerateAppeal(id);
  const [body, setBody] = useState("");

  useEffect(() => {
    if (data) setBody(data.letter.body);
  }, [data]);

  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between">
        <PanelLabel className="mb-0">Appeal letter</PanelLabel>
        <div className="flex items-center gap-2">
          <StatusBadge label={appealStatus} tone={APPEAL_TONE[appealStatus]} />
          <button
            type="button"
            className="btn-secondary h-7 px-2 text-xs"
            disabled={regenerate.isPending || isLoading}
            onClick={() => regenerate.mutate()}
          >
            <RefreshCw
              size={12}
              className={regenerate.isPending ? "animate-spin" : undefined}
            />
            {regenerate.isPending ? "Regenerating…" : "Regenerate"}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-48 border border-gray-200 bg-gray-100" />
      ) : isError ? (
        <div className="border border-gray-200 p-3 text-sm text-severity-error">
          Failed to load appeal: {error?.message}
        </div>
      ) : data ? (
        <>
          <div className="mb-2 text-sm font-medium text-ink">
            {data.letter.subject}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            spellCheck={false}
            aria-label="Appeal letter body"
            className="w-full resize-y rounded-sm border border-gray-300 p-3 font-mono text-xs leading-5 text-gray-700 focus:border-primary focus:outline-none"
          />
          {data.letter.citations.length > 0 && (
            <div className="mt-3">
              <PanelLabel>Citations (from local reference)</PanelLabel>
              <div className="space-y-1.5">
                {data.letter.citations.map((c) => (
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
            </div>
          )}
          <div className="mt-2 font-mono text-xs text-gray-400">
            generated_by: {data.letter.generated_by}
          </div>
        </>
      ) : null}
    </section>
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
    <div className="flex items-start gap-3 border-b border-gray-100 px-2.5 py-2 last:border-b-0">
      <span className="w-28 shrink-0 pt-0.5 text-xs text-gray-500">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

function PanelLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
