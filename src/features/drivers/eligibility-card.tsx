"use client";

import { useTranslations } from "next-intl";
import { RequirementsCard } from "@/components/detail/requirements-card";
import { useDriverEligibility } from "@/hooks/queries/drivers";

/** Mandatory documents of a driver and whether each is valid (§6). */
export function EligibilityCard({ driverId }: { driverId: string }) {
  const t = useTranslations("drivers.eligibility");
  const query = useDriverEligibility(driverId);
  return (
    <RequirementsCard
      query={query}
      title={t("title")}
      description={t("description")}
      okLabel={t("eligible")}
      unmetLabel={(count) => t("unmet", { count })}
    />
  );
}
