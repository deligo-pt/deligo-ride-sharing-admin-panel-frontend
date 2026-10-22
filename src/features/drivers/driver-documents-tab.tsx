"use client";

import { RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DriverListItem } from "@/types/driver";
import { OwnerDocuments } from "@/components/detail/owner-documents";
import { usePermission } from "@/components/session/permissions";
import { Button } from "@/components/ui/button";
import { qk } from "@/lib/query-keys";
import { EligibilityCard } from "./eligibility-card";

/**
 * Documents tab (§6, §18): what the driver must have, each document with
 * preview, approve, reject (with the reason the driver will see), and "ask
 * for new documents" (`drivers.approve`).
 */
export function DriverDocumentsTab({
  driver,
  onResubmit,
}: {
  driver: DriverListItem;
  onResubmit: () => void;
}) {
  const t = useTranslations("drivers.documents");
  const allowed = usePermission();
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <EligibilityCard driverId={driver.id} />
      <OwnerDocuments
        ownerId={driver.id}
        invalidate={[qk.drivers.all]}
        headerAction={
          allowed("drivers", "approve") && driver.documents.length > 0 ? (
            <Button variant="outline" size="sm" onClick={onResubmit}>
              <RotateCw />
              {t("requestNew")}
            </Button>
          ) : null
        }
      />
    </div>
  );
}
