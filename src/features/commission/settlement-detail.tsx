"use client";

import { Banknote, CheckCircle2, CircleDollarSign, ExternalLink, Percent, SlidersHorizontal, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Settlement } from "@/types/finance";
import { StatusBadge } from "@/components/badges/status-badge";
import { ExportButton, type ExportCell, type ExportTable } from "@/components/data/export-button";
import { MetricCard } from "@/components/data/metric-card";
import { DetailHeader, KeyValueGrid } from "@/components/detail/detail-parts";
import { DetailSkeleton, EmptyState, ErrorState } from "@/components/feedback/states";
import { Can, usePermission } from "@/components/session/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePayout } from "@/hooks/queries/payouts";
import { useSettlement } from "@/hooks/queries/commission";
import { Link, useRouter } from "@/i18n/navigation";
import { isServiceError } from "@/lib/service-error";
import { useFormat } from "@/lib/use-format";
import { exportSettlementStatement } from "@/services/commission";
import { rateDecimals, useWeekLabel } from "./commission-utils";
import { SettlementRides } from "./settlement-rides";
import { useAdjustAction, useApproveAction } from "./settlement-actions";

/**
 * One settlement (§12): the figures it is made of (gross fares before VAT −
 * commission − cash already collected ± manual adjustments = net to pay), who it
 * is for, its payout, the adjustments with their reasons, and every ride with
 * its commission. While it is pending, Finance can adjust it and approve it;
 * the statement export lists the rides and the totals.
 */
export function SettlementDetailView({ id }: { id: string }) {
  const t = useTranslations("commission.detail");
  const tAll = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const allowed = usePermission();
  const query = useSettlement(id);
  const approve = useApproveAction();
  const adjust = useAdjustAction();
  const week = useWeekLabel();

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) {
    if (isServiceError(query.error) && query.error.code === "NOT_FOUND") {
      return (
        <EmptyState
          icon={Wallet}
          title={t("notFound")}
          action={
            <Button variant="outline" size="sm" onClick={() => router.push("/commission")}>
              {t("backToList")}
            </Button>
          }
        />
      );
    }
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  const s = query.data;
  const pending = s.status === "PENDING";
  const adjustments = s.adjustmentsCents ?? 0;
  const averageRate = s.grossCents > 0 ? s.commissionCents / s.grossCents : 0;
  const payeeHref = s.payeeType === "DRIVER" ? (`/drivers/${s.payeeId}` as const) : (`/fleet-managers/${s.payeeId}` as const);
  const canOpenPayee = allowed(s.payeeType === "DRIVER" ? "drivers" : "fleet", "view");

  const getStatement = async (): Promise<ExportTable> => {
    const { settlement, rides } = await exportSettlementStatement(id);
    const col = (key: string, label: string) => ({ key, label });
    const rows: Record<string, ExportCell>[] = [
      ...rides.map((r) => ({
        ride: r.rideId,
        date: f.dateTime(r.completedAt),
        category: tAll(`enums.rideCategory.${r.category}`),
        driver: r.driverName ?? "",
        fare: r.fareNetCents / 100,
        rate: f.percent(r.rate, rateDecimals(r.rate)),
        commission: r.commissionCents / 100,
        earnings: r.earningsCents / 100,
        paid: tAll(`enums.paymentMethod.${r.method}`),
        cash: r.cashCollectedCents / 100,
      })),
      {
        ride: t("statement.total"),
        fare: settlement.grossCents / 100,
        commission: settlement.commissionCents / 100,
        earnings: (settlement.grossCents - settlement.commissionCents) / 100,
        cash: settlement.deductionsCents / 100,
      },
      { ride: t("statement.adjustments"), earnings: (settlement.adjustmentsCents ?? 0) / 100 },
      { ride: t("statement.net"), earnings: settlement.netCents / 100 },
    ];
    return {
      columns: [
        col("ride", t("rides.columns.ride")),
        col("date", t("rides.columns.date")),
        col("category", t("rides.columns.category")),
        col("driver", t("rides.columns.driver")),
        col("fare", t("rides.columns.fare")),
        col("rate", t("rides.columns.rate")),
        col("commission", t("rides.columns.commission")),
        col("earnings", t("rides.columns.earnings")),
        col("paid", t("rides.columns.paid")),
        col("cash", t("rides.columns.cash")),
      ],
      rows,
    };
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <DetailHeader
          backHref="/commission"
          backLabel={t("back")}
          title={t("title", { id: s.id })}
          subtitle={`${s.payeeName} · ${week(s.periodFrom, s.periodTo)}`}
          badges={<StatusBadge kind="settlement" value={s.status} />}
          actions={
            <>
              <Can module="commission" action="export">
                <ExportButton filename={`${t("statementFile")}-${s.id}`} getData={getStatement} />
              </Can>
              <Can module="commission" action="edit">
                {pending && (
                  <Button variant="outline" size="sm" onClick={() => adjust.open(s)}>
                    <SlidersHorizontal />
                    {t("adjustments.add")}
                  </Button>
                )}
              </Can>
              <Can module="payouts" action="approve">
                {pending && (
                  <Button size="sm" onClick={() => approve.open([s])}>
                    <CheckCircle2 />
                    {t("approve")}
                  </Button>
                )}
              </Can>
            </>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={CircleDollarSign} label={t("summary.gross")} value={f.eur(s.grossCents)} sub={t("summary.grossHint")} />
          <MetricCard
            icon={Percent}
            label={t("summary.commission")}
            value={f.eur(s.commissionCents)}
            sub={t("summary.commissionHint", { rate: f.percent(averageRate, 1) })}
          />
          <MetricCard icon={Banknote} label={t("summary.deductions")} value={f.eur(s.deductionsCents)} sub={t("summary.deductionsHint")} />
          <MetricCard
            icon={SlidersHorizontal}
            tone={adjustments < 0 ? "danger" : adjustments > 0 ? "success" : "default"}
            label={t("summary.adjustments")}
            value={`${adjustments > 0 ? "+" : ""}${f.eur(adjustments)}`}
            sub={t("summary.adjustmentsHint")}
          />
          <MetricCard icon={Wallet} tone="success" label={t("summary.net")} value={f.eur(s.netCents)} sub={t("summary.netHint")} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-card-title">{t("payee")}</CardTitle>
            </CardHeader>
            <CardContent>
              <KeyValueGrid
                columns={1}
                items={[
                  {
                    label: t("payee"),
                    value: canOpenPayee ? (
                      <Link href={payeeHref} className="inline-flex items-center gap-1 text-primary hover:underline">
                        {s.payeeName}
                        <ExternalLink aria-hidden className="size-3" />
                        <span className="sr-only">{t("openPayee", { name: s.payeeName })}</span>
                      </Link>
                    ) : (
                      s.payeeName
                    ),
                  },
                  { label: t("payeeType"), value: `${tAll(`commission.payeeType.${s.payeeType}`)} · ${s.payeeId}` },
                  { label: t("week"), value: week(s.periodFrom, s.periodTo) },
                  { label: t("createdAt"), value: f.dateTime(s.createdAt) },
                ]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-card-title">{t("payout.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <PayoutPanel settlement={s} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-card-title">{t("adjustments.title")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {s.adjustments?.length ? (
                <ul className="flex flex-col divide-y rounded-lg border">
                  {s.adjustments.map((a) => (
                    <li key={a.id} className="flex flex-col gap-0.5 px-3 py-2">
                      <span className={`tabular text-dense font-semibold ${a.amountCents < 0 ? "text-destructive" : "text-success"}`}>
                        {a.amountCents > 0 ? "+" : ""}
                        {f.eur(a.amountCents)}
                      </span>
                      <span className="text-dense">{a.reason}</span>
                      <span className="text-caption">{t("adjustments.by", { name: a.adminName ?? a.adminId, date: f.dateTime(a.createdAt) })}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-dense text-muted-foreground">{t("adjustments.empty")}</p>
              )}
              {!pending && <p className="text-caption">{t("adjustments.onlyPending")}</p>}
            </CardContent>
          </Card>
        </div>

        <SettlementRides id={s.id} showDriver={s.payeeType === "FLEET"} />
      </div>
      {approve.dialog}
      {adjust.dialog}
    </>
  );
}

/** The payout this settlement produced (needs `payouts.view` for the details). */
function PayoutPanel({ settlement: s }: { settlement: Settlement }) {
  const t = useTranslations("commission.detail.payout");
  const allowed = usePermission();
  if (!s.payoutId) {
    return <p className="text-dense text-muted-foreground">{s.status !== "PENDING" || s.netCents <= 0 ? t("noNet") : t("none")}</p>;
  }
  return allowed("payouts", "view") ? <PayoutDetails id={s.payoutId} /> : <p className="tabular text-dense">{s.payoutId}</p>;
}

function PayoutDetails({ id }: { id: string }) {
  const t = useTranslations("commission.detail.payout");
  const f = useFormat();
  const query = usePayout(id);
  if (query.isPending) return <Skeleton className="h-24 w-full" />;
  if (query.isError) return <p className="tabular text-dense">{id}</p>;
  const p = query.data;
  return (
    <KeyValueGrid
      columns={1}
      items={[
        { label: "ID", value: <span className="tabular">{p.id}</span> },
        { label: t("amount"), value: f.eur(p.amountCents) },
        { label: t("statusLabel"), value: <StatusBadge kind="payout" value={p.status} /> },
        { label: t("reference"), value: p.reference ? <span className="tabular">{p.reference}</span> : null },
        ...(p.failureReason ? [{ label: "", value: <span className="text-destructive">{p.failureReason}</span> }] : []),
      ]}
    />
  );
}
