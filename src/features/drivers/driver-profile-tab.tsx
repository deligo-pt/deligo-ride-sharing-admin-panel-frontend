"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { DriverListItem } from "@/types/driver";
import { StatusBadge } from "@/components/badges/status-badge";
import { KeyValueGrid } from "@/components/detail/detail-parts";
import { NotesCard } from "@/components/detail/notes-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { qk } from "@/lib/query-keys";
import { isServiceError } from "@/lib/service-error";
import { useFormat } from "@/lib/use-format";
import { addDriverNote } from "@/services/drivers";
import { CredentialCell } from "./credential-cell";

/** Profile (§6 "view the complete driver profile"): contact, account, credentials, internal notes. */
export function DriverProfileTab({ driver }: { driver: DriverListItem }) {
  const t = useTranslations("drivers");
  const tError = useTranslations("feedback.errors");
  const f = useFormat();
  const noteMutation = useServiceMutation({
    mutationFn: (text: string) => addDriverNote(driver.id, text),
    invalidate: [qk.drivers.detail(driver.id), qk.audit.all],
    onSuccess: () => toast.success(t("noteAdded")),
    onError: (error) => toast.error(tError(isServiceError(error) ? error.code : "UNKNOWN")),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-card-title">{t("sections.contact")}</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValueGrid
              columns={1}
              items={[
                { label: t("fields.email"), value: driver.email },
                { label: t("fields.phone"), value: f.phone(driver.phone) },
                { label: t("fields.nif"), value: driver.nif },
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
                { label: t("fields.joined"), value: f.dateTime(driver.joinedAt) },
                {
                  label: t("fields.verification"),
                  value: <StatusBadge kind="driverVerification" value={driver.verification} />,
                },
                {
                  label: t("fields.account"),
                  value: <StatusBadge kind="account" value={driver.accountStatus} />,
                },
                { label: t("fields.presence"), value: driver.online ? t("online") : t("offline") },
                {
                  label: t("fields.currentRide"),
                  value: driver.currentRideStatus ? (
                    <StatusBadge kind="ride" value={driver.currentRideStatus} />
                  ) : (
                    t("noRide")
                  ),
                },
                {
                  label: t("fields.rating"),
                  value: `${f.number(driver.rating, { decimals: 1 })} / 5`,
                },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-card-title">{t("sections.credentials")}</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValueGrid
              columns={1}
              items={[
                {
                  label: t("fields.licence"),
                  value: (
                    <CredentialBlock number={driver.licence.number} credential={driver.licence} />
                  ),
                },
                {
                  label: t("fields.tvde"),
                  value: <CredentialBlock number={driver.tvde.number} credential={driver.tvde} />,
                },
                {
                  label: t("fields.vehicle"),
                  value: driver.vehiclePlate
                    ? `${driver.vehiclePlate} · ${driver.vehicleLabel}`
                    : t("noVehicle"),
                },
                { label: t("fields.fleet"), value: driver.fleetName ?? t("independent") },
              ]}
            />
          </CardContent>
        </Card>
      </div>
      <section className="flex flex-col gap-3" aria-label={t("sections.notes")}>
        <h2 className="text-card-title">{t("sections.notes")}</h2>
        <NotesCard
          module="drivers"
          notes={driver.notes}
          placeholder={t("notePlaceholder")}
          addLabel={t("addNote")}
          emptyLabel={t("noNotes")}
          onAdd={(text) => noteMutation.mutateAsync(text)}
        />
      </section>
    </div>
  );
}

function CredentialBlock({
  number,
  credential,
}: {
  number: string;
  credential: DriverListItem["licence"];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="tabular">{number}</span>
      <CredentialCell credential={credential} />
    </div>
  );
}
