/** Mirrors src/rcm/models/appeal.py — Citation, DisputedService, AppealContext, AppealLetter. */

import type { DecimalString } from "./common";
import type { DenialCategory } from "./era";

export interface Citation {
  /** e.g. "Social Security Act" */
  source: string;
  /** e.g. "SSA 1862(a)(1)(A)" */
  reference: string;
  summary: string;
}

export interface DisputedService {
  procedure_code: string;
  description: string;
  charge_amount: DecimalString;
}

/** Structured, deterministic input handed to the LLM for letter drafting. */
export interface AppealContext {
  claim_id: string;
  payer_name: string;
  denial_category: DenialCategory;
  carc_code: string;
  carc_description: string;
  rarc_codes: string[];
  rarc_descriptions: Record<string, string>;
  clinical_summary: string;
  disputed_services: DisputedService[];
  denied_amount: DecimalString;
  /** Loaded from local reference JSON only - never LLM-generated */
  citations: Citation[];
}

export interface AppealLetter {
  claim_id: string;
  subject: string;
  body: string;
  citations: Citation[];
  /** LLM client class used for drafting */
  generated_by: string;
}
