/** TanStack Query hooks — all server state lives here. */

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  AppealLetter,
  AppealView,
  ClaimDetailView,
  DashboardMetrics,
  DenialRecordView,
  QueueItemView,
  ReviewStatus,
  UpdateCodesBody,
} from "../types";
import { api } from "./client";

export const queryKeys = {
  queue: ["queue"] as const,
  claim: (id: string) => ["claims", id] as const,
  denials: ["denials"] as const,
  appeal: (id: string) => ["denials", id, "appeal"] as const,
  dashboard: ["dashboard"] as const,
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

export type { AppealLetter };
