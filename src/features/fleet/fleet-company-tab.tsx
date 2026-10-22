"use client";

import { useTranslations } from "next-intl";
import type { FleetManager } from "@/types/fleet";
import { StatusBadge } from "@/components/badges/status-badge";
import { KeyValueGrid } from "@/components/detail/detail-parts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormat } from "@/lib/use-format";

/** Company & contact (§7 "view fleet manager details"). */
export function FleetCompanyTab({ fleet }: { fleet: FleetManager }) {
  const t = useTranslations("fleet");
  const f = useFormat();
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">{t("sections.company")}</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyValueGrid
            columns={1}
            items={[
              { label: t("fields.companyName"), value: fleet.companyName },
              { label: t("fields.nif"), value: <span className="tabular">{fleet.nif}</span> },
              { label: t("fields.address"), value: fleet.address },
              { label: t("fields.registered"), value: f.dateTime(fleet.registeredAt) },
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">{t("sections.contact")}</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyValueGrid
            columns={1}
            items={[
              { label: t("fields.contactName"), value: fleet.contactName },
              { label: t("fields.email"), value: fleet.email },
              { label: t("fields.phone"), value: f.phone(fleet.phone) },
            ]}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">{t("sections.account")}</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyValueGrid
            columns={1}
            items={[
              {
                label: t("fields.verification"),
                value: <StatusBadge kind="fleetVerification" value={fleet.verification} />,
              },
              {
                label: t("fields.account"),
                value: <StatusBadge kind="account" value={fleet.accountStatus} />,
              },
              { label: t("fields.drivers"), value: f.number(fleet.driverIds.length) },
              { label: t("fields.vehicles"), value: f.number(fleet.vehicleIds.length) },
              { label: t("fields.rides"), value: f.number(fleet.completedRides) },
              { label: t("fields.balance"), value: f.eur(fleet.settlementBalanceCents) },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
