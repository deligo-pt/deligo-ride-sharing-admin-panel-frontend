"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Eye, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Customer } from "@/types/customer";
import { StatusBadge, statusValues } from "@/components/badges/status-badge";
import { Can, usePermission } from "@/components/session/permissions";
import { DataTable } from "@/components/data/data-table";
import { ExportButton } from "@/components/data/export-button";
import {
  DateRangeFilter,
  FilterBar,
  MultiSelectFilter,
  SearchInput,
} from "@/components/data/filter-bar";
import { dateRangeParsers, enumList, useListState } from "@/components/data/use-list-state";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useCustomers } from "@/hooks/queries/customers";
import { useRouter } from "@/i18n/navigation";
import { resolveDateRange } from "@/lib/date-range";
import { useFormat } from "@/lib/use-format";
import { exportCustomers } from "@/services/customers";
import { useCustomerStatusAction } from "./customer-status-dialog";

/**
 * LIST PAGE TEMPLATE (§P5) — copy this file for a module list:
 * 1. URL state: `useListState({ …filters })` (page, size, q, sort come free).
 * 2. Build the service params from it (date presets → `resolveDateRange`).
 * 3. Query hook → `DataTable` (columns, row menu, mobile card).
 * 4. `FilterBar` with search, multi-selects, date range, export.
 * 5. Sensitive row actions through a ReasonDialog hook.
 * 6. Permissions (P7): `<Can>` / `usePermission()` around export and actions;
 *    the service masks personal data itself when the role lacks `sensitive`.
 */
const STATUSES = statusValues("customer");
const VERIFICATIONS = statusValues("verification");

export function CustomersList() {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const list = useListState({
    status: enumList(STATUSES),
    verification: enumList(VERIFICATIONS),
    ...dateRangeParsers,
  });
  const { page, size, q, sort, status, verification, range, from, to } = list.state;

  const filters = {
    q: q || undefined,
    sort: sort || undefined,
    status,
    verification,
    ...resolveDateRange(range, from, to),
  };
  const query = useCustomers({ ...filters, page, pageSize: size });
  const statusAction = useCustomerStatusAction();
  const allowed = usePermission();

  const columns = useMemo<ColumnDef<Customer, unknown>[]>(
    () => [
      {
        id: "name",
        enableSorting: true,
        meta: {
          label: t("customers.columns.customer"),
          alwaysVisible: true,
          className: "min-w-56",
        },
        header: t("customers.columns.customer"),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium">{row.original.name}</span>
              {row.original.unpaidCents > 0 && (
                <Badge
                  variant="warning"
                  className="text-micro h-5 shrink-0"
                  title={f.eur(row.original.unpaidCents)}
                >
                  {t("customers.unpaidBadge")}
                </Badge>
              )}
            </span>
            <span className="text-caption truncate">{row.original.email}</span>
          </div>
        ),
      },
      {
        id: "id",
        meta: { label: t("customers.columns.id"), className: "tabular-nums whitespace-nowrap" },
        header: t("customers.columns.id"),
        cell: ({ row }) => row.original.id,
      },
      {
        id: "phone",
        meta: { label: t("customers.columns.phone"), className: "whitespace-nowrap tabular-nums" },
        header: t("customers.columns.phone"),
        cell: ({ row }) => f.phone(row.original.phone),
      },
      {
        id: "registeredAt",
        enableSorting: true,
        meta: { label: t("customers.columns.registered"), className: "whitespace-nowrap" },
        header: t("customers.columns.registered"),
        cell: ({ row }) => f.date(row.original.registeredAt),
      },
      {
        id: "status",
        enableSorting: true,
        meta: { label: t("customers.columns.status") },
        header: t("customers.columns.status"),
        cell: ({ row }) => <StatusBadge kind="customer" value={row.original.status} />,
      },
      {
        id: "verification",
        meta: { label: t("customers.columns.verification") },
        header: t("customers.columns.verification"),
        cell: ({ row }) => <StatusBadge kind="verification" value={row.original.verification} />,
      },
      {
        id: "totalRides",
        enableSorting: true,
        meta: { label: t("customers.columns.rides"), className: "text-right tabular-nums" },
        header: t("customers.columns.rides"),
        cell: ({ row }) => f.number(row.original.totalRides),
      },
      {
        id: "totalSpentCents",
        enableSorting: true,
        meta: {
          label: t("customers.columns.spent"),
          className: "text-right tabular-nums whitespace-nowrap",
        },
        header: t("customers.columns.spent"),
        cell: ({ row }) => f.eur(row.original.totalSpentCents),
      },
    ],
    [t, f],
  );

  const getExport = async () => {
    const rows = await exportCustomers(filters);
    const col = (key: string, label: string) => ({ key, label });
    return {
      columns: [
        col("id", t("customers.columns.id")),
        col("name", t("customers.columns.customer")),
        col("email", t("customers.columns.email")),
        col("phone", t("customers.columns.phone")),
        col("registered", t("customers.columns.registered")),
        col("status", t("customers.columns.status")),
        col("verification", t("customers.columns.verification")),
        col("rides", t("customers.columns.rides")),
        col("spent", t("customers.columns.spent")),
      ],
      rows: rows.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: f.phone(c.phone),
        registered: f.date(c.registeredAt),
        status: t(`status.customer.${c.status}`),
        verification: t(`status.verification.${c.verification}`),
        rides: c.totalRides,
        spent: c.totalSpentCents / 100,
      })),
    };
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title">{t("nav.items.customers")}</h1>
        <p className="text-dense text-muted-foreground">{t("customers.subtitle")}</p>
      </div>

      <FilterBar
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        actions={
          <Can module="customers" action="export">
            <ExportButton filename={t("customers.exportFile")} getData={getExport} />
          </Can>
        }
      >
        <SearchInput
          value={q}
          onChange={(v) => list.setFilters({ q: v })}
          placeholder={t("customers.searchPlaceholder")}
        />
        <MultiSelectFilter
          label={t("customers.filters.status")}
          options={STATUSES.map((v) => ({ value: v, label: t(`status.customer.${v}`) }))}
          value={status}
          onChange={(v) => list.setFilters({ status: v })}
        />
        <MultiSelectFilter
          label={t("customers.filters.verification")}
          options={VERIFICATIONS.map((v) => ({ value: v, label: t(`status.verification.${v}`) }))}
          value={verification}
          onChange={(v) => list.setFilters({ verification: v })}
        />
        <DateRangeFilter
          label={t("customers.filters.registered")}
          preset={range}
          from={from}
          to={to}
          onChange={(v) => list.setFilters(v)}
        />
      </FilterBar>

      <DataTable
        tableId="customers"
        caption={t("nav.items.customers")}
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
        onPageSizeChange={(s) => list.set({ size: s, page: null })}
        getRowId={(c) => c.id}
        onOpenRow={(c) => router.push(`/customers/${c.id}`)}
        filtered={list.hasFilters}
        onClearFilters={list.clearFilters}
        rowActions={(c) => (
          <>
            <DropdownMenuItem onSelect={() => router.push(`/customers/${c.id}`)}>
              <Eye />
              {t("customers.actions.view")}
            </DropdownMenuItem>
            {allowed("customers", "suspend") && <DropdownMenuSeparator />}
            {!allowed("customers", "suspend") ? null : c.status === "SUSPENDED" ||
              c.status === "DEACTIVATED" ? (
              <DropdownMenuItem onSelect={() => statusAction.open(c)}>
                <RotateCcw />
                {t("customers.actions.reactivate")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem variant="destructive" onSelect={() => statusAction.open(c)}>
                <Ban />
                {t("customers.actions.suspend")}
              </DropdownMenuItem>
            )}
          </>
        )}
        mobileCard={(c) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{c.name}</span>
              <StatusBadge kind="customer" value={c.status} />
            </div>
            {c.unpaidCents > 0 && (
              <Badge variant="warning" className="text-micro h-5 self-start">
                {t("customers.unpaidBadge")} · {f.eur(c.unpaidCents)}
              </Badge>
            )}
            <span className="text-caption truncate">
              {c.id} · {f.phone(c.phone)}
            </span>
            <span className="text-caption tabular-nums">
              {t("customers.columns.rides")}: {f.number(c.totalRides)} · {f.eur(c.totalSpentCents)}
            </span>
          </div>
        )}
      />
      {statusAction.dialog}
    </div>
  );
}
