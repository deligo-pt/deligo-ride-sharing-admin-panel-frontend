"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import type { SettlementRide } from "@/types/finance";
import { DataTable } from "@/components/data/data-table";
import { usePermission } from "@/components/session/permissions";
import { Badge } from "@/components/ui/badge";
import { useSettlementRides } from "@/hooks/queries/commission";
import { useRouter } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";
import { rateDecimals } from "./commission-utils";

/**
 * The rides inside a settlement (§12 "commission breakdown per ride"): for each
 * completed ride the fare before VAT, the commission rate that was in force
 * when it finished, the commission, and what the driver keeps; cash rides show
 * the cash the driver collected. The totals line adds up all of them and
 * matches the settlement above. A fleet's settlement shows which driver drove.
 */
export function SettlementRides({ id, showDriver }: { id: string; showDriver: boolean }) {
  const t = useTranslations("commission.detail.rides");
  const tAll = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const allowed = usePermission();
  const canOpenRides = allowed("rides", "view");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [sort, setSort] = useState("");
  const query = useSettlementRides(id, { page, pageSize: size, sort: sort || undefined });
  const totals = query.data?.totals;

  const columns = useMemo<ColumnDef<SettlementRide, unknown>[]>(
    () => [
      {
        id: "ride",
        meta: { label: t("columns.ride"), alwaysVisible: true, className: "tabular-nums whitespace-nowrap" },
        header: t("columns.ride"),
        cell: ({ row }) => <span className="font-medium">{row.original.rideId}</span>,
      },
      {
        id: "completedAt",
        enableSorting: true,
        meta: { label: t("columns.date"), className: "whitespace-nowrap" },
        header: t("columns.date"),
        cell: ({ row }) => <span className="text-dense">{f.dateTime(row.original.completedAt)}</span>,
      },
      {
        id: "category",
        meta: { label: t("columns.category") },
        header: t("columns.category"),
        cell: ({ row }) => tAll(`enums.rideCategory.${row.original.category}`),
      },
      ...(showDriver
        ? [
            {
              id: "driver",
              meta: { label: t("columns.driver"), className: "min-w-36" },
              header: t("columns.driver"),
              cell: ({ row }: { row: { original: SettlementRide } }) => <span className="text-dense">{row.original.driverName ?? "—"}</span>,
            } satisfies ColumnDef<SettlementRide, unknown>,
          ]
        : []),
      {
        id: "fareNetCents",
        enableSorting: true,
        meta: { label: t("columns.fare"), className: "text-right tabular-nums whitespace-nowrap" },
        header: t("columns.fare"),
        cell: ({ row }) => f.eur(row.original.fareNetCents),
      },
      {
        id: "rate",
        meta: { label: t("columns.rate"), className: "text-right tabular-nums" },
        header: t("columns.rate"),
        cell: ({ row }) => f.percent(row.original.rate, rateDecimals(row.original.rate)),
      },
      {
        id: "commissionCents",
        enableSorting: true,
        meta: { label: t("columns.commission"), className: "text-right tabular-nums whitespace-nowrap" },
        header: t("columns.commission"),
        cell: ({ row }) => f.eur(row.original.commissionCents),
      },
      {
        id: "earningsCents",
        enableSorting: true,
        meta: { label: t("columns.earnings"), className: "text-right tabular-nums whitespace-nowrap" },
        header: t("columns.earnings"),
        cell: ({ row }) => <span className="font-medium">{f.eur(row.original.earningsCents)}</span>,
      },
      {
        id: "paid",
        meta: { label: t("columns.paid") },
        header: t("columns.paid"),
        cell: ({ row }) =>
          row.original.cashCollectedCents > 0 ? (
            <Badge variant="warning" className="text-micro h-5">
              {t("cashBadge")}
            </Badge>
          ) : (
            <span className="text-dense">{tAll(`enums.paymentMethod.${row.original.method}`)}</span>
          ),
      },
      {
        id: "cash",
        meta: { label: t("columns.cash"), className: "text-right tabular-nums whitespace-nowrap" },
        header: t("columns.cash"),
        cell: ({ row }) => (row.original.cashCollectedCents > 0 ? f.eur(row.original.cashCollectedCents) : <span className="text-caption">—</span>),
      },
    ],
    [t, tAll, f, showDriver],
  );

  return (
    <section className="flex flex-col gap-3" aria-label={t("title")}>
      <div className="flex flex-col gap-1">
        <h2 className="text-card-title">{t("title")}</h2>
        <p className="text-dense text-muted-foreground">{t("intro")}</p>
        {totals && (
          <p className="text-dense tabular font-medium" data-testid="rides-totals">
            {t("totals", {
              count: totals.count,
              fare: f.eur(totals.fareNetCents),
              commission: f.eur(totals.commissionCents),
              earnings: f.eur(totals.earningsCents),
            })}
          </p>
        )}
      </div>
      <DataTable
        tableId={showDriver ? "settlement-rides-fleet" : "settlement-rides"}
        caption={t("title")}
        columns={columns}
        data={query.data}
        isPending={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        sort={sort}
        onSortChange={(v) => (setSort(v), setPage(1))}
        pageSize={size}
        onPageChange={setPage}
        onPageSizeChange={(n) => (setSize(n), setPage(1))}
        getRowId={(r) => r.rideId}
        onOpenRow={canOpenRides ? (r) => router.push(`/rides/${r.rideId}`) : undefined}
        emptyTitle={t("empty")}
        mobileCard={(r) => (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="tabular font-medium">{r.rideId}</span>
              <span className="tabular font-semibold">{f.eur(r.earningsCents)}</span>
            </div>
            <span className="text-caption">
              {f.dateTime(r.completedAt)} · {tAll(`enums.rideCategory.${r.category}`)}
              {showDriver && r.driverName ? ` · ${r.driverName}` : ""}
            </span>
            <span className="text-caption tabular">
              {f.eur(r.fareNetCents)} × {f.percent(r.rate, rateDecimals(r.rate))} = {f.eur(r.commissionCents)}
              {r.cashCollectedCents > 0 ? ` · ${t("cashBadge")} ${f.eur(r.cashCollectedCents)}` : ""}
            </span>
          </div>
        )}
      />
    </section>
  );
}
