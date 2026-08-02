/** Mirrors src/rcm/models/encounter.py — ClinicalEncounter. */

import type { ISODate } from "./common";

export interface ClinicalEncounter {
  encounter_id: string;
  service_date: ISODate;
  chief_complaint: string;
  /** History of present illness narrative */
  hpi: string;
  /** Free-text diagnosis statements */
  diagnoses: string[];
  /** Free-text procedure/service statements (may be empty if the Plan section was missing) */
  procedures: string[];
  provider_npi: string;
  provider_name: string;
  place_of_service: string;
  /** Extraction confidence per field, 0.0-1.0 */
  field_confidence: Record<string, number>;
  extraction_warnings: string[];
}
