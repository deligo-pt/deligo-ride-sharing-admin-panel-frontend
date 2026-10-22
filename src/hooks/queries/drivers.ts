"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { DriverListParams } from "@/types/driver";
import {
  getDriver,
  getDriverEligibility,
  getDriverSuspensionCheck,
  listDrivers,
} from "@/services/drivers";
import { getDriverEarnings } from "@/services/payouts";

export function useDrivers(params: DriverListParams) {
  return useQuery({
    queryKey: qk.drivers.list(params),
    queryFn: () => listDrivers(params),
    placeholderData: keepPreviousData,
  });
}

export function useDriver(id: string) {
  return useQuery({ queryKey: qk.drivers.detail(id), queryFn: () => getDriver(id) });
}

export function useDriverEarnings(id: string, from: string, to: string) {
  return useQuery({
    queryKey: qk.drivers.earnings(id, from, to),
    queryFn: () => getDriverEarnings(id, from, to),
  });
}

export function useDriverEligibility(id: string) {
  return useQuery({
    queryKey: qk.drivers.eligibility(id),
    queryFn: () => getDriverEligibility(id),
  });
}

/** What blocks suspending this driver; `enabled` = the dialog is open. */
export function useDriverSuspensionCheck(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.drivers.suspensionCheck(id ?? ""),
    queryFn: () => getDriverSuspensionCheck(id ?? ""),
    enabled: enabled && Boolean(id),
    staleTime: 0,
  });
}
