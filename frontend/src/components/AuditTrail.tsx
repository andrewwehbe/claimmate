import { useAudit } from "../api/queries";
import { ageFrom } from "../lib/format";

interface Props {
  entityId: string;
  limit?: number;
}

/** Last N audit events for one entity (claims, appeals, remittances). */
export function AuditTrail({ entityId, limit = 5 }: Props) {
  const { data, isLoading } = useAudit();
  const rows = (data ?? [])
    .filter((e) => e.entity_id === entityId)
    .slice(0, limit);

  if (isLoading) {
    return <div className="h-16 border border-gray-200 bg-gray-100" />;
  }
  if (rows.length === 0) {
    return (
      <div className="border border-gray-200 px-3 py-2 text-xs text-gray-400">
        No recorded actions for this entity yet.
      </div>
    );
  }
  return (
    <div className="border border-gray-200">
      {rows.map((e) => (
        <div
          key={e.id}
          className="flex items-baseline gap-2 border-b border-gray-100 px-3 py-1.5 text-xs last:border-b-0"
        >
          <span className="w-10 shrink-0 font-mono text-gray-400">
            {ageFrom(e.timestamp)}
          </span>
          <span className="shrink-0 font-mono text-gray-600">{e.action}</span>
          <span className="min-w-0 flex-1 truncate text-gray-500" title={e.summary}>
            {e.summary}
          </span>
          <span
            className="hidden shrink-0 text-gray-400 xl:inline"
            title={e.actor}
          >
            {e.actor.split(" · ")[0]}
          </span>
        </div>
      ))}
    </div>
  );
}
