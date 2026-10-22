"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { getLiveSnapshot } from "@/services/live";

/** Polls every 5 s (§10: refresh by polling until the admin socket channel exists). */
export function useLiveSnapshot() {
  return useQuery({
    queryKey: qk.live.snapshot(),
    queryFn: getLiveSnapshot,
    refetchInterval: 5_000,
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
}
