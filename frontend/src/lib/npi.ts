/**
 * NPI validation — TS port of src/rcm/models/validators.py is_valid_npi.
 *
 * An NPI is 10 digits. The check digit (10th) is computed with the Luhn
 * algorithm over the constant prefix "80840" + the first 9 digits.
 */

export function isValidNpi(npi: string): boolean {
  if (!/^\d{10}$/.test(npi)) return false;
  return npiCheckDigit(npi.slice(0, 9)) === Number(npi[9]);
}

/** Luhn check digit for "80840" + the given 9-digit prefix. */
export function npiCheckDigit(first9: string): number {
  const digits = ("80840" + first9).split("").map(Number);
  let sum = 0;
  let double = true; // rightmost digit position gets doubled
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i];
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return (10 - (sum % 10)) % 10;
}
