/** Mirrors src/rcm/models/era.py — denial taxonomy, 835 remittance models. */

import type { DecimalString } from "./common";

export type DenialCategory =
  | "medical_necessity"
  | "coding_error"
  | "auth_missing"
  | "timely_filing"
  | "cob"
  | "patient_responsibility"
  | "contractual"
  | "other";

export type AdjustmentGroupCode = "CO" | "PR" | "OA" | "PI" | "CR";

/** One CAS adjustment: group code + CARC reason code + amount. */
export interface Adjustment {
  group_code: AdjustmentGroupCode;
  /** CARC, e.g. "50" */
  reason_code: string;
  amount: DecimalString;
  quantity: number | null;
}

export interface ServiceLinePayment {
  procedure_code: string;
  charge_amount: DecimalString;
  paid_amount: DecimalString;
  adjustments: Adjustment[];
  /** RARCs, e.g. "N115" */
  remark_codes: string[];
}

export interface ClaimPayment {
  /** Submitter claim ID (CLP01) */
  claim_id: string;
  /** CLP02: 1=paid primary, 2=paid secondary, 3=paid tertiary, 4=denied, 22=reversal */
  status_code: number;
  charge_amount: DecimalString;
  paid_amount: DecimalString;
  patient_responsibility: DecimalString;
  payer_claim_number: string | null;
  /** Claim-level CAS */
  adjustments: Adjustment[];
  /** Claim-level RARCs */
  remark_codes: string[];
  service_lines: ServiceLinePayment[];
}

export interface ERA835 {
  payer_name: string;
  payer_id: string | null;
  payee_name: string | null;
  payee_npi: string | null;
  payment_amount: DecimalString;
  /** BPR04, e.g. ACH, CHK, NON */
  payment_method: string;
  /** CCYYMMDD */
  payment_date: string;
  trace_number: string | null;
  claims: ClaimPayment[];
}

/** Deterministic classification of one denied claim payment. */
export interface DenialAnalysis {
  claim_id: string;
  category: DenialCategory;
  carc_code: string;
  carc_description: string;
  rarc_codes: string[];
  rarc_descriptions: Record<string, string>;
  denied_amount: DecimalString;
  is_appealable: boolean;
  notes: string;
}
