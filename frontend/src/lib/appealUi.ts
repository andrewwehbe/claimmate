/** Shared UI mappings for appeal cases (ops workbench + payer portal). */

import type { BadgeTone } from "../components/StatusBadge";
import type { AppealCaseStatus } from "../types";

export const APPEAL_STATUS_LABELS: Record<AppealCaseStatus, string> = {
  drafting: "drafting",
  awaiting_payer: "awaiting payer",
  payer_responded: "payer responded",
  overturned: "overturned",
  upheld: "upheld",
};

export const APPEAL_STATUS_TONE: Record<AppealCaseStatus, BadgeTone> = {
  drafting: "neutral",
  awaiting_payer: "blue",
  payer_responded: "amber",
  overturned: "green",
  upheld: "red",
};

/** Whole days until the payer appeal-window deadline (negative = past). */
export function daysToDeadline(deadlineIso: string): number {
  const deadline = new Date(`${deadlineIso}T23:59:59`).getTime();
  return Math.floor((deadline - Date.now()) / 86_400_000);
}
