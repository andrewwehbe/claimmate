/**
 * Shared scalar aliases for values crossing the JSON boundary.
 *
 * Pydantic v2 serializes `Decimal` fields as JSON strings (e.g. "125.00")
 * and `date` fields as ISO strings ("2026-07-14"). Mirror that here so the
 * TS types match the wire format of the backend models exactly.
 */

/** Decimal serialized by Pydantic as a string, e.g. "1250.00". */
export type DecimalString = string;

/** ISO-8601 date, e.g. "2026-07-14". */
export type ISODate = string;

/** ISO-8601 datetime, e.g. "2026-07-14T09:30:00Z". */
export type ISODateTime = string;
