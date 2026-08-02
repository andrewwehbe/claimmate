/**
 * MSW request handlers backing the app with an in-memory store.
 * Approve / reject / code edits mutate the store so the UI behaves like a
 * real backend within a session.
 */

import { delay, http, HttpResponse } from "msw";

import type {
  AppealCase,
  AppealsKpis,
  AppealsResponse,
  AppealView,
  AuditEvent,
  ClaimDetailView,
  DashboardMetrics,
  DenialRecordView,
  PayerDecisionAction,
  PracticeAccount,
  PracticeOverview,
  PracticeSignupBody,
  QueueItemView,
  RemittanceRow,
  ReviewStatus,
  SyncRun,
  UpdateCodesBody,
} from "../types";
import {
  APPEAL_LEVEL_LONG,
  deadlineDays,
  NEXT_LEVEL,
  SUBMISSION_CHANNEL_LABELS,
} from "../lib/appealRules";
import {
  CLAIM_SEEDS,
  DASHBOARD_SEED,
  DENIAL_SEEDS,
  generateAppealLetter,
} from "./seed";
import {
  APPEAL_SEEDS,
  buildAuditSeeds,
  buildRemittanceSeeds,
  PRACTICE_SEEDS,
  practiceClaims,
  remittanceFromAppeal,
  SYNC_RUN_SEEDS,
} from "./seedPortal";

// ------------------------------------------------------------- store

interface Store {
  queue: QueueItemView[];
  claims: Map<string, ClaimDetailView>;
  denials: Record<string, DenialRecordView>;
  appealVersions: Record<string, number>;
  practices: PracticeAccount[];
  syncRuns: SyncRun[];
  appealCases: AppealCase[];
  remittances: RemittanceRow[];
  /** Append-only: rows are only ever pushed, never edited or removed. */
  audit: AuditEvent[];
}

const store: Store = {
  queue: CLAIM_SEEDS.filter((s) => s.queue !== null).map((s) => ({
    ...(s.queue as QueueItemView),
  })),
  claims: new Map(
    CLAIM_SEEDS.map((s) => [s.detail.claim.claim_id, structuredClone(s.detail)]),
  ),
  denials: structuredClone(DENIAL_SEEDS),
  appealVersions: {},
  practices: structuredClone(PRACTICE_SEEDS),
  syncRuns: structuredClone(SYNC_RUN_SEEDS),
  appealCases: structuredClone(APPEAL_SEEDS),
  remittances: buildRemittanceSeeds(APPEAL_SEEDS),
  audit: buildAuditSeeds(),
};

let auditCounter = store.audit.length;

/** Append an audit event, attributing the acting demo identity from headers. */
function audit(
  request: Request,
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
  actorOverride?: string,
): void {
  store.audit.push({
    id: `AUD-${String(++auditCounter).padStart(4, "0")}`,
    timestamp: new Date().toISOString(),
    actor:
      actorOverride ??
      request.headers.get("x-demo-actor") ??
      "Unknown · Demo session",
    portal: request.headers.get("x-demo-portal") ?? "unknown",
    action,
    entity_type: entityType,
    entity_id: entityId,
    summary,
  });
}

const DAY = 86_400_000;

function computeAppealsKpis(appeals: AppealCase[]): AppealsKpis {
  const decided = appeals.filter(
    (a) => a.decided_at !== null && a.submitted_at !== null,
  );
  const overturned = decided.filter((a) => a.status === "overturned");
  const avgDays =
    decided.length === 0
      ? 0
      : decided.reduce(
          (s, a) =>
            s +
            (new Date(a.decided_at!).getTime() -
              new Date(a.submitted_at!).getTime()) /
              DAY,
          0,
        ) / decided.length;
  const recovered = overturned.reduce(
    (s, a) => s + Number(a.denied_amount),
    0,
  );
  const fte = 0.35;
  return {
    avg_turnaround_days: Math.round(avgDays * 10) / 10,
    manual_baseline_days: 14,
    overturn_rate: decided.length === 0 ? 0 : overturned.length / decided.length,
    decided_count: decided.length,
    recovered_total: recovered.toFixed(2),
    fte_equivalent: fte,
    recovered_per_fte: (recovered / fte).toFixed(2),
  };
}

function setReviewStatus(claimId: string, status: ReviewStatus) {
  const detail = store.claims.get(claimId);
  if (detail) detail.review_status = status;
  const row = store.queue.find((q) => q.claim_id === claimId);
  if (row) row.review_status = status;
}

const LATENCY = 250;

// ----------------------------------------------------------- handlers

export const handlers = [
  http.get("/api/queue", async () => {
    await delay(LATENCY);
    return HttpResponse.json(store.queue);
  }),

  http.get("/api/claims/:id", async ({ params }) => {
    await delay(LATENCY);
    const detail = store.claims.get(String(params.id));
    if (!detail) {
      return HttpResponse.json({ detail: "claim not found" }, { status: 404 });
    }
    return HttpResponse.json(detail);
  }),

  http.post("/api/claims/:id/approve", async ({ params, request }) => {
    await delay(LATENCY);
    const id = String(params.id);
    const detail = store.claims.get(id);
    if (!detail) {
      return HttpResponse.json({ detail: "claim not found" }, { status: 404 });
    }
    setReviewStatus(id, "approved");
    // Approval (re)submits: generated / clearinghouse_rejected -> clearinghouse.
    const fromStatus = detail.lifecycle_status;
    if (
      fromStatus === "generated" ||
      fromStatus === "clearinghouse_rejected"
    ) {
      detail.lifecycle_status = "submitted_to_clearinghouse";
      detail.clearinghouse_rejection = null;
    }
    audit(
      request,
      "claim.approve",
      "claim",
      id,
      `pending -> approved (${fromStatus} -> ${detail.lifecycle_status})`,
    );
    return HttpResponse.json({ claim_id: id, review_status: "approved" });
  }),

  http.post("/api/claims/:id/reject", async ({ params, request }) => {
    await delay(LATENCY);
    const id = String(params.id);
    if (!store.claims.has(id)) {
      return HttpResponse.json({ detail: "claim not found" }, { status: 404 });
    }
    setReviewStatus(id, "rejected");
    audit(request, "claim.reject", "claim", id, "pending -> rejected");
    return HttpResponse.json({ claim_id: id, review_status: "rejected" });
  }),

  http.post("/api/claims/:id/codes", async ({ params, request }) => {
    await delay(LATENCY);
    const id = String(params.id);
    const detail = store.claims.get(id);
    if (!detail) {
      return HttpResponse.json({ detail: "claim not found" }, { status: 404 });
    }
    const body = (await request.json()) as UpdateCodesBody;
    const before = detail.claim.procedures.map((p) => p.code).join(",");
    detail.claim.diagnoses = body.diagnoses;
    detail.claim.procedures = body.procedures;
    const after = body.procedures.map((p) => p.code).join(",");
    const row = store.queue.find((q) => q.claim_id === id);
    if (row) {
      const total = body.procedures.reduce((s, p) => s + Number(p.charge), 0);
      row.claim_value = total.toFixed(2);
    }
    audit(request, "claim.codes_edit", "claim", id, `${before} -> ${after}`);
    return HttpResponse.json(detail);
  }),

  http.get("/api/denials", async () => {
    await delay(LATENCY);
    return HttpResponse.json(Object.values(store.denials));
  }),

  http.get("/api/denials/:id/appeal", async ({ params }) => {
    await delay(LATENCY);
    const id = String(params.id);
    const rec = store.denials[id];
    if (!rec) {
      return HttpResponse.json({ detail: "denial not found" }, { status: 404 });
    }
    if (!rec.analysis.is_appealable) {
      return HttpResponse.json(
        { detail: "denial is not appealable" },
        { status: 409 },
      );
    }
    const version = store.appealVersions[id] ?? 1;
    store.appealVersions[id] = version;
    const letter = generateAppealLetter(id, version);
    const view: AppealView = {
      letter: letter!,
      appeal_status: rec.appeal_status === "none" ? "draft" : rec.appeal_status,
    };
    if (rec.appeal_status === "none") rec.appeal_status = "draft";
    return HttpResponse.json(view);
  }),

  http.post("/api/denials/:id/appeal/regenerate", async ({ params }) => {
    await delay(600); // "LLM" latency
    const id = String(params.id);
    const rec = store.denials[id];
    if (!rec || !rec.analysis.is_appealable) {
      return HttpResponse.json(
        { detail: "denial not found or not appealable" },
        { status: 404 },
      );
    }
    const version = (store.appealVersions[id] ?? 1) + 1;
    store.appealVersions[id] = version;
    const letter = generateAppealLetter(id, version);
    if (rec.appeal_status === "none") rec.appeal_status = "draft";
    const view: AppealView = {
      letter: letter!,
      appeal_status: rec.appeal_status,
    };
    return HttpResponse.json(view);
  }),

  // ------------------------------------------------- practices (portal)

  http.get("/api/practices", async () => {
    await delay(LATENCY);
    return HttpResponse.json(store.practices);
  }),

  http.post("/api/practices/signup", async ({ request }) => {
    await delay(400);
    const body = (await request.json()) as PracticeSignupBody;
    const n = store.practices.length + 1;
    const account: PracticeAccount = {
      practice_id: `PRAC-${String(n).padStart(3, "0")}`,
      legal_name: body.legal_name,
      specialty: body.specialty,
      providers_count: body.providers_count,
      state: body.state,
      group_npi: body.group_npi,
      ehr_system: body.ehr_system,
      integration_method: body.integration_method,
      integration_status: "pending",
      plan: body.plan,
      contact_name: body.contact_name,
      contact_email: body.contact_email,
      created_at: new Date().toISOString(),
      last_sync_at: null,
      claims_per_month: 0,
      denial_rate: 0,
      recovered_this_quarter: "0.00",
    };
    store.practices.push(account);
    audit(
      request,
      "practice.signup",
      "practice",
      account.practice_id,
      `none -> account created (${account.legal_name}, pending integration)`,
      `${account.contact_name} · Practice signup`,
    );
    return HttpResponse.json(account, { status: 201 });
  }),

  http.get("/api/practices/:id/overview", async ({ params }) => {
    await delay(LATENCY);
    const id = String(params.id);
    const account = store.practices.find((p) => p.practice_id === id);
    if (!account) {
      return HttpResponse.json({ detail: "practice not found" }, { status: 404 });
    }
    const runs = store.syncRuns
      .filter((r) => r.practice_id === id)
      .sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
    const recovered = store.appealCases
      .filter((a) => a.practice_id === id && a.status === "overturned")
      .map((a) => ({
        appeal_id: a.appeal_id,
        claim_id: a.claim_id,
        carc_code: a.carc_code,
        payer_name: a.payer_name,
        recovered_amount: a.denied_amount,
        decided_at: a.decided_at!,
      }));
    const posted = store.remittances
      .filter((r) => r.practice_id === id && r.posted)
      .reduce((s, r) => s + Number(r.payment_amount), 0);
    const overview: PracticeOverview = {
      account,
      last_sync: runs[0] ?? null,
      claims_this_month: account.claims_per_month,
      denial_rate: account.denial_rate,
      recovered_this_quarter: recovered
        .reduce((s, r) => s + Number(r.recovered_amount), 0)
        .toFixed(2),
      posted_to_ledger: posted.toFixed(2),
      recovered_denials: recovered,
    };
    return HttpResponse.json(overview);
  }),

  http.get("/api/practices/:id/syncs", async ({ params }) => {
    await delay(LATENCY);
    const runs = store.syncRuns
      .filter((r) => r.practice_id === String(params.id))
      .sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
    return HttpResponse.json(runs);
  }),

  http.post("/api/practices/:id/syncs/run", async ({ params, request }) => {
    await delay(900); // simulated sync run
    const id = String(params.id);
    const account = store.practices.find((p) => p.practice_id === id);
    if (!account) {
      return HttpResponse.json({ detail: "practice not found" }, { status: 404 });
    }
    const healthy = account.integration_status === "connected";
    const run: SyncRun = {
      run_id: `SYNC-${id.slice(-3)}-${String(
        store.syncRuns.filter((r) => r.practice_id === id).length + 1,
      ).padStart(3, "0")}`,
      practice_id: id,
      started_at: new Date(Date.now() - 60_000).toISOString(),
      finished_at: new Date().toISOString(),
      status: healthy ? "success" : account.integration_status === "error" ? "failed" : "partial",
      rows_imported: healthy ? 143 : account.integration_status === "error" ? 0 : 88,
      rows_failed: healthy ? 0 : account.integration_status === "error" ? 0 : 12,
      error_message:
        account.integration_status === "error"
          ? "Connection failed: credentials rejected by practice server."
          : account.integration_status === "degraded"
            ? "12 rows rejected: malformed service-date format."
            : null,
    };
    store.syncRuns.push(run);
    if (run.status !== "failed") account.last_sync_at = run.finished_at;
    audit(
      request,
      "sync.rerun",
      "practice",
      id,
      `sync requested -> ${run.status} (${run.rows_imported} imported, ${run.rows_failed} failed)`,
    );
    return HttpResponse.json(run, { status: 201 });
  }),

  http.get("/api/practices/:id/claims", async ({ params }) => {
    await delay(LATENCY);
    const id = String(params.id);
    const account = store.practices.find((p) => p.practice_id === id);
    if (!account) {
      return HttpResponse.json({ detail: "practice not found" }, { status: 404 });
    }
    // Pending integrations have no imported claims yet.
    const rows = account.integration_status === "pending" ? [] : practiceClaims(id);
    return HttpResponse.json(rows);
  }),

  // -------------------------------------------------- appeals workbench

  http.get("/api/appeals", async () => {
    await delay(LATENCY);
    const response: AppealsResponse = {
      kpis: computeAppealsKpis(store.appealCases),
      appeals: store.appealCases,
    };
    return HttpResponse.json(response);
  }),

  http.post("/api/appeals/:id/decision", async ({ params, request }) => {
    await delay(350);
    const id = String(params.id);
    const appeal = store.appealCases.find((a) => a.appeal_id === id);
    if (!appeal) {
      return HttpResponse.json({ detail: "appeal not found" }, { status: 404 });
    }
    if (appeal.status === "overturned" || appeal.status === "upheld") {
      return HttpResponse.json(
        { detail: "appeal already decided" },
        { status: 409 },
      );
    }
    const { action } = (await request.json()) as { action: PayerDecisionAction };
    const now = new Date().toISOString();
    const fromStatus = appeal.status;
    if (action === "overturn" || action === "uphold") {
      appeal.status = action === "overturn" ? "overturned" : "upheld";
      appeal.decided_at = now;
      appeal.payer_response =
        action === "overturn"
          ? "Determination reversed on appeal. Payment to follow on next remittance cycle."
          : "Original determination upheld. Denial reasons stand as issued.";
      appeal.events.push({
        at: now,
        label: action === "overturn" ? "Overturned" : "Upheld",
        detail: appeal.payer_response,
      });
      if (action === "overturn") {
        // Overturn generates a remittance; it lands in ops Unposted.
        store.remittances.unshift(
          remittanceFromAppeal(appeal, {
            posted: false,
            methodSeed: store.remittances.length,
          }),
        );
      }
      audit(
        request,
        action === "overturn" ? "payer.overturn" : "payer.uphold",
        "appeal",
        appeal.appeal_id,
        `${fromStatus} -> ${appeal.status}` +
          (action === "overturn" ? ` ($${appeal.denied_amount})` : ""),
      );
    } else {
      appeal.status = "payer_responded";
      appeal.payer_response =
        "Additional medical records requested before reconsideration.";
      appeal.events.push({
        at: now,
        label: "Payer responded",
        detail: appeal.payer_response,
      });
      audit(
        request,
        "payer.request_records",
        "appeal",
        appeal.appeal_id,
        `${fromStatus} -> payer_responded (records requested)`,
      );
    }
    return HttpResponse.json(appeal);
  }),

  http.post("/api/appeals/:id/escalate", async ({ params, request }) => {
    await delay(350);
    const id = String(params.id);
    const appeal = store.appealCases.find((a) => a.appeal_id === id);
    if (!appeal) {
      return HttpResponse.json({ detail: "appeal not found" }, { status: 404 });
    }
    if (appeal.status !== "upheld") {
      return HttpResponse.json(
        { detail: "only upheld appeals can be escalated" },
        { status: 409 },
      );
    }
    if (appeal.successor_id) {
      return HttpResponse.json(
        { detail: "appeal already escalated" },
        { status: 409 },
      );
    }
    const nextLevel = NEXT_LEVEL[appeal.level];
    if (!nextLevel) {
      return HttpResponse.json(
        { detail: "external review is terminal; no further escalation" },
        { status: 409 },
      );
    }
    const now = new Date().toISOString();
    const upheldAt = appeal.decided_at ?? now;
    const windowDays = deadlineDays(nextLevel, appeal.payer_name);
    const deadline = new Date(
      new Date(upheldAt).getTime() + windowDays * DAY,
    )
      .toISOString()
      .slice(0, 10);
    const n = store.appealCases.length + 1;
    const successorId = `APL-${String(n).padStart(4, "0")}`;
    const successor: AppealCase = {
      ...structuredClone(appeal),
      appeal_id: successorId,
      status: "drafting",
      level: nextLevel,
      opened_at: upheldAt,
      submitted_at: null,
      decided_at: null,
      // Fresh window runs from the uphold date at the next level's rule.
      appeal_deadline: deadline,
      predecessor_id: appeal.appeal_id,
      successor_id: null,
      payer_response: null,
      letter_subject: `${APPEAL_LEVEL_LONG[nextLevel]} — claim ${appeal.claim_id} (CARC ${appeal.carc_code})`,
      events: [
        {
          at: now,
          label: `Created from upheld ${APPEAL_LEVEL_LONG[appeal.level].toLowerCase()} ${appeal.appeal_id}`,
          detail: `Escalated after uphold. ${APPEAL_LEVEL_LONG[nextLevel]} filing window: ${windowDays} days from uphold (deadline ${deadline}).`,
        },
      ],
    };
    appeal.successor_id = successorId;
    appeal.events.push({
      at: now,
      label: `Escalated to ${APPEAL_LEVEL_LONG[nextLevel]} ${successorId}`,
      detail: `Successor case opened in drafting via ${SUBMISSION_CHANNEL_LABELS[successor.submission_channel]}.`,
    });
    store.appealCases.push(successor);
    audit(
      request,
      "appeal.escalate",
      "appeal",
      appeal.appeal_id,
      `upheld ${APPEAL_LEVEL_LONG[appeal.level]} -> ${APPEAL_LEVEL_LONG[nextLevel]} ${successorId} (drafting)`,
    );
    return HttpResponse.json(successor, { status: 201 });
  }),

  // ---------------------------------------------------------- payer data

  http.get("/api/payer/remittances", async ({ request }) => {
    await delay(LATENCY);
    const payer = new URL(request.url).searchParams.get("payer");
    let rows = [...store.remittances];
    if (payer) rows = rows.filter((r) => r.payer_name === payer);
    rows.sort((a, b) => (a.payment_date < b.payment_date ? 1 : -1));
    return HttpResponse.json(rows);
  }),

  // -------------------------------------------- ops remittances + posting

  http.get("/api/remittances", async () => {
    await delay(LATENCY);
    const rows = [...store.remittances].sort((a, b) =>
      a.payment_date < b.payment_date ? 1 : -1,
    );
    return HttpResponse.json(rows);
  }),

  http.post("/api/remittances/:id/post", async ({ params, request }) => {
    await delay(300);
    const id = String(params.id);
    const row = store.remittances.find((r) => r.remit_id === id);
    if (!row) {
      return HttpResponse.json(
        { detail: "remittance not found" },
        { status: 404 },
      );
    }
    if (row.posted) {
      return HttpResponse.json(
        { detail: "remittance already posted; posting is one-way" },
        { status: 409 },
      );
    }
    row.posted = true;
    audit(
      request,
      "remittance.post",
      "remittance",
      row.remit_id,
      `unposted -> posted ($${row.payment_amount})`,
    );
    return HttpResponse.json(row);
  }),

  // ------------------------------------------------- audit (append-only)

  http.get("/api/audit", async () => {
    await delay(LATENCY);
    const rows = [...store.audit].sort((a, b) =>
      a.timestamp < b.timestamp ? 1 : -1,
    );
    return HttpResponse.json(rows);
  }),

  http.get("/api/dashboard", async () => {
    await delay(LATENCY);
    const queueValue = store.queue
      .filter((q) => q.review_status === "pending")
      .reduce((s, q) => s + Number(q.claim_value), 0);
    const metrics: DashboardMetrics = {
      ...DASHBOARD_SEED,
      hitl_queue_value: queueValue.toFixed(2),
    };
    return HttpResponse.json(metrics);
  }),
];
