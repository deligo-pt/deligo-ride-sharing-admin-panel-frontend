"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { EarningsChart } from "@/components/charts/lazy-charts";
import { PayeePayouts } from "@/components/detail/payee-payouts";
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
import { useDriverEarnings } from "@/hooks/queries/drivers";
import { resolveDateRange, resolveLastDays } from "@/lib/date-range";
import { useFormat } from "@/lib/use-format";

const PERIODS = ["7d", "30d", "90d"] as const;
type Period = (typeof PERIODS)[number];

/**
 * Earnings & payouts (§6, §13): gross (fares before VAT), the commission the
 * platform kept, cash the driver already collected, the net owed, a daily
 * chart, and the bank transfers. Figures come from the same settled rides as
 * the Commission and Payouts modules.
 */
export function DriverEarningsTab({ driverId }: { driverId: string }) {
  const t = useTranslations("drivers.earnings");
  const f = useFormat();
  const [period, setPeriod] = useState<Period>("30d");
  // Recomputed only when the period changes, so the query key stays stable.
  const range = useMemo(
    () => (period === "90d" ? resolveLastDays(90) : resolveDateRange(period)),
    [period],
  );
  const earnings = useDriverEarnings(driverId, range.from ?? "", range.to ?? "");

  const cards = earnings.data
    ? [
        { label: t("gross"), value: f.eur(earnings.data.grossCents), hint: t("grossHint") },
        {
          label: t("commission"),
          value: f.eur(earnings.data.commissionCents),
          hint: t("commissionHint"),
        },
        {
          label: t("deductions"),
          value: f.eur(earnings.data.deductionsCents),
          hint: t("deductionsHint"),
        },
        {
          label: t("net"),
          value: f.eur(earnings.data.netCents),
          hint: t("netHint", { count: earnings.data.rideCount }),
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
            {PERIODS.map((p) => (
              <SelectItem key={p} value={p}>
                {t(`periods.${p}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {earnings.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : earnings.isError ? (
        <Card>
          <ErrorState
            error={earnings.error}
            onRetry={() => void earnings.refetch()}
            className="py-8"
          />
        </Card>
      ) : (
        <>
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
              {earnings.data.daily.length === 0 ? (
                <EmptyState title={t("emptyTitle")} description={t("emptyBody")} className="py-6" />
              ) : (
                <div role="img" aria-label={t("chartLabel")} className="size-full">
                  <EarningsChart points={earnings.data.daily} />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <section className="flex flex-col gap-3" aria-label={t("payoutsTitle")}>
        <h2 className="text-card-title">{t("payoutsTitle")}</h2>
        <PayeePayouts payeeId={driverId} caption={t("payoutsTitle")} />
      </section>
    </div>
  );
}
