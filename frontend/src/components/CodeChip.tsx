import { useState } from "react";
import { Check } from "lucide-react";

import { classNames } from "../lib/format";

interface Props {
  code: string;
  title?: string;
  className?: string;
}

/** Mono code chip (ICD-10 / CPT / CARC / RARC / NPI). Click to copy. */
export function CodeChip({ code, title, className }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={title ?? `Copy ${code}`}
      className={classNames(
        "inline-flex h-5 items-center gap-1 rounded-sm border border-gray-200 bg-gray-50 px-1.5 font-mono text-xs text-gray-900 transition-colors hover:border-gray-300 hover:bg-gray-100",
        className,
      )}
    >
      {code}
      {copied && <Check size={11} className="text-severity-pass" aria-label="Copied" />}
    </button>
  );
}
