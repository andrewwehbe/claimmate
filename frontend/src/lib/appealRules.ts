/**
 * Appeal level ladder, filing-deadline rules, and submission channels.
 * Mirrors the engine's rule table — keep in sync with the backend.
 *
 * Deadline = days from the triggering denial (or uphold, for escalations)
 * per level, with per-payer overrides.
 */

import type { AppealLevel, SubmissionChannel } from "../types";

export const APPEAL_LEVEL_LABELS: Record<AppealLevel, string> = {
  reconsideration: "Recon",
  level_1: "Level 1",
  level_2: "Level 2",
  external_review: "External",
};

export const APPEAL_LEVEL_LONG: Record<AppealLevel, string> = {
  reconsideration: "Reconsideration",
  level_1: "Level 1 appeal",
  level_2: "Level 2 appeal",
  external_review: "External review",
};

/** Next rung of the ladder; external_review is terminal. */
export const NEXT_LEVEL: Record<AppealLevel, AppealLevel | null> = {
  reconsideration: "level_1",
  level_1: "level_2",
  level_2: "external_review",
  external_review: null,
};

/** Default filing windows in days from the denial (or uphold) date. */
export const DEFAULT_DEADLINE_DAYS: Record<AppealLevel, number> = {
  reconsideration: 90,
  level_1: 60,
  level_2: 60,
  external_review: 120,
};

/** Per-payer overrides of the defaults. */
export const PAYER_DEADLINE_OVERRIDES: Record<
  string,
  Partial<Record<AppealLevel, number>>
> = {
  "Aetna PPO": { reconsideration: 180 },
};

/** Level- and payer-specific filing window in days. */
export function deadlineDays(level: AppealLevel, payerName: string): number {
  return (
    PAYER_DEADLINE_OVERRIDES[payerName]?.[level] ??
    DEFAULT_DEADLINE_DAYS[level]
  );
}

/** True when the payer's window differs from the default for this level. */
export function isPayerOverride(level: AppealLevel, payerName: string): boolean {
  return PAYER_DEADLINE_OVERRIDES[payerName]?.[level] !== undefined;
}

export const SUBMISSION_CHANNEL_LABELS: Record<SubmissionChannel, string> = {
  payer_portal: "payer portal",
  fax: "fax",
  certified_mail: "certified mail",
  electronic_275: "electronic (X12 275)",
};
