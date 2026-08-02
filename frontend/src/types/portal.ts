/**
 * Multi-portal view models (API envelope shapes, types/api.ts style).
 *
 * These are frontend/API view models for the practice, ops, and payer
 * portals — NOT backend Pydantic models. They reuse model types (Citation,
 * DisputedService, DecimalString) wherever those exist.
 */

import type { Citation, DisputedService } from "./appeal";
import type { DecimalString, ISODate, ISODateTime } from "./common";

// ------------------------------------------------------------- practices

export type IntegrationMethod =
  | "direct_db" // legacy clients only; no longer offered in the signup wizard
  | "vendor_api"
  | "fhir_api"
  | "sftp_flat_file";

export type IntegrationStatus = "pending" | "connected" | "degraded" | "error";

export type PlanType = "performance" | "hybrid" | "denial_recovery_share";

export interface PracticeAccount {
  practice_id: string;
  legal_name: string;
  specialty: string;
  providers_count: number;
  state: string;
  /** Organization (Type 2) NPI — Luhn-validated at signup. */
  group_npi: string;
  ehr_system: string;
  integration_method: IntegrationMethod;
  integration_status: IntegrationStatus;
  plan: PlanType;
  contact_name: string;
  contact_email: string;
  created_at: ISODateTime;
  last_sync_at: ISODateTime | null;
  claims_per_month: number;
  /** 0..1 */
  denial_rate: number;
  recovered_this_quarter: DecimalString;
}

/** Body for POST /api/practices/signup (from the onboarding wizard). */
export interface PracticeSignupBody {
  legal_name: string;
  specialty: string;
  providers_count: number;
  state: string;
  group_npi: string;
  contact_name: string;
  contact_email: string;
  ehr_system: string;
  integration_method: IntegrationMethod;
  /** Free-form connection fields for the chosen method (mock only). */
  connection: Record<string, string>;
  plan: PlanType;
}

export interface SyncRun {
  run_id: string;
  practice_id: string;
  started_at: ISODateTime;
  finished_at: ISODateTime | null;
  status: "running" | "success" | "partial" | "failed";
  rows_imported: number;
  rows_failed: number;
  error_message: string | null;
}

/**
 * Clearinghouse claim lifecycle (mirrors the engine's status vocabulary):
 * generated -> submitted_to_clearinghouse -> clearinghouse_accepted |
 * clearinghouse_rejected -> payer_received -> paid | denied.
 * denied -> paid after appeal overturn; clearinghouse_rejected ->
 * submitted_to_clearinghouse on resubmit.
 */
export type ClaimLifecycleStatus =
  | "generated"
  | "submitted_to_clearinghouse"
  | "clearinghouse_accepted"
  | "clearinghouse_rejected"
  | "payer_received"
  | "paid"
  | "denied";

/** Row for GET /api/practices/:id/claims (read-only status list). */
export interface PracticeClaimRow {
  claim_id: string;
  patient_first_name: string;
  patient_last_name: string;
  service_date: ISODate;
  payer_name: string;
  amount: DecimalString;
  status: ClaimLifecycleStatus;
}

/** Response for GET /api/practices/:id/overview. */
export interface PracticeOverview {
  account: PracticeAccount;
  last_sync: SyncRun | null;
  claims_this_month: number;
  denial_rate: number;
  recovered_this_quarter: DecimalString;
  /** Sum of POSTED remittance dollars for this practice. */
  posted_to_ledger: DecimalString;
  recovered_denials: RecoveredDenialRow[];
}

// ------------------------------------------------------------ eligibility

export type EligibilityStatus = "active" | "inactive" | "terminated" | "not_found";

/** 270/271 eligibility check result attached to a claim (view model). */
export interface EligibilityResult {
  status: EligibilityStatus;
  plan_name: string;
  copay: DecimalString;
  deductible_remaining: DecimalString;
  termination_date: ISODate | null;
  checked_at: ISODateTime;
}

export interface RecoveredDenialRow {
  appeal_id: string;
  claim_id: string;
  carc_code: string;
  payer_name: string;
  recovered_amount: DecimalString;
  decided_at: ISODateTime;
}

// --------------------------------------------------------------- appeals

export type AppealCaseStatus =
  | "drafting"
  | "awaiting_payer"
  | "payer_responded"
  | "overturned"
  | "upheld";

/** How the appeal is (or will be) filed with the payer. */
export type SubmissionChannel =
  | "payer_portal"
  | "fax"
  | "certified_mail"
  | "electronic_275";

/** Escalation ladder. external_review is terminal. */
export type AppealLevel =
  | "reconsideration"
  | "level_1"
  | "level_2"
  | "external_review";

export interface AppealEvent {
  at: ISODateTime;
  label: string;
  detail: string | null;
}

/** One appeal case in the workbench / payer inbox (shared store). */
export interface AppealCase {
  appeal_id: string;
  claim_id: string;
  practice_id: string;
  practice_name: string;
  payer_name: string;
  carc_code: string;
  denied_amount: DecimalString;
  status: AppealCaseStatus;
  /** Denial received / case opened. */
  opened_at: ISODateTime;
  /** Appeal letter sent to payer (null while drafting). */
  submitted_at: ISODateTime | null;
  decided_at: ISODateTime | null;
  /**
   * End of the payer's appeal filing window, computed from the level- and
   * payer-specific deadline rules (see lib/appealRules.ts).
   */
  appeal_deadline: ISODate;
  level: AppealLevel;
  submission_channel: SubmissionChannel;
  /** Set when this appeal was created by escalating an upheld predecessor. */
  predecessor_id: string | null;
  /** Set when an upheld appeal has been escalated to the next level. */
  successor_id: string | null;
  letter_subject: string;
  letter_body: string;
  citations: Citation[];
  disputed_services: DisputedService[];
  events: AppealEvent[];
  payer_response: string | null;
}

/** KPI strip vs. the manual-biller baseline. */
export interface AppealsKpis {
  avg_turnaround_days: number;
  manual_baseline_days: number;
  /** 0..1 over decided appeals */
  overturn_rate: number;
  decided_count: number;
  recovered_total: DecimalString;
  /** FTE-equivalent reviewer time consumed by the automated pipeline. */
  fte_equivalent: number;
  recovered_per_fte: DecimalString;
}

/** Response for GET /api/appeals. */
export interface AppealsResponse {
  kpis: AppealsKpis;
  appeals: AppealCase[];
}

export type PayerDecisionAction = "overturn" | "uphold" | "request_records";

// ----------------------------------------------------------- remittances

export interface RemitServiceLine {
  procedure_code: string;
  paid_amount: DecimalString;
}

export interface RemitAdjustment {
  group_code: string;
  reason_code: string;
  amount: DecimalString;
}

/** Row for GET /api/remittances (ops) and /api/payer/remittances (simulator). */
export interface RemittanceRow {
  remit_id: string;
  payer_name: string;
  payment_date: ISODate;
  payment_method: string;
  payment_amount: DecimalString;
  claims_count: number;
  trace_number: string;
  /** Linked claim / client practice, when the remit maps to one claim. */
  claim_id: string | null;
  practice_id: string | null;
  service_lines: RemitServiceLine[];
  adjustments: RemitAdjustment[];
  /** Payment posting state. Posting is one-way (toggle once, audit-logged). */
  posted: boolean;
}

// --------------------------------------------------------------- audit log

/**
 * Append-only audit record. There is no update or delete path for these —
 * the mock store only ever appends.
 */
export interface AuditEvent {
  id: string;
  timestamp: ISODateTime;
  /** Demo identity: "Name · Role". */
  actor: string;
  portal: string;
  /** e.g. "claim.approve", "appeal.escalate", "payer.overturn". */
  action: string;
  entity_type: string;
  entity_id: string;
  /** Short before -> after text. */
  summary: string;
}
