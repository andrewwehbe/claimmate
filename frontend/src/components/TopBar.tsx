import type { ReactNode } from "react";

interface Props {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}

export function TopBar({ title, meta, actions }: Props) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-md font-semibold text-ink">{title}</h1>
        {meta && <div className="text-xs text-gray-500">{meta}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
