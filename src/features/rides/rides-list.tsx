"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, parseAsStringLiteral } from "nuqs";
import type { RideListItem, RideStatus } from "@/types/ride";
import { ACTIVE_RIDE_STATUSES } from "@/types/ride";
import { StatusBadge, statusValues } from "@/components/badges/status-badge";
import { DataTable } from "@/components/data/data-table";
import { ExportButton } from "@/components/data/export-button";
import {
  DateRangeFilter,
  FilterBar,
  MultiSelectFilter,
  SearchInput,
  SingleSelectFilter,
} from "@/components/data/filter-bar";
import { PersonFilter, type PersonOption } from "@/components/data/person-filter";
import { dateRangeParsers, enumList, useListState } from "@/components/data/use-list-state";
import { Can, usePermission } from "@/components/session/permissions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCustomers } from "@/hooks/queries/customers";
import { useDrivers } from "@/hooks/queries/drivers";
import { useFleetManagers } from "@/hooks/queries/fleet";
import { useRideTabCounts, useRides } from "@/hooks/queries/rides";
import { useRouter } from "@/i18n/navigation";
import { resolveDateRange } from "@/lib/date-range";
import { useFormat } from "@/lib/use-format";
import { exportRides } from "@/services/rides";

/**
 * Rides list (§9) — copy of the P5 list template, with the five tabs of the
 * plan (All · Ongoing · Scheduled · Completed · Cancelled & failed) and a
 * count on each. Everything is in the URL, so the dashboard's KPI cards open
 * the same list: `?status=COMPLETED&range=30d`, `?status=SCHEDULED`,
 * `?status=<active statuses>`. Filters: status, date range, driver, customer,
 * fleet, payment status, ride type. Server-paginated (25/50/100 per page), so
 * all 20 000 rides are reachable by filtering and paging.
 */
const TABS = ["all", "ongoing", "scheduled", "completed", "cancelled"] as const;
type Tab = (typeof TABS)[number];
const STATUSES = statusValues("ride");
const PAYMENTS = statusValues("payment");
const CATEGORIES = ["ECONOMY", "COMFORT", "PREMIUM"] as const;

const shortAddress = (address: string) => address.split(",")[0] ?? address;

/** Driver search for the filter (needs `drivers.view`). */
function useDriverResults(q: string) {
  const query = useDrivers({ q: q || undefined, page: 1, pageSize: 8, sort: "name:asc" });
  const data: PersonOption[] | undefined = query.data?.items.map((d) => ({
    id: d.id,
    name: d.name,
    caption: `${d.id}${d.vehiclePlate ? ` · ${d.vehiclePlate}` : ""}`,
  }));
  return { data, isFetching: query.isFetching };
}

/** Customer search for the filter (needs `customers.view`). */
function useCustomerResults(q: string) {
  const query = useCustomers({ q: q || undefined, page: 1, pageSize: 8, sort: "name:asc" });
  const data: PersonOption[] | undefined = query.data?.items.map((c) => ({
    id: c.id,
    name: c.name,
    caption: c.id,
  }));
  return { data, isFetching: query.isFetching };
}

export function RidesList() {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const allowed = usePermission();
  const list = useListState({
    tab: parseAsStringLiteral(TABS).withDefault("all"),
    status: enumList(STATUSES),
    payment: enumList(PAYMENTS),
    category: enumList(CATEGORIES),
    driver: parseAsString,
    customer: parseAsString,
    fleet: parseAsString,
    ...dateRangeParsers,
  });
  const {
    page,
    size,
    q,
    sort,
    tab,
    status,
    payment,
    category,
    driver,
    customer,
    fleet,
    range,
    from,
    to,
  } = list.state;

  const filters = {
    q: q || undefined,
    paymentStatus: payment,
    rideType: category,
    driverId: driver ?? undefined,
    customerId: customer ?? undefined,
    fleetManagerId: fleet ?? undefined,
    ...resolveDateRange(range, from, to),
  };
  const query = useRides({
    ...filters,
    sort: sort || undefined,
    status,
    tab: tab === "all" ? undefined : tab,
    page,
    pageSize: size,
  });
  const counts = useRideTabCounts(filters);
  const canSeeDrivers = allowed("drivers", "view");
  const canSeeCustomers = allowed("customers", "view");
  const canSeeFleets = allowed("fleet", "view");
  const fleets = useFleetManagers(
    { page: 1, pageSize: 100, sort: "companyName:asc" },
    canSeeFleets,
  );

  const columns = useMemo<ColumnDef<RideListItem, unknown>[]>(
    () => [
      {
        id: "id",
        meta: {
          label: t("rides.columns.id"),
          alwaysVisible: true,
          className: "tabular-nums whitespace-nowrap",
        },
        header: t("rides.columns.id"),
        cell: ({ row }) => <span className="font-medium">{row.original.id}</span>,
      },
      {
        id: "customer",
        meta: { label: t("rides.columns.customer"), className: "min-w-40" },
        header: t("rides.columns.customer"),
        cell: ({ row }) => <span className="text-dense">{row.original.customerName}</span>,
      },
      {
        id: "driver",
        meta: { label: t("rides.columns.driver"), className: "min-w-40" },
        header: t("rides.columns.driver"),
        cell: ({ row }) =>
          row.original.driverName ? (
            <div className="flex min-w-0 flex-col">
              <span className="text-dense truncate">{row.original.driverName}</span>
              {row.original.vehiclePlate && (
                <span className="text-caption tabular">{row.original.vehiclePlate}</span>
              )}
            </div>
          ) : (
            <span className="text-caption">{t("rides.noDriver")}</span>
          ),
      },
      {
        id: "fleet",
        meta: { label: t("rides.columns.fleet"), className: "min-w-36", defaultHidden: true },
        header: t("rides.columns.fleet"),
        cell: ({ row }) => (
          <span className="text-dense">{row.original.fleetName ?? t("rides.independent")}</span>
        ),
      },
      {
        id: "pickup",
        meta: { label: t("rides.columns.pickup"), className: "max-w-56" },
        header: t("rides.columns.pickup"),
        cell: ({ row }) => (
          <span className="block truncate">{shortAddress(row.original.pickup.address)}</span>
        ),
      },
      {
        id: "dropoff",
        meta: { label: t("rides.columns.dropoff"), className: "max-w-56" },
        header: t("rides.columns.dropoff"),
        cell: ({ row }) => (
          <span className="block truncate">{shortAddress(row.original.dropoff.address)}</span>
        ),
      },
      {
        id: "bookedAt",
        enableSorting: true,
        meta: { label: t("rides.columns.booked"), className: "whitespace-nowrap" },
        header: t("rides.columns.booked"),
        cell: ({ row }) => <span className="text-dense">{f.dateTime(row.original.bookedAt)}</span>,
      },
      {
        id: "scheduledFor",
        enableSorting: true,
        meta: { label: t("rides.columns.scheduled"), className: "whitespace-nowrap" },
        header: t("rides.columns.scheduled"),
        cell: ({ row }) =>
          row.original.scheduledFor ? (
            <span className="text-dense">{f.dateTime(row.original.scheduledFor)}</span>
          ) : (
            <span className="text-caption">—</span>
          ),
      },
      {
        id: "rideType",
        meta: { label: t("rides.columns.type") },
        header: t("rides.columns.type"),
        cell: ({ row }) => t(`enums.rideCategory.${row.original.rideType}`),
      },
      {
        id: "estimatedFareCents",
        enableSorting: true,
        meta: {
          label: t("rides.columns.estimated"),
          className: "text-right tabular-nums whitespace-nowrap",
        },
        header: t("rides.columns.estimated"),
        cell: ({ row }) => f.eur(row.original.estimatedFareCents),
      },
      {
        id: "finalFareCents",
        enableSorting: true,
        meta: {
          label: t("rides.columns.final"),
          className: "text-right tabular-nums whitespace-nowrap",
        },
        header: t("rides.columns.final"),
        cell: ({ row }) =>
          row.original.finalFareCents === undefined ? (
            <span className="text-caption">—</span>
          ) : (
            <span className="font-medium">{f.eur(row.original.finalFareCents)}</span>
          ),
      },
      {
        id: "payment",
        meta: { label: t("rides.columns.payment"), className: "min-w-32" },
        header: t("rides.columns.payment"),
        cell: ({ row }) => (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge kind="payment" value={row.original.payment.status} />
            <span className="text-caption">
              {t(`enums.paymentMethod.${row.original.payment.method}`)}
            </span>
          </div>
        ),
      },
      {
        id: "status",
        meta: { label: t("rides.columns.status") },
        header: t("rides.columns.status"),
        cell: ({ row }) => <StatusBadge kind="ride" value={row.original.status} />,
      },
    ],
    [t, f],
  );

  const getExport = async () => {
    const rows = await exportRides({
      ...filters,
      sort: sort || undefined,
      status,
      tab: tab === "all" ? undefined : tab,
    });
    const col = (key: string, label: string) => ({ key, label });
    return {
      columns: [
        col("id", t("rides.columns.id")),
        col("customer", t("rides.columns.customer")),
        col("driver", t("rides.columns.driver")),
        col("plate", t("rides.export.plate")),
        col("fleet", t("rides.columns.fleet")),
        col("pickup", t("rides.columns.pickup")),
        col("dropoff", t("rides.columns.dropoff")),
        col("booked", t("rides.columns.booked")),
        col("scheduled", t("rides.columns.scheduled")),
        col("type", t("rides.columns.type")),
        col("estimated", t("rides.export.estimated")),
        col("final", t("rides.export.final")),
        col("payment", t("rides.columns.payment")),
        col("method", t("rides.export.method")),
        col("status", t("rides.columns.status")),
      ],
      rows: rows.map((r) => ({
        id: r.id,
        customer: r.customerName,
        driver: r.driverName ?? "",
        plate: r.vehiclePlate ?? "",
        fleet: r.fleetName ?? "",
        pickup: r.pickup.address,
        dropoff: r.dropoff.address,
        booked: f.dateTime(r.bookedAt),
        scheduled: r.scheduledFor ? f.dateTime(r.scheduledFor) : "",
        type: t(`enums.rideCategory.${r.rideType}`),
        estimated: r.estimatedFareCents / 100,
        final: r.finalFareCents === undefined ? "" : r.finalFareCents / 100,
        payment: t(`status.payment.${r.payment.status}`),
        method: t(`enums.paymentMethod.${r.payment.method}`),
        status: t(`status.ride.${r.status}`),
      })),
    };
  };

  /** A tab picks its own statuses, so changing tab drops the status filter. */
  const goToTab = (next: string) =>
    list.setFilters({ tab: next === "all" ? null : (next as Tab), status: [] });
  const statusOptions: RideStatus[] =
    tab === "ongoing"
      ? STATUSES.filter((s) => ACTIVE_RIDE_STATUSES.includes(s))
      : tab === "completed"
        ? ["COMPLETED"]
        : tab === "cancelled"
          ? ["CANCELLED", "EXPIRED"]
          : tab === "scheduled"
            ? ["SCHEDULED"]
            : STATUSES;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title">{t("nav.items.rides")}</h1>
        <p className="text-dense text-muted-foreground">{t("rides.subtitle")}</p>
      </div>

      <Tabs value={tab} onValueChange={goToTab}>
        <TabsList className="max-w-full overflow-x-auto">
          {TABS.map((key) => (
            <TabsTrigger key={key} value={key}>
              {t(`rides.tabs.${key}`)}
              {counts.data && (
                <Badge variant="neutral" className="tabular h-5 px-1.5">
                  {f.number(counts.data[key])}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <FilterBar
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        actions={
          <Can module="rides" action="export">
            <ExportButton filename={t("rides.exportFile")} getData={getExport} />
          </Can>
        }
      >
        <SearchInput
          value={q}
          onChange={(v) => list.setFilters({ q: v })}
          placeholder={t("rides.searchPlaceholder")}
        />
        {statusOptions.length > 1 && (
          <MultiSelectFilter
            label={t("rides.filters.status")}
            options={statusOptions.map((v) => ({ value: v, label: t(`status.ride.${v}`) }))}
            value={status}
            onChange={(v) => list.setFilters({ status: v })}
          />
        )}
        <DateRangeFilter
          label={t("rides.filters.date")}
          preset={range}
          from={from}
          to={to}
          onChange={(v) => list.setFilters(v)}
        />
        {canSeeDrivers && (
          <PersonFilter
            label={t("rides.filters.driver")}
            placeholder={t("rides.filters.driverSearch")}
            value={driver}
            onChange={(v) => list.setFilters({ driver: v })}
            useResults={useDriverResults}
          />
        )}
        {canSeeCustomers && (
          <PersonFilter
            label={t("rides.filters.customer")}
            placeholder={t("rides.filters.customerSearch")}
            value={customer}
            onChange={(v) => list.setFilters({ customer: v })}
            useResults={useCustomerResults}
          />
        )}
        {canSeeFleets && (
          <SingleSelectFilter
            label={t("rides.filters.fleet")}
            options={
              fleets.data?.items.map((fl) => ({ value: fl.id, label: fl.companyName })) ?? []
            }
            value={fleet}
            onChange={(v) => list.setFilters({ fleet: v })}
          />
        )}
        <MultiSelectFilter
          label={t("rides.filters.payment")}
          options={PAYMENTS.map((v) => ({ value: v, label: t(`status.payment.${v}`) }))}
          value={payment}
          onChange={(v) => list.setFilters({ payment: v })}
        />
        <MultiSelectFilter
          label={t("rides.filters.type")}
          options={CATEGORIES.map((v) => ({ value: v, label: t(`enums.rideCategory.${v}`) }))}
          value={category}
          onChange={(v) => list.setFilters({ category: v })}
        />
      </FilterBar>

      <DataTable
        tableId="rides"
        caption={t("nav.items.rides")}
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
        getRowId={(r) => r.id}
        onOpenRow={(r) => router.push(`/rides/${r.id}`)}
        filtered={list.hasFilters}
        onClearFilters={list.clearFilters}
        emptyTitle={t(`rides.empty.${tab}`)}
        rowActions={(r) => (
          <DropdownMenuItem onSelect={() => router.push(`/rides/${r.id}`)}>
            <Eye />
            {t("rides.actions.view")}
          </DropdownMenuItem>
        )}
        mobileCard={(r) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="tabular font-medium">{r.id}</span>
              <StatusBadge kind="ride" value={r.status} />
            </div>
            <span className="text-dense truncate">
              {shortAddress(r.pickup.address)} → {shortAddress(r.dropoff.address)}
            </span>
            <span className="text-caption truncate">
              {r.customerName} · {r.driverName ?? t("rides.noDriver")}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge kind="payment" value={r.payment.status} />
              <span className="text-caption tabular-nums">
                {f.eur(r.finalFareCents ?? r.estimatedFareCents)} ·{" "}
                {r.scheduledFor ? f.dateTime(r.scheduledFor) : f.dateTime(r.bookedAt)}
              </span>
            </div>
          </div>
        )}
      />
    </div>
  );
}
