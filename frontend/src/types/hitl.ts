/** Mirrors src/rcm/models/hitl.py — ScrubFinding, RoutingDecision, HITLQueueItem. */

import type { DecimalString } from "./common";

export type Severity = "INFO" | "WARNING" | "ERROR";

export interface ScrubFinding {
  /** e.g. "MOD25_MISSING" */
  rule_id: string;
  severity: Severity;
  message: string;
  procedure_code: string | null;
  field: string | null;
}

export interface RoutingDecision {
  route_to_human: boolean;
  reasons: string[];
}

export interface HITLQueueItem {
  item_id: string;
  claim_id: string;
  reasons: string[];
  confidence: number;
  claim_value: DecimalString;
  findings: ScrubFinding[];
}
