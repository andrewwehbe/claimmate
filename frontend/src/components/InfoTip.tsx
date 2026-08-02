import { Info } from "lucide-react";

import { classNames } from "../lib/format";

interface Props {
  text: string;
  className?: string;
}

/** Small info icon with a native tooltip. Quiet, not decorative. */
export function InfoTip({ text, className }: Props) {
  return (
    <span
      title={text}
      className={classNames(
        "inline-flex cursor-help items-center text-gray-400 hover:text-gray-600",
        className,
      )}
    >
      <Info size={13} aria-label={text} />
    </span>
  );
}
