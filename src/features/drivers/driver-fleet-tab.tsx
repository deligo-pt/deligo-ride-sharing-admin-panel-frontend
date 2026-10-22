"use client";

import { Building2, Car, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DriverListItem } from "@/types/driver";
import { StatusBadge } from "@/components/badges/status-badge";
import { KeyValueGrid } from "@/components/detail/detail-parts";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { Can, usePermission } from "@/components/session/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useVehicle } from "@/hooks/queries/vehicles";
import { Link } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";

/**
 * Fleet & vehicle (§6): who the driver works for and the car they drive.
 * Changing the fleet needs `drivers.edit` and a reason; the vehicle follows
 * the driver to the new fleet (services/drivers.ts).
 */
export function DriverFleetTab({
  driver,
  onChangeFleet,
}: {
  driver: DriverListItem;
  onChangeFleet: () => void;
}) {
  const t = useTranslations("drivers.fleet");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-card-title flex items-center gap-2">
            <Building2 aria-hidden className="size-5 text-muted-foreground" />
            {t("fleetTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-dense">{driver.fleetName ?? t("independent")}</p>
          <p className="text-caption">
            {driver.fleetManagerId
              ? t("fleetBody", { id: driver.fleetManagerId })
              : t("independentBody")}
          </p>
          <Can module="drivers" action="edit">
            <Button variant="outline" size="sm" className="self-start" onClick={onChangeFleet}>
              <Pencil />
              {t("change")}
            </Button>
          </Can>
        </CardContent>
      </Card>
      <VehicleCard driver={driver} />
    </div>
  );
}

function VehicleCard({ driver }: { driver: DriverListItem }) {
  const t = useTranslations("drivers.fleet");
  const tAll = useTranslations();
  const f = useFormat();
  const allowed = usePermission();
  const canSee = allowed("vehicles", "view");
  // The vehicle record is only requested by roles that may open Vehicles.
  const query = useVehicle(canSee && driver.vehicleId ? driver.vehicleId : "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-title flex items-center gap-2">
          <Car aria-hidden className="size-5 text-muted-foreground" />
          {t("vehicleTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!driver.vehicleId ? (
          <EmptyState
            title={t("noVehicleTitle")}
            description={t("noVehicleBody")}
            className="py-6"
          />
        ) : !canSee ? (
          <p className="text-dense">
            {driver.vehiclePlate} · {driver.vehicleLabel}
          </p>
        ) : query.isPending ? (
          <Skeleton className="h-40" aria-hidden />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} className="py-6" />
        ) : (
          <KeyValueGrid
            items={[
              {
                label: t("plate"),
                value: (
                  <Link
                    href={`/vehicles/${query.data.id}`}
                    className="tabular font-medium text-primary hover:underline"
                  >
                    {query.data.plate}
                  </Link>
                ),
              },
              {
                label: t("model"),
                value: `${query.data.make} ${query.data.model} (${query.data.year})`,
              },
              { label: t("category"), value: tAll(`enums.rideCategory.${query.data.category}`) },
              {
                label: t("approval"),
                value: <StatusBadge kind="vehicleApproval" value={query.data.approval} />,
              },
              {
                label: t("insurance"),
                value: (
                  <span className="flex flex-col items-start gap-1">
                    {f.date(query.data.insurance.expiresAt)}
                    <StatusBadge kind="credential" value={query.data.insurance.status} />
                  </span>
                ),
              },
              {
                label: t("inspection"),
                value: (
                  <span className="flex flex-col items-start gap-1">
                    {f.date(query.data.inspection.expiresAt)}
                    <StatusBadge kind="credential" value={query.data.inspection.status} />
                  </span>
                ),
              },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}
