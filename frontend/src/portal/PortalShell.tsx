import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowLeft,
  Building2,
  FileWarning,
  Gavel,
  Inbox,
  Landmark,
  ListChecks,
  PlugZap,
  Receipt,
  ScrollText,
  UserRound,
} from "lucide-react";

import { usePractices } from "../api/queries";
import { SideNav, type NavItem } from "../components/SideNav";
import {
  clearIdentity,
  IdentityContext,
  loadIdentity,
  OPS_IDENTITIES,
  PAYER_IDENTITIES,
  PAYER_SIMULATOR_NOTE,
  PORTALS,
  saveIdentity,
  setActiveSession,
  type DemoIdentity,
  type PortalId,
} from "../lib/identity";
import { InfoTip } from "../components/InfoTip";

const NAV: Record<PortalId, NavItem[]> = {
  practice: [
    { to: "/practice", label: "Dashboard", icon: Activity, end: true },
    { to: "/practice/claims", label: "Claims", icon: ListChecks },
    { to: "/practice/integration", label: "Integration", icon: PlugZap },
  ],
  ops: [
    { to: "/ops/queue", label: "Review Queue", icon: Inbox },
    { to: "/ops/appeals", label: "Appeals Workbench", icon: Gavel },
    { to: "/ops/denials", label: "Denials & Appeals", icon: FileWarning },
    { to: "/ops/remittances", label: "Remittances", icon: Receipt },
    { to: "/ops/clients", label: "Clients", icon: Building2 },
    { to: "/ops/audit", label: "Audit Log", icon: ScrollText },
    { to: "/ops/dashboard", label: "Dashboard", icon: Activity },
  ],
  payer: [
    { to: "/payer", label: "Appeals Inbox", icon: Inbox, end: true },
    { to: "/payer/remittances", label: "Remittances", icon: Receipt },
  ],
};

/**
 * Portal wrapper: gates children behind a demo identity (localStorage) and
 * renders the portal chrome (SideNav + identity context for TopBar).
 * Deep links without an identity land on the entry screen for that portal.
 */
export function PortalShell({ portal }: { portal: PortalId }) {
  const [identity, setIdentityState] = useState<DemoIdentity | null>(() =>
    loadIdentity(portal),
  );

  // Mirror the mounted session for audit-log actor attribution (fetch headers).
  useEffect(() => {
    setActiveSession(identity ? { portal, identity } : null);
    return () => setActiveSession(null);
  }, [portal, identity]);

  if (!identity) {
    return (
      <PortalEntry
        portal={portal}
        onSelect={(i) => {
          saveIdentity(portal, i);
          setIdentityState(i);
        }}
      />
    );
  }

  return (
    <IdentityContext.Provider
      value={{
        portal,
        identity,
        signOut: () => {
          clearIdentity(portal);
          setIdentityState(null);
        },
      }}
    >
      <div className="flex h-screen overflow-hidden bg-surface text-sm text-ink">
        <SideNav portalLabel={PORTALS[portal].label} items={NAV[portal]} />
        <main className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </main>
      </div>
    </IdentityContext.Provider>
  );
}

// ------------------------------------------------------------ entry gate

const PORTAL_ICONS: Record<PortalId, LucideIcon> = {
  practice: Building2,
  ops: Gavel,
  payer: Landmark,
};

function PortalEntry({
  portal,
  onSelect,
}: {
  portal: PortalId;
  onSelect: (identity: DemoIdentity) => void;
}) {
  const meta = PORTALS[portal];
  const Icon = PORTAL_ICONS[portal];

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-xs text-gray-500 transition-colors hover:text-ink"
        >
          <ArrowLeft size={13} /> Back to ClaimMate site
        </Link>
        <div className="border border-gray-200 bg-surface p-6">
          <div className="mb-1 flex items-center gap-2">
            <Icon size={16} className="text-gray-500" />
            <h1 className="text-md font-semibold text-ink">{meta.label}</h1>
            {portal === "payer" && <InfoTip text={PAYER_SIMULATOR_NOTE} />}
          </div>
          <p className="mb-4 text-sm text-gray-500">{meta.tagline}</p>
          <div className="mb-3 border-l-2 border-severity-warning bg-amber-50/60 px-3 py-2 text-xs text-gray-600">
            Demo access — no real authentication. Choose a seeded identity to
            continue; your choice is stored locally in this browser only.
          </div>
          <IdentityOptions portal={portal} onSelect={onSelect} />
          {portal === "practice" && (
            <p className="mt-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
              New practice?{" "}
              <Link
                to="/practice/signup"
                className="font-medium text-primary hover:underline"
              >
                Start onboarding
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function IdentityOptions({
  portal,
  onSelect,
}: {
  portal: PortalId;
  onSelect: (identity: DemoIdentity) => void;
}) {
  const practicesQuery = usePractices();

  if (portal === "ops") {
    return <OptionList options={OPS_IDENTITIES} icon={UserRound} onSelect={onSelect} />;
  }
  if (portal === "payer") {
    return <OptionList options={PAYER_IDENTITIES} icon={Landmark} onSelect={onSelect} />;
  }

  // Practice portal: identities come from onboarded practices (incl. wizard
  // submissions from this session).
  if (practicesQuery.isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100" />
        ))}
      </div>
    );
  }
  if (practicesQuery.isError || !practicesQuery.data) {
    return (
      <div className="text-sm text-severity-error">
        Failed to load practices: {practicesQuery.error?.message}
      </div>
    );
  }
  const options: DemoIdentity[] = practicesQuery.data.map((p) => ({
    id: `practice-${p.practice_id}`,
    name: p.legal_name,
    role: `${p.specialty} · ${p.state}`,
    practice_id: p.practice_id,
  }));
  return <OptionList options={options} icon={Building2} onSelect={onSelect} />;
}

function OptionList({
  options,
  icon: Icon,
  onSelect,
}: {
  options: DemoIdentity[];
  icon: LucideIcon;
  onSelect: (identity: DemoIdentity) => void;
}) {
  return (
    <div className="max-h-80 space-y-1.5 overflow-y-auto">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onSelect(o)}
          className="flex w-full items-center gap-3 rounded border border-gray-200 px-3 py-2.5 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
        >
          <Icon size={15} className="shrink-0 text-gray-400" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">
              {o.name}
            </span>
            <span className="block truncate text-xs text-gray-500">{o.role}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
