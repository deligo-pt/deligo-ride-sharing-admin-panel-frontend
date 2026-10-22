"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { CustomerListParams } from "@/types/customer";
import { getCustomer, getSuspensionCheck, listCustomers } from "@/services/customers";

export function useCustomers(params: CustomerListParams) {
  return useQuery({
    queryKey: qk.customers.list(params),
    queryFn: () => listCustomers(params),
    placeholderData: keepPreviousData,
  });
}

export function useCustomer(id: string) {
  return useQuery({ queryKey: qk.customers.detail(id), queryFn: () => getCustomer(id) });
}

/** What blocks suspending this customer; `enabled` = the dialog is open. */
export function useSuspensionCheck(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.customers.suspensionCheck(id ?? ""),
    queryFn: () => getSuspensionCheck(id ?? ""),
    enabled: enabled && Boolean(id),
    // Always ask again: a ride may have started since the page loaded.
    staleTime: 0,
  });
}
