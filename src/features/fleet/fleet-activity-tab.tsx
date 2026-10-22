"use client";

import { useTranslations } from "next-intl";
import type { FleetManager } from "@/types/fleet";
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
  PENDING: "warning",
} as const;

/**
 * Activity (§7 "review the fleet manager's activity history"): verification
 * and account changes with their reasons, and — with `audit.view` — every
 * admin action on this fleet.
 */
export function FleetActivityTab({ fleet }: { fleet: FleetManager }) {
  const t = useTranslations("fleet.activity");
  const tAll = useTranslations();
  const allowed = usePermission();

  /** Verification and account statuses share words (SUSPENDED, ACTIVE): look in both. */
  const label = (status: string) => {
    const key = `status.fleetVerification.${status}`;
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
            items={[...fleet.statusHistory].reverse().map((c, i) => ({
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
      {allowed("audit", "view") && <FleetAudit fleetId={fleet.id} />}
    </div>
  );
}

function FleetAudit({ fleetId }: { fleetId: string }) {
  const t = useTranslations("fleet.activity");
  const tAll = useTranslations();
  const query = useAuditLogs({
    page: 1,
    pageSize: 50,
    resourceId: fleetId,
    resourceType: ["fleet"],
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
              // Message keys cannot contain "." — "fleet.approve" → "fleet_approve".
              const key = `fleet.activityActions.${a.action.replace(".", "_")}`;
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
