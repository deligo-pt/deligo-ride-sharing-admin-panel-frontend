"use client";

import { useTranslations } from "next-intl";
import { OwnerDocuments } from "@/components/detail/owner-documents";
import { RequirementsCard } from "@/components/detail/requirements-card";
import { useFleetOnboardingCheck } from "@/hooks/queries/fleet";
import { qk } from "@/lib/query-keys";

/**
 * Documents (§7 "review business and compliance documents"): the three
 * company documents required for onboarding, and each file with preview,
 * approve and reject.
 */
export function FleetDocumentsTab({ fleetId }: { fleetId: string }) {
  const t = useTranslations("fleet.onboarding");
  const query = useFleetOnboardingCheck(fleetId);
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <RequirementsCard
        query={query}
        title={t("title")}
        description={t("description")}
        okLabel={t("ready")}
        unmetLabel={(count) => t("unmet", { count })}
      />
      <OwnerDocuments ownerId={fleetId} invalidate={[qk.fleet.all]} />
    </div>
  );
}
