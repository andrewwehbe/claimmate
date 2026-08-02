/** TanStack Query hooks — all server state lives here. */

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  AppealCase,
  AppealLetter,
  AppealsResponse,
  AppealView,
  ClaimDetailView,
  DashboardMetrics,
  DenialRecordView,
  PayerDecisionAction,
  PracticeAccount,
  PracticeClaimRow,
  PracticeOverview,
  PracticeSignupBody,
  QueueItemView,
  RemittanceRow,
  ReviewStatus,
  SyncRun,
  UpdateCodesBody,
} from "../types";
import { api } from "./client";

export const queryKeys = {
  queue: ["queue"] as const,
  claim: (id: string) => ["claims", id] as const,
  denials: ["denials"] as const,
  appeal: (id: string) => ["denials", id, "appeal"] as const,
  dashboard: ["dashboard"] as const,
  practices: ["practices"] as const,
  practiceOverview: (id: string) => ["practices", id, "overview"] as const,
  practiceSyncs: (id: string) => ["practices", id, "syncs"] as const,
  practiceClaims: (id: string) => ["practices", id, "claims"] as const,
  appeals: ["appeals"] as const,
  remittances: (payer: string | null) => ["remittances", payer] as const,
};

// ------------------------------------------------------------- queries

export function useQueue() {
  return useQuery({
    queryKey: queryKeys.queue,
    queryFn: () => api<QueueItemView[]>("/api/queue"),
  });
}

export function useClaim(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.claim(id ?? ""),
    queryFn: () => api<ClaimDetailView>(`/api/claims/${id}`),
    enabled: Boolean(id),
  });
}

export function useDenials() {
  return useQuery({
    queryKey: queryKeys.denials,
    queryFn: () => api<DenialRecordView[]>("/api/denials"),
  });
}

export function useAppeal(denialId: string | undefined, appealable: boolean) {
  return useQuery({
    queryKey: queryKeys.appeal(denialId ?? ""),
    queryFn: () => api<AppealView>(`/api/denials/${denialId}/appeal`),
    enabled: Boolean(denialId) && appealable,
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: () => api<DashboardMetrics>("/api/dashboard"),
  });
}

export function usePractices() {
  return useQuery({
    queryKey: queryKeys.practices,
    queryFn: () => api<PracticeAccount[]>("/api/practices"),
  });
}

export function usePracticeOverview(practiceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.practiceOverview(practiceId ?? ""),
    queryFn: () =>
      api<PracticeOverview>(`/api/practices/${practiceId}/overview`),
    enabled: Boolean(practiceId),
  });
}

export function usePracticeSyncs(practiceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.practiceSyncs(practiceId ?? ""),
    queryFn: () => api<SyncRun[]>(`/api/practices/${practiceId}/syncs`),
    enabled: Boolean(practiceId),
  });
}

export function usePracticeClaims(practiceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.practiceClaims(practiceId ?? ""),
    queryFn: () =>
      api<PracticeClaimRow[]>(`/api/practices/${practiceId}/claims`),
    enabled: Boolean(practiceId),
  });
}

export function useAppealCases() {
  return useQuery({
    queryKey: queryKeys.appeals,
    queryFn: () => api<AppealsResponse>("/api/appeals"),
  });
}

export function useRemittances(payerName: string | null) {
  const qs = payerName ? `?payer=${encodeURIComponent(payerName)}` : "";
  return useQuery({
    queryKey: queryKeys.remittances(payerName),
    queryFn: () => api<RemittanceRow[]>(`/api/payer/remittances${qs}`),
  });
}

// ----------------------------------------------------------- mutations

interface ReviewContext {
  previousQueue: QueueItemView[] | undefined;
  previousClaim: ClaimDetailView | undefined;
}

/** Approve or reject with optimistic updates to both queue and claim caches. */
export function useReviewClaim(action: "approve" | "reject") {
  const qc = useQueryClient();
  const status: ReviewStatus = action === "approve" ? "approved" : "rejected";
  return useMutation<unknown, Error, string, ReviewContext>({
    mutationFn: (claimId: string) =>
      api(`/api/claims/${claimId}/${action}`, { method: "POST" }),
    onMutate: async (claimId) => {
      await qc.cancelQueries({ queryKey: queryKeys.queue });
      await qc.cancelQueries({ queryKey: queryKeys.claim(claimId) });
      const previousQueue = qc.getQueryData<QueueItemView[]>(queryKeys.queue);
      const previousClaim = qc.getQueryData<ClaimDetailView>(
        queryKeys.claim(claimId),
      );
      qc.setQueryData<QueueItemView[]>(queryKeys.queue, (rows) =>
        rows?.map((r) =>
          r.claim_id === claimId ? { ...r, review_status: status } : r,
        ),
      );
      qc.setQueryData<ClaimDetailView>(queryKeys.claim(claimId), (detail) =>
        detail ? { ...detail, review_status: status } : detail,
      );
      return { previousQueue, previousClaim };
    },
    onError: (_err, claimId, ctx) => {
      if (ctx?.previousQueue) qc.setQueryData(queryKeys.queue, ctx.previousQueue);
      if (ctx?.previousClaim)
        qc.setQueryData(queryKeys.claim(claimId), ctx.previousClaim);
    },
    onSettled: (_data, _err, claimId) => {
      void qc.invalidateQueries({ queryKey: queryKeys.queue });
      void qc.invalidateQueries({ queryKey: queryKeys.claim(claimId) });
      void qc.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateCodes(claimId: string) {
  const qc = useQueryClient();
  return useMutation<ClaimDetailView, Error, UpdateCodesBody>({
    mutationFn: (body) =>
      api<ClaimDetailView>(`/api/claims/${claimId}/codes`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (detail) => {
      qc.setQueryData(queryKeys.claim(claimId), detail);
      void qc.invalidateQueries({ queryKey: queryKeys.queue });
    },
  });
}

export function useRegenerateAppeal(denialId: string) {
  const qc = useQueryClient();
  return useMutation<AppealView, Error, void>({
    mutationFn: () =>
      api<AppealView>(`/api/denials/${denialId}/appeal/regenerate`, {
        method: "POST",
      }),
    onSuccess: (view) => {
      qc.setQueryData(queryKeys.appeal(denialId), view);
      void qc.invalidateQueries({ queryKey: queryKeys.denials });
    },
  });
}

export function useSignupPractice() {
  const qc = useQueryClient();
  return useMutation<PracticeAccount, Error, PracticeSignupBody>({
    mutationFn: (body) =>
      api<PracticeAccount>("/api/practices/signup", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.practices });
    },
  });
}

export function useRunSync(practiceId: string) {
  const qc = useQueryClient();
  return useMutation<SyncRun, Error, void>({
    mutationFn: () =>
      api<SyncRun>(`/api/practices/${practiceId}/syncs/run`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.practiceSyncs(practiceId) });
      void qc.invalidateQueries({
        queryKey: queryKeys.practiceOverview(practiceId),
      });
    },
  });
}

interface DecisionContext {
  previous: AppealsResponse | undefined;
}

/** Payer decision with optimistic status update in the shared appeals cache. */
export function useAppealDecision() {
  const qc = useQueryClient();
  return useMutation<
    AppealCase,
    Error,
    { appealId: string; action: PayerDecisionAction },
    DecisionContext
  >({
    mutationFn: ({ appealId, action }) =>
      api<AppealCase>(`/api/appeals/${appealId}/decision`, {
        method: "POST",
        body: JSON.stringify({ action }),
      }),
    onMutate: async ({ appealId, action }) => {
      await qc.cancelQueries({ queryKey: queryKeys.appeals });
      const previous = qc.getQueryData<AppealsResponse>(queryKeys.appeals);
      qc.setQueryData<AppealsResponse>(queryKeys.appeals, (data) =>
        data
          ? {
              ...data,
              appeals: data.appeals.map((a) =>
                a.appeal_id === appealId
                  ? {
                      ...a,
                      status:
                        action === "overturn"
                          ? "overturned"
                          : action === "uphold"
                            ? "upheld"
                            : "payer_responded",
                    }
                  : a,
              ),
            }
          : data,
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.appeals, ctx.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.appeals });
      void qc.invalidateQueries({ queryKey: ["remittances"] });
    },
  });
}

export type { AppealLetter };
