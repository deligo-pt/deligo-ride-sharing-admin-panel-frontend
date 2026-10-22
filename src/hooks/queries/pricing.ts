"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { PricingListParams } from "@/types/pricing";
import {
  getActivePricing,
  getPricingRule,
  listPricingRules,
  listZones,
  previewFare,
  type FarePreviewInput,
} from "@/services/pricing";

export function usePricingRules(params: PricingListParams) {
  return useQuery({ queryKey: qk.pricing.list(params), queryFn: () => listPricingRules(params), placeholderData: keepPreviousData });
}

export function useActivePricing() {
  return useQuery({ queryKey: qk.pricing.active(), queryFn: getActivePricing });
}

export function usePricingRule(id: string) {
  return useQuery({ queryKey: qk.pricing.detail(id), queryFn: () => getPricingRule(id) });
}

export function useZones() {
  return useQuery({ queryKey: qk.pricing.zones(), queryFn: listZones });
}

/** The sample-trip calculator (§11). Re-runs as the inputs change; the previous result stays on screen meanwhile. */
export function usePreviewFare(input: FarePreviewInput, enabled = true) {
  return useQuery({
    queryKey: qk.pricing.preview(input),
    queryFn: () => previewFare(input),
    enabled,
    placeholderData: keepPreviousData,
  });
}
