/**
 * Demo-grade portal identities (mock, no real auth).
 *
 * The chosen identity per portal persists in localStorage; portal routes are
 * gated on it. This is explicitly demo access, labeled as such in the UI.
 */

import { createContext, useContext } from "react";

export type PortalId = "practice" | "ops" | "payer";

export interface DemoIdentity {
  id: string;
  name: string;
  role: string;
  /** Set for practice-portal identities. */
  practice_id?: string;
  /** Set for payer-portal identities; must match seed payer_name values. */
  payer_name?: string;
}

export const PORTALS: Record<
  PortalId,
  { label: string; base: string; tagline: string }
> = {
  practice: {
    label: "Practice Portal",
    base: "/practice",
    tagline: "For medical practices",
  },
  ops: {
    label: "Operations",
    base: "/ops",
    tagline: "RemitPath internal staff",
  },
  payer: {
    label: "Payer Portal",
    base: "/payer",
    tagline: "For insurance company reviewers",
  },
};

/** Fixed identity options for ops and payer; practice options come from the store. */
export const OPS_IDENTITIES: DemoIdentity[] = [
  { id: "ops-reyes", name: "Alex Reyes", role: "Denials Operations Lead" },
  { id: "ops-tran", name: "Mia Tran", role: "RCM Operations Analyst" },
];

export const PAYER_IDENTITIES: DemoIdentity[] = [
  {
    id: "payer-aetna",
    name: "Aetna Health Inc",
    role: "Appeals Reviewer",
    payer_name: "Aetna PPO",
  },
  {
    id: "payer-uhc",
    name: "UnitedHealthcare",
    role: "Appeals Reviewer",
    payer_name: "UnitedHealthcare",
  },
];

const key = (portal: PortalId) => `remitpath-demo-identity:${portal}`;

export function loadIdentity(portal: PortalId): DemoIdentity | null {
  try {
    const raw = localStorage.getItem(key(portal));
    return raw ? (JSON.parse(raw) as DemoIdentity) : null;
  } catch {
    return null;
  }
}

export function saveIdentity(portal: PortalId, identity: DemoIdentity): void {
  localStorage.setItem(key(portal), JSON.stringify(identity));
}

export function clearIdentity(portal: PortalId): void {
  localStorage.removeItem(key(portal));
}

// ------------------------------------------------------------- context

export interface PortalSession {
  portal: PortalId;
  identity: DemoIdentity;
  signOut: () => void;
}

export const IdentityContext = createContext<PortalSession | null>(null);

/** Null outside a portal shell (landing page, signup wizard). */
export function usePortalSession(): PortalSession | null {
  return useContext(IdentityContext);
}
