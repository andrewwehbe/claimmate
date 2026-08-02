import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { classNames, maskName } from "../lib/format";

interface Props {
  firstName: string;
  lastName: string;
  className?: string;
}

/**
 * PHI discipline: patient names render masked ("J. D—") by default with a
 * subtle eye icon to reveal. SSNs are never rendered anywhere.
 */
export function MaskedName({ firstName, lastName, className }: Props) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span className={classNames("inline-flex items-center gap-1.5", className)}>
      <span>{revealed ? `${firstName} ${lastName}` : maskName(firstName, lastName)}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setRevealed((r) => !r);
        }}
        className="text-gray-400 transition-colors hover:text-gray-600"
        title={revealed ? "Mask patient name" : "Reveal patient name"}
        aria-label={revealed ? "Mask patient name" : "Reveal patient name"}
      >
        {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </span>
  );
}
