"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock, Plus, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { CommissionRuleView } from "@/types/finance";
import type { RideCategory } from "@/types/vehicle";
import { StatusBadge } from "@/components/badges/status-badge";
import { DataTable } from "@/components/data/data-table";
import { SingleSelectFilter } from "@/components/data/filter-bar";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { ErrorState } from "@/components/feedback/states";
import { Can } from "@/components/session/permissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommissionRules } from "@/hooks/queries/commission";
import { useFormat } from "@/lib/use-format";
import { EXAMPLE_FARE_CENTS, RIDE_CATEGORIES, rateDecimals } from "./commission-utils";
import { useRateAction, useWithdrawAction } from "./rate-dialogs";

/**
 * Commission rates (§12): the percentage of the fare (before VAT) the platform
 * keeps, per ride category. A card per category shows the rate in force, what
 * it means on a sample fare and any change already scheduled; below is the
 * whole history — who set each rate, from when and why. New rates and
 * withdrawals need `commission.edit`; past rides and settlements keep the rate
 * they were made with.
 */
export function RatesTab() {
  const t = useTranslations("commission.rates");
  const tAll = useTranslations();
  const f = useFormat();
  const query = useCommissionRules();
  const rules = query.data;
  const rate = useRateAction(rules);
  const withdraw = useWithdrawAction(rules);
  const [category, setCategory] = useState<RideCategory | null>(null);

  const pct = (r: number) => f.percent(r, rateDecimals(r));
  const history = useMemo(() => (rules ?? []).filter((r) => !category || r.category === category), [rules, category]);

  const columns = useMemo<ColumnDef<CommissionRuleView, unknown>[]>(
    () => [
      {
        id: "category",
        meta: { label: t("columns.category"), alwaysVisible: true },
        header: t("columns.category"),
        cell: ({ row }) => tAll(`enums.rideCategory.${row.original.category}`),
      },
      {
        id: "rate",
        meta: { label: t("columns.rate"), className: "text-right tabular-nums" },
        header: t("columns.rate"),
        cell: ({ row }) => <span className="font-semibold">{pct(row.original.rate)}</span>,
      },
      {
        id: "from",
        meta: { label: t("columns.from"), className: "whitespace-nowrap" },
        header: t("columns.from"),
        cell: ({ row }) => f.date(row.original.effectiveFrom),
      },
      {
        id: "to",
        meta: { label: t("columns.to"), className: "whitespace-nowrap" },
        header: t("columns.to"),
        cell: ({ row }) =>
          row.original.effectiveTo && row.original.status !== "WITHDRAWN" ? f.date(row.original.effectiveTo) : <span className="text-caption">{t("open")}</span>,
      },
      {
        id: "status",
        meta: { label: t("columns.status") },
        header: t("columns.status"),
        cell: ({ row }) => <StatusBadge kind="commissionRule" value={row.original.status} />,
      },
      {
        id: "by",
        meta: { label: t("columns.by"), className: "min-w-40" },
        header: t("columns.by"),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="text-dense">{row.original.createdByName}</span>
            <span className="text-caption">{f.date(row.original.createdAt)}</span>
          </div>
        ),
      },
      {
        id: "reason",
        meta: { label: t("columns.reason"), className: "min-w-56 max-w-80" },
        header: t("columns.reason"),
        cell: ({ row }) => <span className="text-dense">{row.original.reason ?? t("noReason")}</span>,
      },
    ],
    // `pct` only reads `f`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, tAll, f],
  );

  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-dense max-w-3xl text-muted-foreground">{t("intro")}</p>
        <Can module="commission" action="edit">
          <Button size="sm" onClick={() => rate.open()}>
            <Plus />
            {t("newRate")}
          </Button>
        </Can>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {!rules
          ? RIDE_CATEGORIES.map((c) => <Skeleton key={c} className="h-56 rounded-xl" />)
          : RIDE_CATEGORIES.map((c) => {
              const current = rules.find((r) => r.category === c && r.status === "ACTIVE");
              const next = rules.find((r) => r.category === c && r.status === "SCHEDULED");
              const kept = current ? Math.round(EXAMPLE_FARE_CENTS * current.rate) : 0;
              return (
                <Card key={c} className="gap-3 px-4" data-category={c}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-card-title">{tAll(`enums.rideCategory.${c}`)}</h3>
                    <StatusBadge kind="commissionRule" value="ACTIVE" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-caption">{t("inForce")}</p>
                    <p className="tabular text-4xl font-bold tracking-tight" data-testid={`rate-${c}`}>
                      {current ? pct(current.rate) : "—"}
                    </p>
                    {current && <p className="text-caption">{t("since", { date: f.date(current.effectiveFrom) })}</p>}
                  </div>
                  {current && (
                    <p className="text-dense text-muted-foreground">
                      {t("example", {
                        fare: f.eur(EXAMPLE_FARE_CENTS),
                        commission: f.eur(kept),
                        earnings: f.eur(EXAMPLE_FARE_CENTS - kept),
                      })}
                    </p>
                  )}
                  {next && (
                    <InlineAlert tone="info">
                      <span className="flex items-center gap-1.5 font-medium">
                        <CalendarClock aria-hidden className="size-3.5" />
                        {t("scheduled", { date: f.date(next.effectiveFrom), rate: pct(next.rate) })}
                      </span>
                    </InlineAlert>
                  )}
                  <Can module="commission" action="edit">
                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      <Button variant="outline" size="sm" disabled={!!next} onClick={() => rate.open(c)}>
                        {t("change")}
                      </Button>
                      {next && (
                        <Button variant="ghost" size="sm" onClick={() => withdraw.open(next)}>
                          <Undo2 />
                          {t("withdraw")}
                        </Button>
                      )}
                    </div>
                  </Can>
                </Card>
              );
            })}
      </div>

      <section className="flex flex-col gap-3" aria-label={t("history")}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-card-title">{t("history")}</h2>
          <SingleSelectFilter
            label={t("filterCategory")}
            options={RIDE_CATEGORIES.map((c) => ({ value: c, label: tAll(`enums.rideCategory.${c}`) }))}
            value={category}
            onChange={(v) => setCategory(v as RideCategory | null)}
          />
        </div>
        <DataTable
          tableId="commission-rules"
          caption={t("history")}
          columns={columns}
          data={rules && { items: history, page: 1, pageSize: Math.max(history.length, 25), total: history.length }}
          isPending={query.isPending}
          isFetching={query.isFetching}
          sort=""
          onSortChange={() => {}}
          pageSize={Math.max(history.length, 25)}
          onPageChange={() => {}}
          onPageSizeChange={() => {}}
          getRowId={(r) => r.id}
          emptyTitle={t("empty")}
          mobileCard={(r) => (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {tAll(`enums.rideCategory.${r.category}`)} · {pct(r.rate)}
                </span>
                <StatusBadge kind="commissionRule" value={r.status} />
              </div>
              <span className="text-caption">
                {f.date(r.effectiveFrom)} – {r.effectiveTo && r.status !== "WITHDRAWN" ? f.date(r.effectiveTo) : t("open")}
              </span>
              <span className="text-caption">
                {r.createdByName}
                {r.reason ? ` · ${r.reason}` : ""}
              </span>
            </div>
          )}
        />
      </section>
      {rate.dialog}
      {withdraw.dialog}
    </div>
  );
}
