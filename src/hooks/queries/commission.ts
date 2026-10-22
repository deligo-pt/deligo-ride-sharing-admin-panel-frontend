"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { SettlementListParams } from "@/types/finance";
import { getSettlement, listCommissionRules, listSettlements } from "@/services/commission";

export function useCommissionRules() {
  return useQuery({ queryKey: qk.commission.rules(), queryFn: listCommissionRules });
}

export function useSettlements(params: SettlementListParams) {
  return useQuery({ queryKey: qk.commission.list(params), queryFn: () => listSettlements(params), placeholderData: keepPreviousData });
}

export function useSettlement(id: string) {
  return useQuery({ queryKey: qk.commission.detail(id), queryFn: () => getSettlement(id) });
}
