import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, LogOut } from "lucide-react";

import { PORTALS, usePortalSession } from "../lib/identity";
import { StatusBadge } from "./StatusBadge";
import { ThemeToggle } from "./ThemeToggle";

interface Props {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}

/**
 * Screen header. Inside a portal shell it also shows the portal name, the
 * demo identity, a switch-portal link, and sign out (back to the gate).
 */
export function TopBar({ title, meta, actions }: Props) {
  const session = usePortalSession();

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-surface px-6">
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="whitespace-nowrap text-md font-semibold text-ink">
          {title}
        </h1>
        {meta && <div className="truncate text-xs text-gray-500">{meta}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <ThemeToggle />
        {session && (
          <div className="ml-2 flex items-center gap-2 border-l border-gray-200 pl-3">
            <StatusBadge label={PORTALS[session.portal].label} tone="blue" />
            <span
              className="hidden text-xs text-gray-600 lg:inline"
              title={`Demo identity: ${session.identity.name} (${session.identity.role})`}
            >
              {session.identity.name}
              <span className="text-gray-400"> · {session.identity.role}</span>
            </span>
            <Link
              to="/"
              title="Switch portal"
              className="flex h-6 items-center gap-1 rounded-sm px-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-ink"
            >
              <ArrowLeftRight size={12} />
              <span>Switch</span>
            </Link>
            <button
              type="button"
              onClick={session.signOut}
              title="Sign out of demo identity"
              className="flex h-6 items-center gap-1 rounded-sm px-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-ink"
            >
              <LogOut size={12} />
              <span className="sr-only">Sign out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
