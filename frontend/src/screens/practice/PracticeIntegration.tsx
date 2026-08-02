import { ArrowRight, Database, RefreshCw, Server } from "lucide-react";

import {
  usePracticeOverview,
  usePracticeSyncs,
  useRunSync,
} from "../../api/queries";
import { DataTable, type Column } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { SeverityDot } from "../../components/SeverityDot";
import { StatusBadge } from "../../components/StatusBadge";
import { TopBar } from "../../components/TopBar";
import { ageFrom } from "../../lib/format";
import { usePortalSession } from "../../lib/identity";
import type { SyncRun } from "../../types";
import { INTEGRATION_TONE } from "./PracticeDashboard";

const METHOD_LABELS = {
  direct_db: "Direct database connection (legacy)",
  vendor_api: "PM/EHR vendor API",
  fhir_api: "FHIR API",
  sftp_flat_file: "SFTP flat-file export",
} as const;

export function PracticeIntegration() {
  const session = usePortalSession();
  const practiceId = session?.identity.practice_id;
  const overview = usePracticeOverview(practiceId);
  const syncs = usePracticeSyncs(practiceId);
  const runSync = useRunSync(practiceId ?? "");

  const account = overview.data?.account;

  const columns: Column<SyncRun>[] = [
    {
      key: "run",
      header: "Run",
      className: "font-mono text-xs",
      render: (r) => r.run_id,
    },
    {
      key: "when",
      header: "Started",
      className: "text-xs text-gray-500",
      sortValue: (r) => r.started_at,
      render: (r) => `${ageFrom(r.started_at)} ago`,
    },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <SeverityDot
          severity={
            r.status === "success"
              ? "PASS"
              : r.status === "partial"
                ? "WARNING"
                : r.status === "failed"
                  ? "ERROR"
                  : "INFO"
          }
          showLabel={false}
          className="mr-1"
        />
      ),
    },
    {
      key: "imported",
      header: "Imported",
      className: "text-right font-mono text-xs tabular-nums",
      headerClassName: "text-right",
      sortValue: (r) => r.rows_imported,
      render: (r) => r.rows_imported.toLocaleString("en-US"),
    },
    {
      key: "failed",
      header: "Failed",
      className: "text-right font-mono text-xs tabular-nums",
      headerClassName: "text-right",
      sortValue: (r) => r.rows_failed,
      render: (r) =>
        r.rows_failed > 0 ? (
          <span className="text-severity-error">{r.rows_failed}</span>
        ) : (
          "0"
        ),
    },
    {
      key: "error",
      header: "Detail",
      className: "max-w-[360px] truncate text-xs text-gray-500",
      render: (r) => r.error_message ?? "—",
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        title="Integration"
        meta={account ? `${account.ehr_system} · ${METHOD_LABELS[account.integration_method]}` : undefined}
        actions={
          <button
            type="button"
            className="btn-secondary h-8 px-2.5 text-xs"
            disabled={runSync.isPending || !practiceId}
            onClick={() => runSync.mutate()}
          >
            <RefreshCw
              size={12}
              className={runSync.isPending ? "animate-spin" : undefined}
            />
            {runSync.isPending ? "Syncing…" : "Re-run sync"}
          </button>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {overview.isLoading ? (
          <div className="h-32 border border-gray-200 bg-gray-100" />
        ) : account ? (
          <>
            {/* Connection status + flow */}
            <div className="mb-6 grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="border border-gray-200 bg-white p-4">
                <div className="text-xs font-medium text-gray-500">
                  Connection status
                </div>
                <div className="mt-2">
                  <StatusBadge
                    label={account.integration_status}
                    tone={INTEGRATION_TONE[account.integration_status]}
                  />
                </div>
                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Method</dt>
                    <dd className="text-gray-700">
                      {METHOD_LABELS[account.integration_method]}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">Last successful sync</dt>
                    <dd className="font-mono text-gray-700">
                      {account.last_sync_at
                        ? `${ageFrom(account.last_sync_at)} ago`
                        : "never"}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Data-flow direction diagram */}
              <div className="flex items-center justify-center gap-3 border border-gray-200 bg-white p-4">
                <FlowNode
                  icon={Database}
                  title={account.ehr_system}
                  note="Practice EHR / PM"
                />
                <FlowArrow label="charts / claims" />
                <FlowNode
                  icon={Server}
                  title="RemitPath connector"
                  note={METHOD_LABELS[account.integration_method]}
                />
                <FlowArrow label="normalized encounters" />
                <FlowNode
                  icon={Server}
                  title="RCM engine"
                  note="code · scrub · submit · appeal"
                />
              </div>
            </div>

            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Recent sync runs
            </h2>
            {syncs.isLoading ? (
              <div className="h-40 border border-gray-200 bg-gray-100" />
            ) : (
              <DataTable
                columns={columns}
                rows={syncs.data ?? []}
                rowKey={(r) => r.run_id}
                compact
                emptyState={
                  <EmptyState
                    icon={Database}
                    title="No sync runs yet"
                    description="Once onboarding completes the connection, scheduled syncs will appear here with row counts and errors."
                  />
                }
              />
            )}
            {runSync.isError && (
              <div className="mt-2 text-xs text-severity-error">
                Sync failed to start: {runSync.error?.message}
              </div>
            )}
          </>
        ) : (
          <div className="border border-gray-200 bg-white p-6 text-sm text-severity-error">
            Failed to load integration: {overview.error?.message}
          </div>
        )}
      </div>
    </div>
  );
}

function FlowNode({
  icon: Icon,
  title,
  note,
}: {
  icon: typeof Database;
  title: string;
  note: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 border border-gray-200 bg-gray-50 px-4 py-3 text-center">
      <Icon size={15} className="text-gray-500" />
      <span className="text-xs font-medium text-ink">{title}</span>
      <span className="text-xs text-gray-500">{note}</span>
    </div>
  );
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <ArrowRight size={14} className="text-gray-400" />
      <span className="whitespace-nowrap text-xs text-gray-400">{label}</span>
    </div>
  );
}
