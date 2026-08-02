import { classNames, formatConfidence } from "../lib/format";

interface Props {
  value: number;
  className?: string;
  barWidth?: number;
}

function tone(value: number): string {
  if (value >= 0.9) return "bg-severity-pass";
  if (value >= 0.7) return "bg-severity-warning";
  return "bg-severity-error";
}

/** Mono confidence number (0.87) + thin 4px bar colored by threshold. */
export function ConfidenceBar({ value, className, barWidth = 48 }: Props) {
  return (
    <span className={classNames("inline-flex items-center gap-2", className)}>
      <span className="font-mono text-xs tabular-nums text-gray-700">
        {formatConfidence(value)}
      </span>
      <span
        className="inline-block h-1 overflow-hidden rounded-none bg-gray-200"
        style={{ width: barWidth }}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value}
      >
        <span
          className={classNames("block h-full", tone(value))}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </span>
    </span>
  );
}
