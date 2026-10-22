"use client";

import { useTranslations } from "next-intl";
import type { VehicleListItem } from "@/types/vehicle";
import { StatusBadge } from "@/components/badges/status-badge";
import { KeyValueGrid } from "@/components/detail/detail-parts";
import { usePermission } from "@/components/session/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CredentialCell } from "@/features/drivers/credential-cell";
import { Link } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";

/** Info (§8 "vehicle information"): the car, insurance and inspection, status, and who it is assigned to. */
export function VehicleInfoTab({ vehicle }: { vehicle: VehicleListItem }) {
  const t = useTranslations("vehicles");
  const tAll = useTranslations();
  const f = useFormat();
  const allowed = usePermission();
  const link = (href: `/${string}`, text: string) => (
    <Link href={href} className="text-primary hover:underline">
      {text}
    </Link>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">{t("sections.vehicle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyValueGrid
            columns={1}
            items={[
              {
                label: t("form.plate"),
                value: <span className="tabular font-medium">{vehicle.plate}</span>,
              },
              { label: t("fields.model"), value: `${vehicle.make} ${vehicle.model}` },
              { label: t("form.year"), value: vehicle.year },
              { label: t("form.colour"), value: tAll(`enums.vehicleColour.${vehicle.colour}`) },
              { label: t("form.category"), value: tAll(`enums.rideCategory.${vehicle.category}`) },
              { label: t("form.type"), value: tAll(`enums.vehicleType.${vehicle.type}`) },
              { label: t("form.seats"), value: vehicle.seats },
              {
                label: t("form.electric"),
                value: vehicle.electric ? tAll("common.yes") : tAll("common.no"),
              },
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">{t("sections.compliance")}</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyValueGrid
            columns={1}
            items={[
              { label: t("form.insurer"), value: vehicle.insurance.insurer },
              {
                label: t("form.policyNo"),
                value: <span className="tabular">{vehicle.insurance.policyNo}</span>,
              },
              {
                label: t("form.insuranceExpires"),
                value: <CredentialCell credential={vehicle.insurance} />,
              },
              {
                label: t("form.inspectionExpires"),
                value: <CredentialCell credential={vehicle.inspection} />,
              },
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">{t("sections.status")}</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyValueGrid
            columns={1}
            items={[
              {
                label: t("fields.approval"),
                value: <StatusBadge kind="vehicleApproval" value={vehicle.approval} />,
              },
              {
                label: t("fields.operational"),
                value: <StatusBadge kind="vehicleOperational" value={vehicle.operational} />,
              },
              {
                label: t("fields.driver"),
                value:
                  vehicle.driverId && vehicle.driverName
                    ? allowed("drivers", "view")
                      ? link(`/drivers/${vehicle.driverId}`, vehicle.driverName)
                      : vehicle.driverName
                    : t("unassigned"),
              },
              {
                label: t("fields.fleet"),
                value:
                  vehicle.fleetManagerId && vehicle.fleetName
                    ? allowed("fleet", "view")
                      ? link(`/fleet-managers/${vehicle.fleetManagerId}`, vehicle.fleetName)
                      : vehicle.fleetName
                    : t("independent"),
              },
              { label: t("fields.registered"), value: f.dateTime(vehicle.registeredAt) },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
