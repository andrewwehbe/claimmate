/** Mirrors src/rcm/models/patient.py — PatientDemographics. */

import type { ISODate } from "./common";

export type Gender = "M" | "F" | "U";

export interface PatientDemographics {
  first_name: string;
  last_name: string;
  date_of_birth: ISODate;
  gender: Gender;
  /** Payer member/subscriber ID */
  member_id: string;
  group_number: string | null;
  payer_name: string;
  /** Payer EDI ID */
  payer_id: string;
  address_line1: string;
  city: string;
  /** Two-letter state code */
  state: string;
  zip_code: string;
}
