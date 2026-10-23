"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CircleDollarSign, Eye, GitCompare, Hourglass, Undo2, Wallet, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { RECONCILIATION_STATES, type PaymentListItem } from "@/types/payment";
import { StatusBadge } from "@/components/badges/status-badge";
import { DataTable } from "@/components/data/data-table";
import { ExportButton } from "@/components/data/export-button";
import { DateRangeFilter, FilterBar, MultiSelectFilter, SearchInput } from "@/components/data/filter-bar";
import { dateRangeParsers, enumList, useListState } from "@/components/data/use-list-state";
import { Can, usePermission } from "@/components/session/permissions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { usePaymentSummary, usePayments } from "@/hooks/queries/payments";
import { resolveDateRange } from "@/lib/date-range";
import { useFormat } from "@/lib/use-format";
import { exportPayments } from "@/services/payments";
import { MetricCard, MetricCardSkeleton } from "@/components/data/metric-card";
import { PAYMENT_METHODS, PAYMENT_STATUSES, refundBlock } from "./payment-utils";

/**
 * Transactions (§12): every payment with the nine fields the requirements ask
 * for — transaction ID, ride, customer, amount, method, date, status, refund
 * status and gateway reference — filtered by status, method, date and gateway
 * match, searchable, sortable and exportable. The cards above follow the date
 * range; failed, in-progress and refunded open that filter, and "needs review"
 * opens the reconciliation tab. Everything is in the URL.
 */
export function TransactionsTab({
  onOpen,
  onRefund,
  onGoReconciliation,
}: {
  onOpen: (id: string) => void;
  onRefund: (payment: PaymentListItem) => void;
  onGoReconciliation: () => void;
}) {
  const t = useTranslations();
  const f = useFormat();
  const allowed = usePermission();
  const list = useListState({
    status: enumList(PAYMENT_STATUSES),
    method: enumList(PAYMENT_METHODS),
    match: enumList(RECONCILIATION_STATES),
    ...dateRangeParsers,
  });
  const { page, size, q, sort, status, method, match, range, from, to } = list.state;

  const period = resolveDateRange(range, from, to);
  const filters = { q: q || undefined, status, method, reconciliation: match, ...period };
  const query = usePayments({ ...filters, sort: sort || undefined, page, pageSize: size });
  const summary = usePaymentSummary(period);
  const s = summary.data;
  const share = (part: number, whole: number) => f.percent(whole > 0 ? part / whole : 0, 1);

  const columns = useMemo<ColumnDef<PaymentListItem, unknown>[]>(
    () => [
      {
        id: "id",
        meta: { label: t("payments.columns.id"), alwaysVisible: true, className: "tabular-nums whitespace-nowrap" },
        header: t("payments.columns.id"),
        cell: ({ row }) => <span className="font-medium">{row.original.id}</span>,
      },
      {
        id: "ride",
        meta: { label: t("payments.columns.ride"), className: "tabular-nums whitespace-nowrap" },
        header: t("payments.columns.ride"),
        cell: ({ row }) => row.original.rideId,
      },
      {
        id: "customer",
        meta: { label: t("payments.columns.customer"), className: "min-w-40" },
        header: t("payments.columns.customer"),
        cell: ({ row }) => <span className="text-dense">{row.original.customerName}</span>,
      },
      {
        id: "amountCents",
        enableSorting: true,
        meta: { label: t("payments.columns.amount"), className: "text-right tabular-nums whitespace-nowrap" },
        header: t("payments.columns.amount"),
        cell: ({ row }) => <span className="font-medium">{f.eur(row.original.amountCents)}</span>,
      },
      {
        id: "method",
        meta: { label: t("payments.columns.method"), className: "min-w-32" },
        header: t("payments.columns.method"),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="text-dense">{t(`enums.paymentMethod.${row.original.method}`)}</span>
            {row.original.methodDetail && <span className="text-caption truncate">{row.original.methodDetail}</span>}
          </div>
        ),
      },
      {
        id: "createdAt",
        enableSorting: true,
        meta: { label: t("payments.columns.date"), className: "whitespace-nowrap" },
        header: t("payments.columns.date"),
        cell: ({ row }) => <span className="text-dense">{f.dateTime(row.original.createdAt)}</span>,
      },
      {
        id: "status",
        meta: { label: t("payments.columns.status") },
        header: t("payments.columns.status"),
        cell: ({ row }) => <StatusBadge kind="payment" value={row.original.status} />,
      },
      {
        id: "refundedCents",
        enableSorting: true,
        meta: { label: t("payments.columns.refund"), className: "text-right tabular-nums whitespace-nowrap" },
        header: t("payments.columns.refund"),
        cell: ({ row }) =>
          row.original.refundedCents > 0 ? (
            <span className="text-dense">
              {t("payments.refundOf", { refunded: f.eur(row.original.refundedCents), total: f.eur(row.original.amountCents) })}
            </span>
          ) : (
            <span className="text-caption">—</span>
          ),
      },
      {
        id: "reference",
        meta: { label: t("payments.columns.reference"), className: "tabular-nums whitespace-nowrap" },
        header: t("payments.columns.reference"),
        cell: ({ row }) =>
          row.original.gatewayRef ? (
            <span className="text-caption">{row.original.gatewayRef}</span>
          ) : (
            <span className="text-caption">—</span>
          ),
      },
      {
        id: "match",
        meta: { label: t("payments.columns.match"), defaultHidden: true },
        header: t("payments.columns.match"),
        cell: ({ row }) => <StatusBadge kind="reconciliation" value={row.original.reconciliation} />,
      },
    ],
    [t, f],
  );

  const getExport = async () => {
    const rows = await exportPayments({ ...filters, sort: sort || undefined });
    const col = (key: string, label: string) => ({ key, label });
    return {
      columns: [
        col("id", t("payments.columns.id")),
        col("ride", t("payments.columns.ride")),
        col("customer", t("payments.columns.customer")),
        col("amount", t("payments.columns.amount")),
        col("method", t("payments.columns.method")),
        col("date", t("payments.columns.date")),
        col("status", t("payments.columns.status")),
        col("refunded", t("payments.export.refunded")),
        col("reference", t("payments.columns.reference")),
        col("match", t("payments.columns.match")),
        col("failure", t("payments.export.failure")),
      ],
      rows: rows.map((p) => ({
        id: p.id,
        ride: p.rideId,
        customer: p.customerName,
        amount: p.amountCents / 100,
        method: p.methodDetail ?? t(`enums.paymentMethod.${p.method}`),
        date: f.dateTime(p.createdAt),
        status: t(`status.payment.${p.status}`),
        refunded: p.refundedCents / 100,
        reference: p.gatewayRef ?? "",
        match: t(`status.reconciliation.${p.reconciliation}`),
        failure: p.failureReason ?? "",
      })),
    };
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {s ? (
          <>
            <MetricCard
              icon={CircleDollarSign}
              label={t("payments.kpi.captured")}
              value={f.eur(s.capturedCents)}
              sub={t("payments.kpi.capturedSub", { count: s.count })}
            />
            <MetricCard
              icon={Undo2}
              label={t("payments.kpi.refunded")}
              value={f.eur(s.refundedCents)}
              sub={t("payments.kpi.refundedSub", { share: share(s.refundedCents, s.capturedCents) })}
              onClick={() => list.setFilters({ status: ["REFUNDED", "PARTIALLY_REFUNDED"] })}
            />
            <MetricCard
              icon={XCircle}
              tone={s.failed > 0 ? "danger" : "default"}
              label={t("payments.kpi.failed")}
              value={f.number(s.failed)}
              sub={t("payments.kpi.failedSub", { share: share(s.failed, s.count) })}
              onClick={() => list.setFilters({ status: ["FAILED"] })}
            />
            <MetricCard
              icon={Hourglass}
              label={t("payments.kpi.inProgress")}
              value={f.number(s.pending)}
              sub={t("payments.kpi.inProgressSub")}
              onClick={() => list.setFilters({ status: ["PENDING", "PROCESSING"] })}
            />
            <MetricCard
              icon={GitCompare}
              tone={s.mismatched > 0 ? "warning" : "success"}
              label={t("payments.kpi.needsReview")}
              value={f.number(s.mismatched)}
              sub={t("payments.kpi.needsReviewSub", { amount: f.eur(s.mismatchedCents) })}
              onClick={onGoReconciliation}
            />
          </>
        ) : (
          Array.from({ length: 5 }, (_, i) => <MetricCardSkeleton key={i} />)
        )}
      </div>

      <FilterBar
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        actions={
          <Can module="payments" action="export">
            <ExportButton filename={t("payments.exportFile")} getData={getExport} />
          </Can>
        }
      >
        <SearchInput
          value={q}
          onChange={(v) => list.setFilters({ q: v })}
          placeholder={t("payments.searchPlaceholder")}
        />
        <MultiSelectFilter
          label={t("payments.filters.status")}
          options={PAYMENT_STATUSES.map((v) => ({ value: v, label: t(`status.payment.${v}`) }))}
          value={status}
          onChange={(v) => list.setFilters({ status: v })}
        />
        <MultiSelectFilter
          label={t("payments.filters.method")}
          options={PAYMENT_METHODS.map((v) => ({ value: v, label: t(`enums.paymentMethod.${v}`) }))}
          value={method}
          onChange={(v) => list.setFilters({ method: v })}
        />
        <DateRangeFilter
          label={t("payments.filters.date")}
          preset={range}
          from={from}
          to={to}
          onChange={(v) => list.setFilters(v)}
        />
        <MultiSelectFilter
          label={t("payments.filters.match")}
          options={RECONCILIATION_STATES.map((v) => ({ value: v, label: t(`status.reconciliation.${v}`) }))}
          value={match}
          onChange={(v) => list.setFilters({ match: v })}
        />
      </FilterBar>

      <DataTable
        tableId="payments"
        caption={t("payments.title")}
        columns={columns}
        data={query.data}
        isPending={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        sort={sort}
        onSortChange={(v) => list.set({ sort: v || null, page: null })}
        pageSize={size}
        onPageChange={(p) => list.set({ page: p })}
        onPageSizeChange={(n) => list.set({ size: n, page: null })}
        getRowId={(p) => p.id}
        onOpenRow={(p) => onOpen(p.id)}
        filtered={list.hasFilters}
        onClearFilters={list.clearFilters}
        emptyTitle={t("payments.empty")}
        rowActions={(p) => (
          <>
            <DropdownMenuItem onSelect={() => onOpen(p.id)}>
              <Eye />
              {t("payments.actions.view")}
            </DropdownMenuItem>
            {allowed("payments", "refund") && refundBlock(p) === null && (
              <DropdownMenuItem onSelect={() => onRefund(p)}>
                <Undo2 />
                {t("payments.actions.refund")}
              </DropdownMenuItem>
            )}
          </>
        )}
        mobileCard={(p) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="tabular font-medium">{p.id}</span>
              <StatusBadge kind="payment" value={p.status} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="tabular text-base font-semibold">{f.eur(p.amountCents)}</span>
              <span className="text-caption inline-flex items-center gap-1">
                <Wallet aria-hidden className="size-3" />
                {t(`enums.paymentMethod.${p.method}`)}
              </span>
            </div>
            <span className="text-caption truncate">
              {p.customerName} · {p.rideId}
            </span>
            <span className="text-caption">
              {f.dateTime(p.createdAt)}
              {p.refundedCents > 0 &&
                ` · ${t("payments.refundOf", { refunded: f.eur(p.refundedCents), total: f.eur(p.amountCents) })}`}
            </span>
          </div>
        )}
      />
    </div>
  );
}
