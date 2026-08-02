import { classNames } from "../lib/format";
import type { ClaimLifecycleStatus } from "../types";

interface Props {
  status: ClaimLifecycleStatus;
  /** 277CA / 999 text shown under the stepper when rejected. */
  rejection?: string | null;
}

interface Step {
  label: string;
  state: "done" | "current" | "error" | "future";
}

function buildSteps(status: ClaimLifecycleStatus): Step[] {
  const rejected = status === "clearinghouse_rejected";
  const denied = status === "denied";
  const position: Record<ClaimLifecycleStatus, number> = {
    generated: 0,
    submitted_to_clearinghouse: 1,
    clearinghouse_accepted: 2,
    clearinghouse_rejected: 2,
    payer_received: 3,
    paid: 4,
    denied: 4,
  };
  const pos = position[status];
  const labels = [
    "Generated",
    "Clearinghouse",
    rejected ? "Rejected" : "Accepted",
    "Payer received",
    denied ? "Denied" : "Paid",
  ];
  return labels.map((label, i) => {
    if (i < pos) return { label, state: "done" };
    if (i > pos) return { label, state: "future" };
    return { label, state: rejected || denied ? "error" : "current" };
  });
}

/** Compact horizontal clearinghouse-lifecycle stepper. */
export function ClaimStepper({ status, rejection }: Props) {
  const steps = buildSteps(status);
  return (
    <div>
      <ol className="flex items-center">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center">
            {i > 0 && (
              <span
                aria-hidden
                className={classNames(
                  "mx-1.5 h-px w-5",
                  s.state === "future" ? "bg-gray-200" : "bg-gray-400",
                )}
              />
            )}
            <span className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={classNames(
                  "h-2 w-2 shrink-0 rounded-full",
                  s.state === "done" && "bg-gray-400",
                  s.state === "current" && "bg-primary",
                  s.state === "error" && "bg-severity-error",
                  s.state === "future" && "border border-gray-300 bg-white",
                )}
              />
              <span
                className={classNames(
                  "whitespace-nowrap text-xs",
                  s.state === "error"
                    ? "font-medium text-severity-error"
                    : s.state === "current"
                      ? "font-medium text-ink"
                      : s.state === "done"
                        ? "text-gray-600"
                        : "text-gray-400",
                )}
              >
                {s.label}
              </span>
            </span>
          </li>
        ))}
      </ol>
      {status === "clearinghouse_rejected" && rejection && (
        <p className="mt-1.5 font-mono text-xs text-severity-error">
          {rejection}
        </p>
      )}
    </div>
  );
}
