"use client";

import { useTranslations } from "next-intl";
import type { VehicleListItem } from "@/types/vehicle";
import { Timeline } from "@/components/detail/detail-parts";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { usePermission } from "@/components/session/permissions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuditLogs } from "@/hooks/queries/audit";
import { useVehicleDrivers } from "@/hooks/queries/vehicles";
import { Link } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";

const TONE = {
  APPROVED: "success",
  ACTIVE: "success",
  REJECTED: "danger",
  SUSPENDED: "danger",
  INACTIVE: "warning",
  PENDING_REVIEW: "warning",
} as const;

/**
 * Assignment history (§8 "view the driver's or fleet's associated
 * vehicles"): who is assigned now, who has driven the vehicle (from its
 * rides), and every approval and status change with its reason — plus, with
 * `audit.view`, the admin actions on this vehicle.
 */
export function VehicleAssignmentsTab({ vehicle }: { vehicle: VehicleListItem }) {
  const t = useTranslations("vehicles.assignments");
  const tAll = useTranslations();
  const allowed = usePermission();

  /** Approval and operational statuses share a word (SUSPENDED): look in both. */
  const label = (status: string) => {
    const key = `status.vehicleApproval.${status}`;
    return tAll.has(key as Parameters<typeof tAll>[0])
      ? tAll(key as Parameters<typeof tAll>[0])
      : tAll(`status.vehicleOperational.${status}` as Parameters<typeof tAll>[0]);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">{t("driversTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <DriversUsed vehicleId={vehicle.id} />
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-card-title">{t("statusTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline
              emptyLabel={t("statusEmpty")}
              items={[...vehicle.statusHistory].reverse().map((c, i) => ({
                id: `${c.at}-${i}`,
                title: label(c.status),
                at: c.at,
                by: c.by,
                description: c.reason,
                tone: TONE[c.status as keyof typeof TONE] ?? "default",
              }))}
            />
          </CardContent>
        </Card>
        {allowed("audit", "view") && <VehicleAudit vehicleId={vehicle.id} />}
      </div>
    </div>
  );
}

function DriversUsed({ vehicleId }: { vehicleId: string }) {
  const t = useTranslations("vehicles.assignments");
  const f = useFormat();
  const allowed = usePermission();
  const query = useVehicleDrivers(vehicleId);

  if (query.isPending) {
    return <Skeleton className="h-24" aria-hidden />;
  }
  if (query.isError)
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} className="py-6" />;
  if (query.data.length === 0)
    return (
      <EmptyState
        title={t("driversEmptyTitle")}
        description={t("driversEmptyBody")}
        className="py-6"
      />
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-dense">
        <thead>
          <tr className="text-caption text-left">
            <th className="py-2 pr-4 font-medium">{t("columns.driver")}</th>
            <th className="py-2 pr-4 text-right font-medium">{t("columns.rides")}</th>
            <th className="py-2 pr-4 font-medium">{t("columns.first")}</th>
            <th className="py-2 font-medium">{t("columns.last")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {query.data.map((use) => (
            <tr key={use.driverId}>
              <td className="py-2.5 pr-4">
                <span className="flex flex-wrap items-center gap-2">
                  {allowed("drivers", "view") ? (
                    <Link
                      href={`/drivers/${use.driverId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {use.driverName}
                    </Link>
                  ) : (
                    <span className="font-medium">{use.driverName}</span>
                  )}
                  <span className="text-caption tabular-nums">{use.driverId}</span>
                  {use.current && (
                    <Badge variant="brand" className="text-micro h-5">
                      {t("current")}
                    </Badge>
                  )}
                </span>
              </td>
              <td className="tabular py-2.5 pr-4 text-right">{f.number(use.rides)}</td>
              <td className="py-2.5 pr-4 whitespace-nowrap">{f.date(use.firstRideAt)}</td>
              <td className="py-2.5 whitespace-nowrap">{f.date(use.lastRideAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VehicleAudit({ vehicleId }: { vehicleId: string }) {
  const t = useTranslations("vehicles.assignments");
  const tAll = useTranslations();
  const query = useAuditLogs({
    page: 1,
    pageSize: 50,
    resourceId: vehicleId,
    resourceType: ["vehicle"],
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-title">{t("auditTitle")}</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <p className="text-dense text-muted-foreground">{tAll("common.loading")}</p>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} className="py-6" />
        ) : (
          <Timeline
            emptyLabel={t("auditEmpty")}
            items={query.data.items.map((a) => {
              // Message keys cannot contain "." — "vehicle.approve" → "vehicle_approve".
              const key = `vehicles.activityActions.${a.action.replace(".", "_")}`;
              return {
                id: a.id,
                title: tAll.has(key as Parameters<typeof tAll>[0])
                  ? tAll(key as Parameters<typeof tAll>[0])
                  : a.action,
                at: a.at,
                by: a.adminName,
                description: a.reason,
                tone: /reject|suspend/.test(a.action)
                  ? "danger"
                  : /approve/.test(a.action)
                    ? "success"
                    : "default",
              };
            })}
          />
        )}
      </CardContent>
    </Card>
  );
}
