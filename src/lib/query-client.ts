import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { isServiceError } from "@/lib/service-error";
import { expireSession } from "@/stores/session-status";

/**
 * React Query defaults (ride_plan.md §D.5): 30 s fresh, no refetch on window
 * focus. No retries, so the error state shows when "simulate errors" is on
 * instead of being hidden by a silent retry. Any UNAUTHORIZED answer ends the
 * session in this tab (P6: the "session expired" dialog), like a 401 will.
 */
const onError = (error: unknown) => {
  if (isServiceError(error) && error.code === "UNAUTHORIZED") expireSession();
};

export function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: false },
      mutations: { retry: false },
    },
  });
}
