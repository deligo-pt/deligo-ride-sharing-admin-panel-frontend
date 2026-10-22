"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { DateRange } from "@/types/common";
import {
  getDashboardAlerts,
  getDashboardStats,
  getRecentRegistrations,
  getRecentRides,
  getRidesByCategory,
  getTrends,
} from "@/services/dashboard";

/** `enabled` lets a widget skip its request when the role may not see it (P7). */
export function useDashboardStats(range: DateRange) {
  return useQuery({
    queryKey: qk.dashboard.stats(range),
    queryFn: () => getDashboardStats(range),
    placeholderData: keepPreviousData,
  });
}

export function useTrends(range: DateRange, enabled = true) {
  return useQuery({
    queryKey: qk.dashboard.trends(range),
    queryFn: () => getTrends(range),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRidesByCategory(range: DateRange, enabled = true) {
  return useQuery({
    queryKey: qk.dashboard.categories(range),
    queryFn: () => getRidesByCategory(range),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useRecentRides(enabled = true) {
  return useQuery({
    queryKey: qk.dashboard.recentRides(),
    queryFn: () => getRecentRides(),
    enabled,
  });
}

export function useRecentRegistrations(enabled = true) {
  return useQuery({
    queryKey: qk.dashboard.registrations(),
    queryFn: () => getRecentRegistrations(),
    enabled,
  });
}

export function useDashboardAlerts(enabled = true) {
  return useQuery({ queryKey: qk.dashboard.alerts(), queryFn: getDashboardAlerts, enabled });
}
