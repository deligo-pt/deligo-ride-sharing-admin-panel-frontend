"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { GdprListParams } from "@/types/settings";
import { getSettings, listGdprRequests } from "@/services/settings";

export function usePlatformSettings() {
  return useQuery({ queryKey: qk.settings.platform(), queryFn: getSettings });
}

export function useGdprRequests(params: GdprListParams) {
  return useQuery({ queryKey: qk.settings.gdpr(params), queryFn: () => listGdprRequests(params), placeholderData: keepPreviousData });
}
