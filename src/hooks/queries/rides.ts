"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { RideListParams } from "@/types/ride";
import { getRide, getRideTabCounts, listReassignCandidates, listRides } from "@/services/rides";

export function useRides(params: RideListParams) {
  return useQuery({
    queryKey: qk.rides.list(params),
    queryFn: () => listRides(params),
    placeholderData: keepPreviousData,
  });
}

export function useRide(id: string) {
  return useQuery({ queryKey: qk.rides.detail(id), queryFn: () => getRide(id) });
}

export function useReassignCandidates(id: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.rides.candidates(id),
    queryFn: () => listReassignCandidates(id),
    enabled,
  });
}

/** Counts for the tab headers; the status filter and the tab itself are left out. */
export function useRideTabCounts(
  params: Omit<RideListParams, "page" | "pageSize" | "tab" | "status" | "sort">,
) {
  return useQuery({
    queryKey: qk.rides.counts(params),
    queryFn: () => getRideTabCounts(params),
    placeholderData: keepPreviousData,
  });
}
