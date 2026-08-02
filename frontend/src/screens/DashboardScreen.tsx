import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useDashboard } from "../api/queries";
import { TopBar } from "../components/TopBar";
import { formatMoney, formatPercent } from "../lib/format";

const CHART_BLUE = "#2563EB";

/** Recharts needs concrete values; static light palette. */
const chart = {
  grid: "#F4F4F5",
  axisText: "#A1A1AA",
  axisLine: "#E4E4E7",
  cursor: "#D4D4D8",
  dotStroke: "#FFFFFF",
} as const;

export function DashboardScreen() {
  const { data, isLoading, isError, error } = useDashboard();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TopBar title="Dashboard" meta="Trailing 90 days" />
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <DashboardLoading />
        ) : isError || !data ? (
          <div className="border border-gray-200 bg-surface p-6 text-sm text-severity-error">
            Failed to load metrics: {error?.message}
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
              <StatCard
                label="Claims processed"
                value={data.claims_processed.toLocaleString("en-US")}
              />
              <StatCard
                label="Auto-approval rate"
                value={formatPercent(data.auto_approval_rate, 0)}
                note="claims submitted without human review"
              />
              <StatCard
                label="Denial rate"
                value={formatPercent(data.denial_rate)}
                note="of adjudicated claims"
              />
              <StatCard
                label="In HITL queue"
                value={formatMoney(data.hitl_queue_value)}
                note="pending human review"
              />
            </div>

            <section className="border border-gray-200 bg-surface">
              <header className="border-b border-gray-200 px-4 py-3">
                <h2 className="text-sm font-semibold text-ink">
                  Clean claim rate
                </h2>
                <p className="text-xs text-gray-500">
                  Weekly share of claims accepted on first submission
                </p>
              </header>
              <div className="h-72 px-2 py-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={data.clean_claim_rate_series}
                    margin={{ top: 8, right: 24, bottom: 4, left: 8 }}
                  >
                    <CartesianGrid
                      stroke={chart.grid}
                      strokeWidth={1}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d: string) =>
                        new Date(`${d}T00:00:00`).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      }
                      tick={{ fontSize: 11, fill: chart.axisText }}
                      tickLine={false}
                      axisLine={{ stroke: chart.axisLine }}
                      tickMargin={8}
                    />
                    <YAxis
                      domain={[0.85, 1]}
                      tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                      tick={{ fontSize: 11, fill: chart.axisText }}
                      tickLine={false}
                      axisLine={false}
                      width={40}
                    />
                    <Tooltip
                      cursor={{ stroke: chart.cursor, strokeWidth: 1 }}
                      content={<RateTooltip />}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke={CHART_BLUE}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{
                        r: 3.5,
                        fill: CHART_BLUE,
                        stroke: chart.dotStroke,
                        strokeWidth: 2,
                      }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="border border-gray-200 bg-surface p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-ink">
        {value}
      </div>
      {note && <div className="mt-0.5 text-xs text-gray-400">{note}</div>}
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}

function RateTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-gray-200 bg-surface px-2.5 py-1.5 shadow-sm">
      <div className="text-xs text-gray-500">
        Week of{" "}
        {new Date(`${label}T00:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </div>
      <div className="font-mono text-sm font-medium tabular-nums text-ink">
        {formatPercent(payload[0].value)}
      </div>
    </div>
  );
}

function DashboardLoading() {
  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 border border-gray-200 bg-gray-100" />
        ))}
      </div>
      <div className="h-80 border border-gray-200 bg-gray-100" />
    </div>
  );
}
