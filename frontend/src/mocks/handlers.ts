/**
 * MSW request handlers backing the app with an in-memory store.
 * Approve / reject / code edits mutate the store so the UI behaves like a
 * real backend within a session.
 */

import { delay, http, HttpResponse } from "msw";

import type {
  AppealView,
  ClaimDetailView,
  DashboardMetrics,
  DenialRecordView,
  QueueItemView,
  ReviewStatus,
  UpdateCodesBody,
} from "../types";
import {
  CLAIM_SEEDS,
  DASHBOARD_SEED,
  DENIAL_SEEDS,
  generateAppealLetter,
} from "./seed";

// ------------------------------------------------------------- store

interface Store {
  queue: QueueItemView[];
  claims: Map<string, ClaimDetailView>;
  denials: Record<string, DenialRecordView>;
  appealVersions: Record<string, number>;
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
};

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

  http.post("/api/claims/:id/approve", async ({ params }) => {
    await delay(LATENCY);
    const id = String(params.id);
    if (!store.claims.has(id)) {
      return HttpResponse.json({ detail: "claim not found" }, { status: 404 });
    }
    setReviewStatus(id, "approved");
    return HttpResponse.json({ claim_id: id, review_status: "approved" });
  }),

  http.post("/api/claims/:id/reject", async ({ params }) => {
    await delay(LATENCY);
    const id = String(params.id);
    if (!store.claims.has(id)) {
      return HttpResponse.json({ detail: "claim not found" }, { status: 404 });
    }
    setReviewStatus(id, "rejected");
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
    detail.claim.diagnoses = body.diagnoses;
    detail.claim.procedures = body.procedures;
    const row = store.queue.find((q) => q.claim_id === id);
    if (row) {
      const total = body.procedures.reduce((s, p) => s + Number(p.charge), 0);
      row.claim_value = total.toFixed(2);
    }
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
