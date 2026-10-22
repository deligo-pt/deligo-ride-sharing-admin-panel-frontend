"use client";

import { useTranslations } from "next-intl";
import { OwnerDocuments } from "@/components/detail/owner-documents";
import { RequirementsCard } from "@/components/detail/requirements-card";
import { useVehicleApprovalCheck } from "@/hooks/queries/vehicles";
import { qk } from "@/lib/query-keys";

/**
 * Documents (§8 "inspection and other required compliance documents"): the
 * three a vehicle needs (insurance, inspection, registration) and each file
 * with preview, approve and reject.
 */
export function VehicleDocumentsTab({ vehicleId }: { vehicleId: string }) {
  const t = useTranslations("vehicles.approvalDocs");
  const query = useVehicleApprovalCheck(vehicleId);
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <RequirementsCard
        query={query}
        title={t("title")}
        description={t("description")}
        okLabel={t("ready")}
        unmetLabel={(count) => t("unmet", { count })}
      />
      <OwnerDocuments ownerId={vehicleId} invalidate={[qk.vehicles.all]} />
    </div>
  );
}
