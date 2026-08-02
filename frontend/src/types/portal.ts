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

export type IntegrationMethod = "direct_db" | "fhir_api" | "sftp_flat_file";

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

export type PracticeClaimStatus =
  | "submitted"
  | "paid"
  | "denied"
  | "appealing"
  | "recovered";

/** Row for GET /api/practices/:id/claims (read-only status list). */
export interface PracticeClaimRow {
  claim_id: string;
  patient_first_name: string;
  patient_last_name: string;
  service_date: ISODate;
  payer_name: string;
  amount: DecimalString;
  status: PracticeClaimStatus;
}

/** Response for GET /api/practices/:id/overview. */
export interface PracticeOverview {
  account: PracticeAccount;
  last_sync: SyncRun | null;
  claims_this_month: number;
  denial_rate: number;
  recovered_this_quarter: DecimalString;
  recovered_denials: RecoveredDenialRow[];
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
  /** End of the payer's appeal filing window. */
  appeal_deadline: ISODate;
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

/** Row for GET /api/payer/remittances. */
export interface RemittanceRow {
  remit_id: string;
  payer_name: string;
  payment_date: ISODate;
  payment_method: string;
  payment_amount: DecimalString;
  claims_count: number;
  trace_number: string;
}
