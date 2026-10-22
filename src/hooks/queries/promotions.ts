"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { PromotionListParams } from "@/types/promotion";
import { getPromotion, getPromotionPerformance, listPromotions, listRedemptions } from "@/services/promotions";

export function usePromotions(params: PromotionListParams) {
  return useQuery({ queryKey: qk.promotions.list(params), queryFn: () => listPromotions(params), placeholderData: keepPreviousData });
}

export function usePromotion(id: string) {
  return useQuery({ queryKey: qk.promotions.detail(id), queryFn: () => getPromotion(id) });
}

export function usePromotionRedemptions(id: string, page: number, pageSize = 25) {
  return useQuery({ queryKey: qk.promotions.redemptions(id, page), queryFn: () => listRedemptions(id, { page, pageSize }), placeholderData: keepPreviousData });
}

export function usePromotionPerformance(id: string) {
  return useQuery({ queryKey: qk.promotions.performance(id), queryFn: () => getPromotionPerformance(id) });
}
