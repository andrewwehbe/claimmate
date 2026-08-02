/** Mirrors src/rcm/models/edi.py — BillingProvider, InterchangeConfig, EDI837P. */

import type { CodedClaim } from "./claim";

export interface BillingProvider {
  organization_name: string;
  npi: string;
  /** EIN, digits only */
  tax_id: string;
  address_line1: string;
  city: string;
  state: string;
  zip_code: string;
  contact_name: string;
  contact_phone: string;
}

export interface InterchangeConfig {
  sender_id: string;
  receiver_id: string;
  receiver_name: string;
  interchange_control_number: number;
  group_control_number: number;
  transaction_control_number: string;
  date_yyyymmdd: string;
  time_hhmm: string;
  usage_indicator: "T" | "P";
}

/** Complete, validated input for rendering one professional claim to X12 837P. */
export interface EDI837P {
  interchange: InterchangeConfig;
  billing_provider: BillingProvider;
  claim: CodedClaim;
}
