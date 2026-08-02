/** Formatting helpers. All dollar amounts render $X,XXX.XX in mono. */

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "1250.5" | 1250.5 -> "$1,250.50" */
export function formatMoney(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "$0.00";
  return usd.format(n);
}

/** 0.873 -> "0.87" (mono confidence display) */
export function formatConfidence(value: number): string {
  return value.toFixed(2);
}

/** 0.42 -> "42.0%" */
export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/** "J. D—" style masked patient name. */
export function maskName(first: string, last: string): string {
  const f = first.trim().charAt(0).toUpperCase();
  const l = last.trim().charAt(0).toUpperCase();
  return `${f}. ${l}—`;
}

/** ISO datetime -> compact age, e.g. "35m", "4h", "2d". */
export function ageFrom(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.floor((now.getTime() - then) / 60_000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** "2026-07-14" -> "Jul 14, 2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "20260714" (CCYYMMDD, X12 style) -> "Jul 14, 2026" */
export function formatX12Date(ccyymmdd: string): string {
  if (!/^\d{8}$/.test(ccyymmdd)) return ccyymmdd;
  return formatDate(
    `${ccyymmdd.slice(0, 4)}-${ccyymmdd.slice(4, 6)}-${ccyymmdd.slice(6, 8)}`,
  );
}

export function classNames(
  ...parts: (string | false | null | undefined)[]
): string {
  return parts.filter(Boolean).join(" ");
}
