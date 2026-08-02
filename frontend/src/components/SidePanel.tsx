import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

import { classNames } from "../lib/format";

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  width?: number;
}

/** Slide-over panel for detail views. Escape closes; backdrop click closes. */
export function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 560,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={classNames(
          "fixed inset-0 z-30 bg-ink/20 transition-opacity duration-150",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        role="dialog"
        aria-modal="true"
        style={{ width, maxWidth: "90vw" }}
        className={classNames(
          "fixed inset-y-0 right-0 z-40 flex flex-col border-l border-gray-200 bg-white transition-transform duration-150",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-4">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-ink">{title}</div>
            {subtitle && (
              <div className="truncate text-xs text-gray-500">{subtitle}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="rounded-sm p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </>
  );
}
