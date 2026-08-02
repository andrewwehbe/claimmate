/** Mirrors src/rcm/models/claim.py — CodedDiagnosis, CodedProcedure, CodedClaim. */

import type { DecimalString } from "./common";
import type { ClinicalEncounter } from "./encounter";
import type { PatientDemographics } from "./patient";

export interface CodedDiagnosis {
  /** ICD-10-CM code, e.g. E11.9 */
  code: string;
  description: string;
  confidence: number;
}

export interface CodedProcedure {
  /** CPT or HCPCS Level II code */
  code: string;
  description: string;
  modifiers: string[];
  units: number;
  /** Total line charge (fee x units) */
  charge: DecimalString;
  /** 1-based indexes into claim diagnoses */
  diagnosis_pointers: number[];
  confidence: number;
}

export interface CodedClaim {
  claim_id: string;
  patient: PatientDemographics;
  encounter: ClinicalEncounter;
  diagnoses: CodedDiagnosis[];
  procedures: CodedProcedure[];
  place_of_service: string;
  overall_confidence: number;
  /** Deterministic validation findings recorded during coding (NCCI etc.) */
  validation_flags: string[];
  prior_auth_number: string | null;
}
