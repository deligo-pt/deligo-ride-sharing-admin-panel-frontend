"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { EarningsChart } from "@/components/charts/lazy-charts";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useFleetPerformance } from "@/hooks/queries/fleet";
import { resolveDateRange, resolveLastDays } from "@/lib/date-range";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

const PERIODS = ["7d", "30d", "90d"] as const;
type Period = (typeof PERIODS)[number];

/**
 * Performance (§7 "review operational performance"): rides and money over a
 * period, a daily chart, and how healthy the fleet's drivers and vehicles
 * are. Figures come from the same settled rides as the Commission module.
 */
export function FleetPerformanceTab({ fleetId }: { fleetId: string }) {
  const t = useTranslations("fleet.performance");
  const f = useFormat();
  const [period, setPeriod] = useState<Period>("30d");
  // Recomputed only when the period changes, so the query key stays stable.
  const range = useMemo(
    () => (period === "90d" ? resolveLastDays(90) : resolveDateRange(period)),
    [period],
  );
  const query = useFleetPerformance(fleetId, range);
  const p = query.data;

  const cards = p
    ? [
        {
          label: t("rides"),
          value: f.number(p.rides),
          hint: t("ridesHint", {
            completed: f.number(p.completed),
            cancelled: f.number(p.cancelled),
          }),
        },
        {
          label: t("completionRate"),
          value: p.rides ? f.percent(p.completed / p.rides, 0) : "—",
          hint: t("completionHint"),
        },
        { label: t("gross"), value: f.eur(p.grossCents), hint: t("grossHint") },
        {
          label: t("commission"),
          value: f.eur(p.commissionCents),
          hint: t("commissionHint", { net: f.eur(p.grossCents - p.commissionCents) }),
        },
      ]
    : [];
  const health = p
    ? [
        {
          title: t("driversTitle"),
          lines: [
            [t("driversTotal"), f.number(p.drivers.total)],
            [t("driversApproved"), f.number(p.drivers.approved)],
            [t("driversOnline"), f.number(p.drivers.online)],
            [
              t("driversRating"),
              p.drivers.total ? `${f.number(p.drivers.averageRating, { decimals: 1 })} / 5` : "—",
            ],
          ],
        },
        {
          title: t("vehiclesTitle"),
          lines: [
            [t("vehiclesTotal"), f.number(p.vehicles.total)],
            [t("vehiclesApproved"), f.number(p.vehicles.approved)],
            [t("vehiclesPending"), f.number(p.vehicles.pendingReview)],
            [t("vehiclesExpiring"), f.number(p.vehicles.documentsExpiring)],
          ],
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-card-title">{t("title")}</h2>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-44" aria-label={t("period")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`periods.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : !p ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} className="py-8" />
        </Card>
      ) : (
        <div
          className={cn("flex flex-col gap-4 transition-opacity", query.isFetching && "opacity-60")}
        >
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((c) => (
              <Card key={c.label} size="sm">
                <CardContent className="flex flex-col gap-1">
                  <dt className="text-dense text-muted-foreground">{c.label}</dt>
                  <dd className="tabular text-2xl font-bold tracking-tight">{c.value}</dd>
                  <dd className="text-caption">{c.hint}</dd>
                </CardContent>
              </Card>
            ))}
          </dl>
          <Card>
            <CardHeader>
              <CardTitle className="text-card-title">{t("chartTitle")}</CardTitle>
              <CardDescription>{t("chartDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              {p.daily.length === 0 ? (
                <EmptyState title={t("emptyTitle")} description={t("emptyBody")} className="py-6" />
              ) : (
                <div role="img" aria-label={t("chartLabel")} className="size-full">
                  <EarningsChart points={p.daily} />
                </div>
              )}
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            {health.map((group) => (
              <Card key={group.title}>
                <CardHeader>
                  <CardTitle className="text-card-title">{group.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-2 gap-4">
                    {group.lines.map(([label, value]) => (
                      <div key={label} className="flex flex-col gap-1">
                        <dt className="text-caption">{label}</dt>
                        <dd className="tabular text-lg font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
