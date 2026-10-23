"use client";

import { useMemo, useState } from "react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { CheckCircle2, CircleDollarSign, Eye, Hourglass, Percent, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Settlement, SettlementPayeeType, SettlementStatus } from "@/types/finance";
import { StatusBadge, statusValues } from "@/components/badges/status-badge";
import { DataTable } from "@/components/data/data-table";
import { ExportButton } from "@/components/data/export-button";
import { DateRangeFilter, FilterBar, MultiSelectFilter, SearchInput } from "@/components/data/filter-bar";
import { MetricCard, MetricCardSkeleton } from "@/components/data/metric-card";
import { dateRangeParsers, enumList, useListState } from "@/components/data/use-list-state";
import { Can, usePermission } from "@/components/session/permissions";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useSettlementSummary, useSettlements } from "@/hooks/queries/commission";
import { useRouter } from "@/i18n/navigation";
import { resolveDateRange } from "@/lib/date-range";
import { useFormat } from "@/lib/use-format";
import { exportSettlements } from "@/services/commission";
import { useWeekLabel } from "./commission-utils";
import { useApproveAction } from "./settlement-actions";

/**
 * Settlements (§12): the weekly statements for independent drivers and fleets
 * — gross fares before VAT, commission, cash the driver already collected,
 * manual adjustments and the net to pay — with their status. The cards follow
 * the week filter; a card applies its status filter. Finance (with
 * `payouts.approve`) can select pending settlements and approve them, which
 * creates the SEPA payouts. The export is the financial statement (audited).
 */
const STATUSES = statusValues("settlement");
const PAYEE_TYPES = ["DRIVER", "FLEET"] as const satisfies readonly SettlementPayeeType[];

export function SettlementsTab() {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const allowed = usePermission();
  const canApprove = allowed("payouts", "approve");
  const list = useListState({
    status: enumList(STATUSES),
    payee: enumList(PAYEE_TYPES),
    ...dateRangeParsers,
  });
  const { page, size, q, sort, status, payee, range, from, to } = list.state;
  const [selection, setSelection] = useState<RowSelectionState>({});
  const approve = useApproveAction();
  const week = useWeekLabel();

  const period = resolveDateRange(range, from, to);
  const filters = { q: q || undefined, status, payeeType: payee, ...period };
  const query = useSettlements({ ...filters, sort: sort || undefined, page, pageSize: size });
  const summary = useSettlementSummary(period);
  const s = summary.data;

  const selected = (query.data?.items ?? []).filter((row) => selection[row.id]);
  const hasNonPending = selected.some((row) => row.status !== "PENDING");

  /** A new page or filter starts with nothing selected. */
  const changeFilters = (patch: Parameters<typeof list.setFilters>[0]) => {
    setSelection({});
    list.setFilters(patch);
  };

  const columns = useMemo<ColumnDef<Settlement, unknown>[]>(
    () => [
      {
        id: "id",
        meta: { label: t("commission.columns.id"), alwaysVisible: true, className: "tabular-nums whitespace-nowrap" },
        header: t("commission.columns.id"),
        cell: ({ row }) => <span className="font-medium">{row.original.id}</span>,
      },
      {
        id: "payee",
        meta: { label: t("commission.columns.payee"), className: "min-w-44" },
        header: t("commission.columns.payee"),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="text-dense truncate">{row.original.payeeName}</span>
            <span className="text-caption tabular">
              {t(`commission.payeeType.${row.original.payeeType}`)} · {row.original.payeeId}
            </span>
          </div>
        ),
      },
      {
        id: "periodFrom",
        enableSorting: true,
        meta: { label: t("commission.columns.period"), className: "whitespace-nowrap" },
        header: t("commission.columns.period"),
        cell: ({ row }) => (
          <span className="text-dense">{week(row.original.periodFrom, row.original.periodTo)}</span>
        ),
      },
      {
        id: "rideCount",
        enableSorting: true,
        meta: { label: t("commission.columns.rides"), className: "text-right tabular-nums" },
        header: t("commission.columns.rides"),
        cell: ({ row }) => f.number(row.original.rideCount),
      },
      {
        id: "grossCents",
        enableSorting: true,
        meta: { label: t("commission.columns.gross"), className: "text-right tabular-nums whitespace-nowrap" },
        header: t("commission.columns.gross"),
        cell: ({ row }) => f.eur(row.original.grossCents),
      },
      {
        id: "commissionCents",
        enableSorting: true,
        meta: { label: t("commission.columns.commission"), className: "text-right tabular-nums whitespace-nowrap" },
        header: t("commission.columns.commission"),
        cell: ({ row }) => f.eur(row.original.commissionCents),
      },
      {
        id: "deductions",
        meta: { label: t("commission.columns.deductions"), className: "text-right tabular-nums whitespace-nowrap", defaultHidden: true },
        header: t("commission.columns.deductions"),
        cell: ({ row }) => f.eur(row.original.deductionsCents),
      },
      {
        id: "adjustments",
        meta: { label: t("commission.columns.adjustments"), className: "text-right tabular-nums whitespace-nowrap" },
        header: t("commission.columns.adjustments"),
        cell: ({ row }) =>
          row.original.adjustmentsCents ? (
            <span className={row.original.adjustmentsCents < 0 ? "text-destructive" : "text-success"}>
              {row.original.adjustmentsCents > 0 ? "+" : ""}
              {f.eur(row.original.adjustmentsCents)}
            </span>
          ) : (
            <span className="text-caption">—</span>
          ),
      },
      {
        id: "netCents",
        enableSorting: true,
        meta: { label: t("commission.columns.net"), className: "text-right tabular-nums whitespace-nowrap" },
        header: t("commission.columns.net"),
        cell: ({ row }) => <span className="font-semibold">{f.eur(row.original.netCents)}</span>,
      },
      {
        id: "status",
        meta: { label: t("commission.columns.status") },
        header: t("commission.columns.status"),
        cell: ({ row }) => <StatusBadge kind="settlement" value={row.original.status} />,
      },
    ],
    [t, f, week],
  );

  const getExport = async () => {
    const rows = await exportSettlements({ ...filters, sort: sort || undefined });
    const col = (key: string, label: string) => ({ key, label });
    return {
      columns: [
        col("id", t("commission.columns.id")),
        col("payee", t("commission.columns.payee")),
        col("payeeType", t("commission.export.payeeType")),
        col("payeeId", t("commission.export.payeeId")),
        col("from", t("commission.export.from")),
        col("to", t("commission.export.to")),
        col("rides", t("commission.columns.rides")),
        col("gross", t("commission.columns.gross")),
        col("commission", t("commission.columns.commission")),
        col("deductions", t("commission.columns.deductions")),
        col("adjustments", t("commission.columns.adjustments")),
        col("net", t("commission.columns.net")),
        col("status", t("commission.columns.status")),
      ],
      rows: rows.map((r) => ({
        id: r.id,
        payee: r.payeeName,
        payeeType: t(`commission.payeeType.${r.payeeType}`),
        payeeId: r.payeeId,
        from: f.dateShort(r.periodFrom),
        to: f.dateShort(r.periodTo),
        rides: r.rideCount,
        gross: r.grossCents / 100,
        commission: r.commissionCents / 100,
        deductions: r.deductionsCents / 100,
        adjustments: (r.adjustmentsCents ?? 0) / 100,
        net: r.netCents / 100,
        status: t(`status.settlement.${r.status}`),
      })),
    };
  };

  const filterStatus = (value: SettlementStatus[]) => changeFilters({ status: value });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {s ? (
          <>
            <MetricCard
              icon={Hourglass}
              tone={s.pendingCount > 0 ? "warning" : "default"}
              label={t("commission.kpi.pending")}
              value={f.number(s.pendingCount)}
              sub={t("commission.kpi.pendingSub", { count: s.pendingCount, amount: f.eur(s.pendingNetCents) })}
              onClick={() => filterStatus(["PENDING"])}
            />
            <MetricCard
              icon={CircleDollarSign}
              label={t("commission.kpi.processing")}
              value={f.number(s.processingCount)}
              sub={t("commission.kpi.processingSub", { count: s.processingCount })}
              onClick={() => filterStatus(["PROCESSING"])}
            />
            <MetricCard
              icon={CheckCircle2}
              tone="success"
              label={t("commission.kpi.completed")}
              value={f.eur(s.completedNetCents, { compact: true })}
              sub={t("commission.kpi.completedSub", { count: s.completedCount })}
              onClick={() => filterStatus(["COMPLETED"])}
            />
            <MetricCard
              icon={XCircle}
              tone={s.failedCount > 0 ? "danger" : "default"}
              label={t("commission.kpi.failed")}
              value={f.number(s.failedCount)}
              sub={t("commission.kpi.failedSub")}
              onClick={() => filterStatus(["FAILED"])}
            />
            <MetricCard
              icon={Percent}
              label={t("commission.kpi.commission")}
              value={f.eur(s.commissionCents, { compact: true })}
              sub={t("commission.kpi.commissionSub", {
                share: f.percent(s.grossCents > 0 ? s.commissionCents / s.grossCents : 0, 1),
                gross: f.eur(s.grossCents, { compact: true }),
              })}
            />
          </>
        ) : (
          Array.from({ length: 5 }, (_, i) => <MetricCardSkeleton key={i} />)
        )}
      </div>

      <FilterBar
        hasFilters={list.hasFilters}
        onClear={() => (setSelection({}), list.clearFilters())}
        actions={
          <Can module="commission" action="export">
            <ExportButton filename={t("commission.exportFile")} getData={getExport} />
          </Can>
        }
      >
        <SearchInput value={q} onChange={(v) => changeFilters({ q: v })} placeholder={t("commission.searchPlaceholder")} />
        <MultiSelectFilter
          label={t("commission.filters.status")}
          options={STATUSES.map((v) => ({ value: v, label: t(`status.settlement.${v}`) }))}
          value={status}
          onChange={(v) => changeFilters({ status: v })}
        />
        <MultiSelectFilter
          label={t("commission.filters.payee")}
          options={PAYEE_TYPES.map((v) => ({ value: v, label: t(`commission.payeeType.${v}`) }))}
          value={payee}
          onChange={(v) => changeFilters({ payee: v })}
        />
        <DateRangeFilter label={t("commission.filters.date")} preset={range} from={from} to={to} onChange={(v) => changeFilters(v)} />
      </FilterBar>

      {canApprove && selected.length > 0 && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border bg-accent/40 px-3 py-2">
          <span className="text-dense font-medium">{t("commission.approve.selected", { count: selected.length })}</span>
          {hasNonPending && <span className="text-caption">{t("commission.approve.onlyPending")}</span>}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelection({})}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" disabled={hasNonPending} onClick={() => approve.open(selected)}>
              <CheckCircle2 />
              {t("commission.approve.button")}
            </Button>
          </div>
        </div>
      )}

      <DataTable
        tableId="settlements"
        caption={t("commission.title")}
        columns={columns}
        data={query.data}
        isPending={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        sort={sort}
        onSortChange={(v) => list.set({ sort: v || null, page: null })}
        pageSize={size}
        onPageChange={(p) => (setSelection({}), list.set({ page: p }))}
        onPageSizeChange={(n) => (setSelection({}), list.set({ size: n, page: null }))}
        getRowId={(r) => r.id}
        onOpenRow={(r) => router.push(`/commission/${r.id}`)}
        selection={canApprove ? selection : undefined}
        onSelectionChange={canApprove ? setSelection : undefined}
        filtered={list.hasFilters}
        onClearFilters={list.clearFilters}
        emptyTitle={t("commission.empty")}
        rowActions={(r) => (
          <>
            <DropdownMenuItem onSelect={() => router.push(`/commission/${r.id}`)}>
              <Eye />
              {t("commission.actions.view")}
            </DropdownMenuItem>
            {canApprove && r.status === "PENDING" && (
              <DropdownMenuItem onSelect={() => approve.open([r])}>
                <CheckCircle2 />
                {t("commission.actions.approve")}
              </DropdownMenuItem>
            )}
          </>
        )}
        mobileCard={(r) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="tabular font-medium">{r.id}</span>
              <StatusBadge kind="settlement" value={r.status} />
            </div>
            <span className="text-dense truncate">{r.payeeName}</span>
            <span className="text-caption">
              {t(`commission.payeeType.${r.payeeType}`)} · {week(r.periodFrom, r.periodTo)} ·{" "}
              {t("commission.columns.rides")} {r.rideCount}
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-caption tabular">
                {f.eur(r.grossCents)} − {f.eur(r.commissionCents)}
              </span>
              <span className="tabular text-base font-semibold">{f.eur(r.netCents)}</span>
            </div>
          </div>
        )}
      />
      {approve.dialog}
    </div>
  );
}
