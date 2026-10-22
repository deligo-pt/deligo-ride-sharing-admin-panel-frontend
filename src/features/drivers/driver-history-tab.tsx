"use client";

import { useTranslations } from "next-intl";
import type { DriverListItem } from "@/types/driver";
import { Timeline } from "@/components/detail/detail-parts";
import { ErrorState } from "@/components/feedback/states";
import { usePermission } from "@/components/session/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuditLogs } from "@/hooks/queries/audit";

const TONE = {
  APPROVED: "success",
  ACTIVE: "success",
  REJECTED: "danger",
  SUSPENDED: "danger",
  DEACTIVATED: "danger",
  PENDING_DOCS: "warning",
} as const;

/**
 * History (§6 "status changes and administrative actions"): every
 * verification and account change with its reason, and — for roles that may
 * open the audit log — everything admins did to this driver.
 */
export function DriverHistoryTab({ driver }: { driver: DriverListItem }) {
  const t = useTranslations("drivers.history");
  const tAll = useTranslations();
  const allowed = usePermission();
  const changes = [...driver.statusHistory].reverse();

  /** Verification and account statuses share some words (SUSPENDED): say which one changed. */
  const label = (status: string) => {
    const key = `status.driverVerification.${status}`;
    return tAll.has(key as Parameters<typeof tAll>[0])
      ? tAll(key as Parameters<typeof tAll>[0])
      : tAll(`status.account.${status}` as Parameters<typeof tAll>[0]);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">{t("statusTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline
            emptyLabel={t("statusEmpty")}
            items={changes.map((c, i) => ({
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
      {allowed("audit", "view") && <DriverAudit driverId={driver.id} />}
    </div>
  );
}

function DriverAudit({ driverId }: { driverId: string }) {
  const t = useTranslations("drivers.history");
  const tAll = useTranslations();
  const query = useAuditLogs({
    page: 1,
    pageSize: 50,
    resourceId: driverId,
    resourceType: ["driver"],
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
              // Message keys cannot contain "." — "driver.approve" → "driver_approve".
              const key = `drivers.activityActions.${a.action.replace(".", "_")}`;
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
                  : /approve|reactivate/.test(a.action)
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
