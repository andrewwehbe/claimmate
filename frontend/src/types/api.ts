/**
 * API response envelopes (view models).
 *
 * These are NOT backend Pydantic models — they are the composite shapes the
 * API endpoints return, built strictly out of the model types. Display-only
 * join fields (patient name for masking, provider, enqueue time) come from
 * the joined CodedClaim, never from invented model fields.
 */

import type { AppealLetter } from "./appeal";
import type { CodedClaim, CodedDiagnosis, CodedProcedure } from "./claim";
import type { DecimalString, ISODate, ISODateTime } from "./common";
import type { ClaimPayment, DenialAnalysis } from "./era";
import type { HITLQueueItem, RoutingDecision, ScrubFinding } from "./hitl";
import type { ClaimLifecycleStatus, EligibilityResult } from "./portal";

export type ReviewStatus = "pending" | "approved" | "rejected";

export type AppealStatus = "none" | "draft" | "submitted" | "won" | "lost";

/** Row shape for GET /api/queue: HITLQueueItem joined with claim display fields. */
export interface QueueItemView extends HITLQueueItem {
  /** From claim.patient — masked in the UI by default. */
  patient_first_name: string;
  patient_last_name: string;
  /** From claim.encounter.provider_name */
  provider_name: string;
  enqueued_at: ISODateTime;
  review_status: ReviewStatus;
}

/** Response shape for GET /api/claims/:id. */
export interface ClaimDetailView {
  claim: CodedClaim;
  findings: ScrubFinding[];
  routing: RoutingDecision;
  /** Rendered X12 837P output for this claim. */
  edi_837p: string;
  review_status: ReviewStatus;
  /** 270/271 eligibility result for the subscriber on the date of service. */
  eligibility: EligibilityResult;
  /** Clearinghouse lifecycle position. */
  lifecycle_status: ClaimLifecycleStatus;
  /** 277CA / 999 rejection text when lifecycle_status is clearinghouse_rejected. */
  clearinghouse_rejection: string | null;
}

/** Body for POST /api/claims/:id/codes. */
export interface UpdateCodesBody {
  diagnoses: CodedDiagnosis[];
  procedures: CodedProcedure[];
}

/** Row shape for GET /api/denials: DenialAnalysis joined with its 835 payment. */
export interface DenialRecordView {
  analysis: DenialAnalysis;
  payment: ClaimPayment;
  payer_name: string;
  /** CCYYMMDD from the 835 BPR segment. */
  payment_date: string;
  appeal_status: AppealStatus;
}

/** Response shape for GET /api/denials/:id/appeal. */
export interface AppealView {
  letter: AppealLetter;
  appeal_status: AppealStatus;
}

/** Response shape for GET /api/dashboard. */
export interface DashboardMetrics {
  claims_processed: number;
  /** 0..1 */
  auto_approval_rate: number;
  /** 0..1 */
  denial_rate: number;
  hitl_queue_value: DecimalString;
  clean_claim_rate_series: { date: ISODate; rate: number }[];
}
