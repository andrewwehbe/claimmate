import { classNames } from "../lib/format";

export type BadgeTone =
  | "neutral"
  | "blue"
  | "green"
  | "amber"
  | "red";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-gray-200 bg-gray-50 text-gray-600",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  green: "border-green-200 bg-green-50 text-green-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-red-200 bg-red-50 text-red-700",
};

interface Props {
  label: string;
  tone?: BadgeTone;
  title?: string;
  className?: string;
}

/** Small bordered badge, 4px radius, quiet tinted background. */
export function StatusBadge({ label, tone = "neutral", title, className }: Props) {
  return (
    <span
      title={title}
      className={classNames(
        "inline-flex h-5 items-center whitespace-nowrap rounded-sm border px-1.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
