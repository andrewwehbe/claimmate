/** Thin fetch wrapper for the JSON API (mocked by MSW in dev). */

import { getActiveSession } from "../lib/identity";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  // Demo audit-log actor attribution: identify the acting portal session.
  const session = getActiveSession();
  const actorHeaders: Record<string, string> = session
    ? {
        "x-demo-actor": `${session.identity.name} · ${session.identity.role}`,
        "x-demo-portal": session.portal,
      }
    : {};
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...actorHeaders },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}
