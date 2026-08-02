import type { Severity } from "../types";
import { classNames } from "../lib/format";

const COLORS: Record<Severity | "PASS", string> = {
  ERROR: "bg-severity-error",
  WARNING: "bg-severity-warning",
  INFO: "bg-severity-info",
  PASS: "bg-severity-pass",
};

const LABELS: Record<Severity | "PASS", string> = {
  ERROR: "Error",
  WARNING: "Warning",
  INFO: "Info",
  PASS: "Pass",
};

interface Props {
  severity: Severity | "PASS";
  showLabel?: boolean;
  className?: string;
}

/** 8px severity dot + optional text label. Never a full colored background. */
export function SeverityDot({ severity, showLabel = true, className }: Props) {
  return (
    <span className={classNames("inline-flex items-center gap-1.5", className)}>
      <span
        aria-hidden
        className={classNames(
          "h-2 w-2 shrink-0 rounded-full",
          COLORS[severity],
        )}
      />
      {showLabel && (
        <span className="text-xs font-medium text-gray-600">
          {LABELS[severity]}
        </span>
      )}
    </span>
  );
}
