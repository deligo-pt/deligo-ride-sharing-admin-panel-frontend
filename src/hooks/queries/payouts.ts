"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { PayoutListParams } from "@/types/payout";
import { getPayout, listPayouts } from "@/services/payouts";

export function usePayouts(params: PayoutListParams) {
  return useQuery({ queryKey: qk.payouts.list(params), queryFn: () => listPayouts(params), placeholderData: keepPreviousData });
}

export function usePayout(id: string) {
  return useQuery({ queryKey: qk.payouts.detail(id), queryFn: () => getPayout(id) });
}
