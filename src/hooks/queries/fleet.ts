"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { DateRange } from "@/types/common";
import type { FleetListParams } from "@/types/fleet";
import {
  getFleetManager,
  getFleetOnboardingCheck,
  getFleetPerformance,
  getFleetSuspensionCheck,
  listFleetManagers,
} from "@/services/fleet";

/** `enabled` lets a screen skip the request when the role may not open Fleet managers (P7). */
export function useFleetManagers(params: FleetListParams, enabled = true) {
  return useQuery({
    queryKey: qk.fleet.list(params),
    queryFn: () => listFleetManagers(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useFleetManager(id: string) {
  return useQuery({ queryKey: qk.fleet.detail(id), queryFn: () => getFleetManager(id) });
}

export function useFleetOnboardingCheck(id: string) {
  return useQuery({
    queryKey: qk.fleet.onboarding(id),
    queryFn: () => getFleetOnboardingCheck(id),
  });
}

/** What blocks suspending this fleet; `enabled` = the dialog is open. */
export function useFleetSuspensionCheck(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.fleet.suspensionCheck(id ?? ""),
    queryFn: () => getFleetSuspensionCheck(id ?? ""),
    enabled: enabled && Boolean(id),
    staleTime: 0,
  });
}

export function useFleetPerformance(id: string, range: DateRange) {
  return useQuery({
    queryKey: qk.fleet.performance(id, range),
    queryFn: () => getFleetPerformance(id, range),
    placeholderData: keepPreviousData,
  });
}
