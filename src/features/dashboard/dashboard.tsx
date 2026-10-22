"use client";

import { useMemo } from "react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useTranslations } from "next-intl";
import { ExportButton } from "@/components/data/export-button";
import { DateRangeFilter } from "@/components/data/filter-bar";
import { Can, usePermission } from "@/components/session/permissions";
import {
  useDashboardAlerts,
  useDashboardStats,
  useRecentRegistrations,
  useRecentRides,
  useRidesByCategory,
  useTrends,
} from "@/hooks/queries/dashboard";
import { DATE_PRESETS, resolveDateRange } from "@/lib/date-range";
import { useFormat } from "@/lib/use-format";
import { exportDashboard } from "@/services/dashboard";
import { RecentRegistrationsCard, RecentRidesCard } from "./activity-panels";
import { OperationalAlertsCard, PendingApprovalsCard, ShortcutsCard } from "./attention-panels";
import { CategoryChartCard, RevenueChartCard, RidesChartCard } from "./chart-cards";
import { KpiGrid, KpiGridError, KpiGridSkeleton, periodQuery } from "./kpi-grid";

/**
 * Dashboard (§4). The period lives in the URL (`?range=7d`, `?range=custom&from=…&to=…`,
 * default last 30 days) so a view can be shared and survives a reload; every
 * widget reads the same period. Widgets that show another module's records
 * are skipped — not even requested — for roles that may not open it (P7).
 */
const periodParsers = {
  range: parseAsStringLiteral(DATE_PRESETS).withDefault("30d"),
  from: parseAsString,
  to: parseAsString,
};

export function Dashboard() {
  const t = useTranslations();
  const f = useFormat();
  const allowed = usePermission();
  const [{ range, from, to }, setPeriod] = useQueryStates(periodParsers, {
    history: "replace",
    clearOnDefault: true,
    scroll: false,
  });
  // Recomputed only when the URL changes, so the query keys stay stable.
  const period = useMemo(() => resolveDateRange(range, from, to), [range, from, to]);

  const stats = useDashboardStats(period);
  const trends = useTrends(period);
  const categories = useRidesByCategory(period);
  const canSeeRides = allowed("rides", "view");
  // A card of links to modules the role can't open would only say "all clear" — leave it out.
  const showApprovals = (["drivers", "documents", "fleet", "vehicles"] as const).some((m) =>
    allowed(m, "view"),
  );
  const showAlerts = (["support", "live", "payouts", "documents", "invoices"] as const).some((m) =>
    allowed(m, "view"),
  );
  const showRegistrations = (["customers", "drivers", "fleet"] as const).some((m) =>
    allowed(m, "view"),
  );
  const recentRides = useRecentRides(canSeeRides);
  const registrations = useRecentRegistrations(showRegistrations);
  const alerts = useDashboardAlerts(showApprovals || showAlerts);

  const getExport = async () => {
    const points = await exportDashboard(period);
    const hourly = points[0]?.bucket.includes("T") ?? false;
    const col = (key: string, label: string) => ({ key, label });
    return {
      columns: [
        col("period", t("dashboard.export.period")),
        col("rides", t("dashboard.export.rides")),
        col("completed", t("dashboard.export.completed")),
        col("cancelled", t("dashboard.export.cancelled")),
        col("revenue", t("dashboard.export.revenue")),
        col("commission", t("dashboard.export.commission")),
      ],
      rows: points.map((p) => ({
        period: hourly
          ? `${f.dateShort(`${p.bucket.slice(0, 10)}T12:00:00Z`)} ${p.bucket.slice(11)}:00`
          : f.dateShort(`${p.bucket}T12:00:00Z`),
        rides: p.rides,
        completed: p.completed,
        cancelled: p.cancelled,
        revenue: p.revenueCents / 100,
        commission: p.commissionCents / 100,
      })),
    };
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">{t("nav.items.dashboard")}</h1>
          <p className="text-dense text-muted-foreground">
            {stats.data
              ? t("dashboard.subtitlePeriod", {
                  from: f.dateShort(stats.data.from),
                  to: f.dateShort(stats.data.to),
                })
              : t("dashboard.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter
            label={t("dashboard.period")}
            preset={range}
            from={from}
            to={to}
            allowAny={false}
            onChange={(v) => void setPeriod({ range: v.range, from: v.from, to: v.to })}
          />
          <Can module="dashboard" action="export">
            <ExportButton filename={t("dashboard.exportFile")} getData={getExport} />
          </Can>
        </div>
      </div>

      {stats.isPending ? (
        <KpiGridSkeleton />
      ) : stats.data === undefined ? (
        <KpiGridError error={stats.error} onRetry={() => void stats.refetch()} />
      ) : (
        <KpiGrid
          stats={stats.data}
          period={periodQuery(range, from, to)}
          fetching={stats.isFetching}
        />
      )}

      <div className="grid gap-4 *:min-w-0 lg:grid-cols-2">
        <RidesChartCard query={trends} />
        <RevenueChartCard query={trends} />
      </div>

      <div className="grid gap-4 *:min-w-0 lg:grid-cols-2 xl:grid-cols-3">
        <CategoryChartCard query={categories} />
        {showApprovals && (
          <PendingApprovalsCard
            alerts={alerts}
            pendingDrivers={stats.data?.drivers.pendingVerification}
            statsReady={!stats.isPending}
          />
        )}
        {showAlerts && <OperationalAlertsCard alerts={alerts} />}
      </div>

      <div className="grid gap-4 *:min-w-0 xl:grid-cols-3">
        {canSeeRides && (
          <div className="min-w-0 xl:col-span-2">
            <RecentRidesCard query={recentRides} />
          </div>
        )}
        <div
          className={
            canSeeRides ? "flex min-w-0 flex-col gap-4" : "grid gap-4 xl:col-span-3 xl:grid-cols-2"
          }
        >
          {showRegistrations && <RecentRegistrationsCard query={registrations} />}
          <ShortcutsCard />
        </div>
      </div>
    </div>
  );
}
