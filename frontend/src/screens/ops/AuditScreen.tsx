import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";

import { useAudit } from "../../api/queries";
import { DataTable, type Column } from "../../components/DataTable";
import { EmptyState } from "../../components/EmptyState";
import { TopBar } from "../../components/TopBar";
import type { AuditEvent } from "../../types";

function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 19)}Z`;
}

export function AuditScreen() {
  const { data, isLoading, isError, error } = useAudit();
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [entity, setEntity] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const actors = useMemo(
    () => [...new Set((data ?? []).map((e) => e.actor))].sort(),
    [data],
  );
  const actions = useMemo(
    () => [...new Set((data ?? []).map((e) => e.action))].sort(),
    [data],
  );

  const rows = useMemo(() => {
    return (data ?? []).filter((e) => {
      if (actor && e.actor !== actor) return false;
      if (action && e.action !== action) return false;
      if (
        entity &&
        !e.entity_id.toLowerCase().includes(entity.toLowerCase()) &&
        !e.entity_type.toLowerCase().includes(entity.toLowerCase())
      )
        return false;
      const day = e.timestamp.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  }, [data, actor, action, entity, from, to]);

  const columns: Column<AuditEvent>[] = [
    {
      key: "time",
      header: "Timestamp (UTC)",
      className: "font-mono text-xs text-gray-500",
      sortValue: (e) => e.timestamp,
      render: (e) => fmtTimestamp(e.timestamp),
    },
    {
      key: "actor",
      header: "Actor",
      className: "max-w-[220px] truncate text-gray-700",
      sortValue: (e) => e.actor,
      render: (e) => e.actor,
    },
    {
      key: "portal",
      header: "Portal",
      className: "text-xs text-gray-500",
      sortValue: (e) => e.portal,
      render: (e) => e.portal,
    },
    {
      key: "action",
      header: "Action",
      className: "font-mono text-xs",
      sortValue: (e) => e.action,
      render: (e) => e.action,
    },
    {
      key: "entity",
      header: "Entity",
      className: "font-mono text-xs text-gray-600",
      sortValue: (e) => e.entity_id,
      render: (e) => e.entity_id,
    },
    {
      key: "summary",
      header: "Summary",
      className: "max-w-[380px] truncate text-xs text-gray-600",
      render: (e) => <span title={e.summary}>{e.summary}</span>,
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar
        title="Audit Log"
        meta={
          data ? `${rows.length} of ${data.length} events — append-only` : undefined
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-6 py-2">
        <select
          className="input h-8 text-xs"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          aria-label="Filter by actor"
        >
          <option value="">All actors</option>
          {actors.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          className="input h-8 font-mono text-xs"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          aria-label="Filter by action"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          className="input h-8 w-44 font-mono text-xs"
          placeholder="Entity ID search"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          aria-label="Search entity"
        />
        <span className="flex items-center gap-1 text-xs text-gray-400">
          <input
            type="date"
            className="input h-8 text-xs"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="From date"
          />
          –
          <input
            type="date"
            className="input h-8 text-xs"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="To date"
          />
        </span>
        {(actor || action || entity || from || to) && (
          <button
            type="button"
            className="text-xs text-gray-500 hover:text-ink"
            onClick={() => {
              setActor("");
              setAction("");
              setEntity("");
              setFrom("");
              setTo("");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-px border border-gray-200 bg-white p-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100" />
            ))}
          </div>
        ) : isError ? (
          <div className="border border-gray-200 bg-white p-6 text-sm text-severity-error">
            Failed to load audit log: {error?.message}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(e) => e.id}
            compact
            emptyState={
              <EmptyState
                icon={ScrollText}
                title="No matching audit events"
                description="Every state-changing action in any portal is recorded here. There is no edit or delete path."
              />
            }
          />
        )}
      </div>
    </div>
  );
}
