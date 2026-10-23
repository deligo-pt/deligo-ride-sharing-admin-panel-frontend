"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { DateRange, ListParams } from "@/types/common";
import type { SettlementListParams } from "@/types/finance";
import {
  getSettlement,
  getSettlementSummary,
  listCommissionRules,
  listSettlementRides,
  listSettlements,
} from "@/services/commission";

export function useCommissionRules() {
  return useQuery({ queryKey: qk.commission.rules(), queryFn: listCommissionRules });
}

export function useSettlements(params: SettlementListParams) {
  return useQuery({ queryKey: qk.commission.list(params), queryFn: () => listSettlements(params), placeholderData: keepPreviousData });
}

export function useSettlement(id: string) {
  return useQuery({ queryKey: qk.commission.detail(id), queryFn: () => getSettlement(id) });
}

export function useSettlementSummary(range: DateRange) {
  return useQuery({ queryKey: qk.commission.summary(range), queryFn: () => getSettlementSummary(range), placeholderData: keepPreviousData });
}

export function useSettlementRides(id: string, params: ListParams) {
  return useQuery({ queryKey: qk.commission.rides(id, params), queryFn: () => listSettlementRides(id, params), placeholderData: keepPreviousData });
}
