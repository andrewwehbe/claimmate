import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Activity,
  FileWarning,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { classNames } from "../lib/format";

const NAV_ITEMS = [
  { to: "/queue", label: "Review Queue", icon: Inbox },
  { to: "/denials", label: "Denials & Appeals", icon: FileWarning },
  { to: "/dashboard", label: "Dashboard", icon: Activity },
];

/** Collapsible left navigation: icons + labels, near-black surface. */
export function SideNav() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <nav
      className={classNames(
        "flex shrink-0 flex-col border-r border-gray-200 bg-gray-50 transition-[width] duration-150",
        collapsed ? "w-12" : "w-52",
      )}
    >
      <div
        className={classNames(
          "flex h-12 items-center border-b border-gray-200",
          collapsed ? "justify-center" : "gap-2 px-4",
        )}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-ink font-mono text-xs font-semibold text-white">
          R
        </span>
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight text-ink">
            RCM Console
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
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
