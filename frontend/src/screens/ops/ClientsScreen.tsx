import { useMemo, useState } from "react";
import { Building2 } from "lucide-react";

import { useAppealCases, usePractices, usePracticeSyncs } from "../../api/queries";
import { CodeChip } from "../../components/CodeChip";
import { DataTable, type Column } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { SeverityDot } from "../../components/SeverityDot";
import { SidePanel } from "../../components/SidePanel";
import { StatusBadge } from "../../components/StatusBadge";
import { TopBar } from "../../components/TopBar";
import { ageFrom, formatMoney, formatPercent } from "../../lib/format";
import type { PlanType, PracticeAccount } from "../../types";
import { INTEGRATION_TONE } from "../practice/PracticeDashboard";
import { APPEAL_STATUS_LABELS, APPEAL_STATUS_TONE } from "../../lib/appealUi";

const PLAN_LABELS: Record<PlanType, string> = {
  performance: "Performance",
  hybrid: "Hybrid",
  denial_recovery_share: "Recovery share",
};

export function ClientsScreen() {
  const { data, isLoading, isError, error } = usePractices();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => (data ?? []).find((p) => p.practice_id === selectedId) ?? null,
    [data, selectedId],
  );

  const columns: Column<PracticeAccount>[] = [
    {
      key: "name",
      header: "Practice",
      sortValue: (p) => p.legal_name,
      render: (p) => (
        <span className="font-medium text-ink">{p.legal_name}</span>
      ),
    },
    {
      key: "specialty",
      header: "Specialty",
      className: "text-gray-600",
      sortValue: (p) => p.specialty,
      render: (p) => p.specialty,
    },
    {
      key: "state",
      header: "State",
      className: "font-mono text-xs text-gray-600",
      sortValue: (p) => p.state,
      render: (p) => p.state,
    },
    {
      key: "plan",
      header: "Plan",
      sortValue: (p) => p.plan,
      render: (p) => <StatusBadge label={PLAN_LABELS[p.plan]} />,
    },
    {
      key: "integration",
      header: "Integration",
      sortValue: (p) => p.integration_status,
      render: (p) => (
        <StatusBadge
          label={p.integration_status}
          tone={INTEGRATION_TONE[p.integration_status]}
        />
      ),
    },
    {
      key: "claims",
      header: "Claims/mo",
      className: "text-right font-mono text-xs tabular-nums",
      headerClassName: "text-right",
      sortValue: (p) => p.claims_per_month,
      render: (p) => p.claims_per_month.toLocaleString("en-US"),
    },
    {
      key: "denial",
      header: "Denial Rate",
      className: "text-right font-mono text-xs tabular-nums",
      headerClassName: "text-right",
      sortValue: (p) => p.denial_rate,
      render: (p) =>
        p.claims_per_month === 0 ? (
          <span className="text-gray-400">—</span>
        ) : (
          formatPercent(p.denial_rate)
        ),
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        title="Clients"
        meta={data ? `${data.length} onboarded practices` : undefined}
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
            Failed to load clients: {error?.message}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={data ?? []}
            rowKey={(p) => p.practice_id}
            onRowClick={(p) => setSelectedId(p.practice_id)}
            emptyState={
              <EmptyState
                icon={Building2}
                title="No client practices"
                description="Practices created through the signup wizard appear here."
              />
            }
          />
        )}
      </div>

      <SidePanel
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected?.legal_name ?? ""}
        subtitle={
          selected
            ? `${selected.specialty} · ${selected.state} · ${selected.providers_count} providers`
            : undefined
        }
        width={560}
      >
        {selected && <ClientDetail practice={selected} />}
      </SidePanel>
    </div>
  );
}

function ClientDetail({ practice }: { practice: PracticeAccount }) {
  const syncs = usePracticeSyncs(practice.practice_id);
  const appeals = useAppealCases();
  const practiceAppeals = (appeals.data?.appeals ?? []).filter(
    (a) => a.practice_id === practice.practice_id,
  );

  return (
    <div className="space-y-5 p-4">
      <section>
        <Label>Contacts</Label>
        <div className="border border-gray-200 p-3 text-sm">
          <div className="font-medium text-ink">{practice.contact_name}</div>
          <div className="mt-0.5 font-mono text-xs text-gray-500">
            {practice.contact_email}
          </div>
        </div>
      </section>

      <section>
        <Label>Integration</Label>
        <div className="space-y-2 border border-gray-200 p-3 text-sm">
          <div className="flex items-center gap-2">
            <StatusBadge
              label={practice.integration_status}
              tone={INTEGRATION_TONE[practice.integration_status]}
            />
            <span className="text-xs text-gray-500">
              {practice.ehr_system} ·{" "}
              {practice.integration_method.replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            Group NPI <CodeChip code={practice.group_npi} />
            <span>
              · onboarded {ageFrom(practice.created_at)} ago · last sync{" "}
              {practice.last_sync_at
                ? `${ageFrom(practice.last_sync_at)} ago`
                : "never"}
            </span>
          </div>
        </div>
      </section>

      <section>
        <Label>Commercials</Label>
        <div className="grid grid-cols-3 gap-px border border-gray-200 bg-gray-200">
          <Cell label="Plan" value={PLAN_LABELS[practice.plan]} />
          <Cell
            label="Claims/mo"
            value={practice.claims_per_month.toLocaleString("en-US")}
            mono
          />
          <Cell
            label="Recovered (qtr)"
            value={formatMoney(practice.recovered_this_quarter)}
            mono
          />
        </div>
      </section>

      <section>
        <Label>Activity</Label>
        <div className="space-y-1.5">
          {(syncs.data ?? []).slice(0, 3).map((r) => (
            <div
              key={r.run_id}
              className="flex items-center gap-2 border border-gray-200 px-3 py-2 text-xs"
            >
              <SeverityDot
                severity={
                  r.status === "success"
                    ? "PASS"
                    : r.status === "partial"
                      ? "WARNING"
                      : "ERROR"
                }
                showLabel={false}
              />
              <span className="font-mono text-gray-600">{r.run_id}</span>
              <span className="text-gray-500">
                {r.rows_imported} rows, {r.rows_failed} failed
              </span>
              <span className="ml-auto text-gray-400">
                {ageFrom(r.started_at)} ago
              </span>
            </div>
          ))}
          {practiceAppeals.map((a) => (
            <div
              key={a.appeal_id}
              className="flex items-center gap-2 border border-gray-200 px-3 py-2 text-xs"
            >
              <StatusBadge
                label={APPEAL_STATUS_LABELS[a.status]}
                tone={APPEAL_STATUS_TONE[a.status]}
              />
              <span className="font-mono text-gray-600">{a.claim_id}</span>
              <span className="ml-auto font-mono tabular-nums text-gray-600">
                {formatMoney(a.denied_amount)}
              </span>
            </div>
          ))}
          {(syncs.data ?? []).length === 0 && practiceAppeals.length === 0 && (
            <div className="border border-gray-200 px-3 py-2 text-xs text-gray-400">
              No activity yet.
            </div>
          )}
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

function Cell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-surface p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div
        className={
          mono
            ? "mt-0.5 font-mono text-sm tabular-nums text-ink"
            : "mt-0.5 text-sm font-medium text-ink"
        }
      >
        {value}
      </div>
    </div>
  );
}
