"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { VehicleListParams } from "@/types/vehicle";
import {
  getVehicle,
  getVehicleApprovalCheck,
  getVehicleDrivers,
  getVehicleStatusCheck,
  listAssignableDrivers,
  listVehicles,
} from "@/services/vehicles";

export function useVehicles(params: VehicleListParams) {
  return useQuery({
    queryKey: qk.vehicles.list(params),
    queryFn: () => listVehicles(params),
    placeholderData: keepPreviousData,
  });
}

export function useVehicle(id: string) {
  return useQuery({ queryKey: qk.vehicles.detail(id), queryFn: () => getVehicle(id) });
}

export function useVehicleApprovalCheck(id: string) {
  return useQuery({
    queryKey: qk.vehicles.approval(id),
    queryFn: () => getVehicleApprovalCheck(id),
  });
}

/** What blocks changing this vehicle's status; `enabled` = the dialog is open. */
export function useVehicleStatusCheck(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.vehicles.statusCheck(id ?? ""),
    queryFn: () => getVehicleStatusCheck(id ?? ""),
    enabled: enabled && Boolean(id),
    staleTime: 0,
  });
}

export function useVehicleDrivers(id: string) {
  return useQuery({ queryKey: qk.vehicles.drivers(id), queryFn: () => getVehicleDrivers(id) });
}

/** Drivers who can take the vehicle; `enabled` = the assign dialog is open. */
export function useAssignableDrivers(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.vehicles.assignable(id ?? ""),
    queryFn: () => listAssignableDrivers(id ?? ""),
    enabled: enabled && Boolean(id),
    staleTime: 0,
  });
}
