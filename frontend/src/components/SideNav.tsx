import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { House, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { classNames } from "../lib/format";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Match exactly (for index routes like /practice). */
  end?: boolean;
}

interface Props {
  portalLabel: string;
  items: NavItem[];
}

/** Collapsible left navigation: icons + labels, quiet near-white surface. */
export function SideNav({ portalLabel, items }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <nav
      className={classNames(
        "flex shrink-0 flex-col border-r border-gray-200 bg-gray-50 transition-[width] duration-150",
        collapsed ? "w-12" : "w-52",
      )}
    >
      <Link
        to="/"
        title="ClaimMate — back to site"
        className={classNames(
          "flex h-12 items-center border-b border-gray-200",
          collapsed ? "justify-center" : "px-4",
        )}
      >
        {collapsed ? (
          <House size={15} className="shrink-0 text-gray-500" />
        ) : (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-4 tracking-tight text-ink">
              ClaimMate
            </span>
            <span className="block truncate text-xs leading-4 text-gray-500">
              {portalLabel}
            </span>
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-0.5 p-2">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={label}
            className={({ isActive }) =>
              classNames(
                "flex h-8 items-center gap-2.5 rounded px-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-gray-200/70 text-ink"
                  : "text-gray-600 hover:bg-gray-100 hover:text-ink",
              )
            }
          >
            <Icon size={15} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </div>

      <div className="border-t border-gray-200 p-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
          className={classNames(
            "flex h-8 w-full items-center gap-2.5 rounded px-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-ink",
            collapsed && "justify-center px-0",
          )}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </nav>
  );
}
