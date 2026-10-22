"use client";

import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * Mutations go through here (ride_plan.md §D.4): on success the listed query
 * keys are invalidated so every list/detail refetches. The service already
 * wrote the audit entry; the screen shows the toast (it has the translations)
 * via `onSuccess`, and `ServiceError.field` for inline form errors.
 *
 *   const suspend = useServiceMutation({
 *     mutationFn: (v: { id: string; reason: string }) => suspendCustomer(v.id, v.reason),
 *     invalidate: [qk.customers.all, qk.audit.all],
 *     onSuccess: () => toast.success(t("customers.suspended")),
 *   });
 */
export function useServiceMutation<TVars, TData>(options: {
  mutationFn: (vars: TVars) => Promise<TData>;
  invalidate: QueryKey[];
  onSuccess?: (data: TData, vars: TVars) => void;
  onError?: (error: unknown, vars: TVars) => void;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: async (data, vars) => {
      await Promise.all(options.invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      options.onSuccess?.(data, vars);
    },
    onError: (error, vars) => options.onError?.(error, vars),
  });
}
