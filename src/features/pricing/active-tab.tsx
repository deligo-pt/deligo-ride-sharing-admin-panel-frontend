"use client";

import { useTranslations } from "next-intl";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivePricing, usePricingRules } from "@/hooks/queries/pricing";
import { FareSummary } from "./fare-summary";
import { CATEGORIES } from "./pricing-utils";

/** The fares in force now, one card per category, with the next scheduled version noted. */
export function ActiveTab() {
  const t = useTranslations("pricing");
  const active = useActivePricing();
  const scheduled = usePricingRules({ page: 1, pageSize: 50, status: ["SCHEDULED"] });

  if (active.isPending)
    return (
      <div className="flex flex-col gap-4" aria-busy>
        {CATEGORIES.map((c) => (
          <Skeleton key={c} className="h-56" />
        ))}
      </div>
    );
  if (active.isError) return <ErrorState error={active.error} onRetry={() => active.refetch()} />;
  if (active.data.length === 0) return <EmptyState title={t("active.empty")} />;

  const byCategory = new Map(active.data.map((r) => [r.category, r]));
  return (
    <div className="flex flex-col gap-4">
      <InlineAlert tone="info">{t("notRecalculated")}</InlineAlert>
      {CATEGORIES.flatMap((category) => {
        const rule = byCategory.get(category);
        if (!rule) return [];
        const next = scheduled.data?.items
          .filter((r) => r.category === category && !r.zoneId)
          .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
        return [<FareSummary key={category} rule={rule} next={next} />];
      })}
    </div>
  );
}
