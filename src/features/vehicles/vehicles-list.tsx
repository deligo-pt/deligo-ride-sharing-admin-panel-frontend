"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  CalendarClock,
  CircleCheck,
  CirclePause,
  Eye,
  FileSearch,
  Pencil,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsBoolean, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs";
import type { VehicleListItem } from "@/types/vehicle";
import { StatusBadge, statusValues } from "@/components/badges/status-badge";
import { DataTable } from "@/components/data/data-table";
import { ExportButton } from "@/components/data/export-button";
import {
  FilterBar,
  MultiSelectFilter,
  SearchInput,
  SingleSelectFilter,
  ToggleFilter,
} from "@/components/data/filter-bar";
import { enumList, useListState } from "@/components/data/use-list-state";
import { Can, usePermission } from "@/components/session/permissions";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CredentialCell } from "@/features/drivers/credential-cell";
import { useFleetManagers } from "@/hooks/queries/fleet";
import { useVehicles } from "@/hooks/queries/vehicles";
import { Link, useRouter } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";
import { exportVehicles } from "@/services/vehicles";
import { useVehicleActions } from "./vehicle-actions";

/**
 * Vehicles list (§8) — copy of the P5 list template, with two views:
 * "All vehicles" and "Upcoming expirations" (`?view=expirations&days=30|60|90`),
 * which lists vehicles whose insurance or inspection ends within the window
 * (or already ended), soonest first. Other filters live in the URL too:
 * `?approval=PENDING_REVIEW` (the dashboard links here), `operational`,
 * `category`, `fleet`, `expiring=true`.
 */
const CATEGORIES = ["ECONOMY", "COMFORT", "PREMIUM"] as const;
const APPROVALS = statusValues("vehicleApproval");
const OPERATIONAL = statusValues("vehicleOperational");
const VIEWS = ["all", "expirations"] as const;
const WINDOWS = ["30", "60", "90"] as const;

export function VehiclesList() {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const allowed = usePermission();
  const list = useListState({
    view: parseAsStringLiteral(VIEWS).withDefault("all"),
    days: parseAsInteger.withDefault(30),
    category: enumList(CATEGORIES),
    approval: enumList(APPROVALS),
    operational: enumList(OPERATIONAL),
    fleet: parseAsString,
    expiring: parseAsBoolean.withDefault(false),
  });
  const { page, size, q, sort, view, days, category, approval, operational, fleet, expiring } =
    list.state;
  const expirations = view === "expirations";

  const filters = {
    q: q || undefined,
    // Soonest expiry first in the expirations view unless the admin sorts.
    sort: sort || (expirations ? "nextExpiry:asc" : undefined),
    category,
    approval,
    operational,
    fleetManagerId: fleet ?? undefined,
    expiring: (!expirations && expiring) || undefined,
    expiringWithinDays: expirations ? days : undefined,
  };
  const query = useVehicles({ ...filters, page, pageSize: size });
  const canSeeFleets = allowed("fleet", "view");
  const fleets = useFleetManagers(
    { page: 1, pageSize: 100, sort: "companyName:asc" },
    canSeeFleets,
  );
  const actions = useVehicleActions();

  const columns = useMemo<ColumnDef<VehicleListItem, unknown>[]>(
    () => [
      {
        id: "plate",
        enableSorting: true,
        meta: { label: t("vehicles.columns.vehicle"), alwaysVisible: true, className: "min-w-48" },
        header: t("vehicles.columns.vehicle"),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="flex items-center gap-2">
              <span className="tabular font-medium">{row.original.plate}</span>
              <span className="text-caption tabular-nums">{row.original.id}</span>
            </span>
            <span className="text-caption truncate">
              {row.original.make} {row.original.model} ({row.original.year})
            </span>
          </div>
        ),
      },
      {
        id: "category",
        meta: { label: t("vehicles.columns.category") },
        header: t("vehicles.columns.category"),
        cell: ({ row }) => t(`enums.rideCategory.${row.original.category}`),
      },
      {
        id: "driver",
        meta: { label: t("vehicles.columns.driver"), className: "min-w-36" },
        header: t("vehicles.columns.driver"),
        cell: ({ row }) =>
          row.original.driverName ? (
            <span className="text-dense">{row.original.driverName}</span>
          ) : (
            <span className="text-caption">{t("vehicles.unassigned")}</span>
          ),
      },
      {
        id: "fleet",
        meta: { label: t("vehicles.columns.fleet"), className: "min-w-36" },
        header: t("vehicles.columns.fleet"),
        cell: ({ row }) => (
          <span className="text-dense">{row.original.fleetName ?? t("vehicles.independent")}</span>
        ),
      },
      {
        id: "insuranceExpiresAt",
        enableSorting: true,
        meta: { label: t("vehicles.columns.insurance") },
        header: t("vehicles.columns.insurance"),
        cell: ({ row }) => <CredentialCell credential={row.original.insurance} />,
      },
      {
        id: "inspectionExpiresAt",
        enableSorting: true,
        meta: { label: t("vehicles.columns.inspection") },
        header: t("vehicles.columns.inspection"),
        cell: ({ row }) => <CredentialCell credential={row.original.inspection} />,
      },
      {
        id: "approval",
        meta: { label: t("vehicles.columns.approval") },
        header: t("vehicles.columns.approval"),
        cell: ({ row }) => <StatusBadge kind="vehicleApproval" value={row.original.approval} />,
      },
      {
        id: "operational",
        meta: { label: t("vehicles.columns.operational") },
        header: t("vehicles.columns.operational"),
        cell: ({ row }) => (
          <StatusBadge kind="vehicleOperational" value={row.original.operational} />
        ),
      },
    ],
    [t],
  );

  const getExport = async () => {
    const rows = await exportVehicles(filters);
    const col = (key: string, label: string) => ({ key, label });
    return {
      columns: [
        col("id", t("vehicles.columns.id")),
        col("plate", t("vehicles.form.plate")),
        col("vehicle", t("vehicles.export.vehicle")),
        col("category", t("vehicles.columns.category")),
        col("driver", t("vehicles.columns.driver")),
        col("fleet", t("vehicles.columns.fleet")),
        col("insurance", t("vehicles.export.insuranceExpiry")),
        col("inspection", t("vehicles.export.inspectionExpiry")),
        col("approval", t("vehicles.columns.approval")),
        col("operational", t("vehicles.columns.operational")),
      ],
      rows: rows.map((v) => ({
        id: v.id,
        plate: v.plate,
        vehicle: `${v.make} ${v.model} (${v.year})`,
        category: t(`enums.rideCategory.${v.category}`),
        driver: v.driverName ?? "",
        fleet: v.fleetName ?? t("vehicles.independent"),
        insurance: f.date(v.insurance.expiresAt),
        inspection: f.date(v.inspection.expiresAt),
        approval: t(`status.vehicleApproval.${v.approval}`),
        operational: t(`status.vehicleOperational.${v.operational}`),
      })),
    };
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-page-title">{t("nav.items.vehicles")}</h1>
          <p className="text-dense text-muted-foreground">{t("vehicles.subtitle")}</p>
        </div>
        <Can module="vehicles" action="create">
          <Button asChild>
            <Link href="/vehicles/new">{t("vehicles.add")}</Link>
          </Button>
        </Can>
      </div>

      <Tabs
        value={view}
        onValueChange={(v) =>
          list.setFilters({ view: v === "all" ? null : (v as (typeof VIEWS)[number]), sort: null })
        }
      >
        <TabsList>
          <TabsTrigger value="all">{t("vehicles.views.all")}</TabsTrigger>
          <TabsTrigger value="expirations">
            <CalendarClock aria-hidden />
            {t("vehicles.views.expirations")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <FilterBar
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        actions={
          <Can module="vehicles" action="export">
            <ExportButton filename={t("vehicles.exportFile")} getData={getExport} />
          </Can>
        }
      >
        <SearchInput
          value={q}
          onChange={(v) => list.setFilters({ q: v })}
          placeholder={t("vehicles.searchPlaceholder")}
        />
        {expirations && (
          <SingleSelectFilter
            label={t("vehicles.filters.window")}
            options={WINDOWS.map((w) => ({
              value: w,
              label: t("vehicles.filters.windowDays", { days: Number(w) }),
            }))}
            value={String(days)}
            onChange={(v) => list.setFilters({ days: v ? Number(v) : null })}
          />
        )}
        <MultiSelectFilter
          label={t("vehicles.filters.approval")}
          options={APPROVALS.map((v) => ({ value: v, label: t(`status.vehicleApproval.${v}`) }))}
          value={approval}
          onChange={(v) => list.setFilters({ approval: v })}
        />
        <MultiSelectFilter
          label={t("vehicles.filters.operational")}
          options={OPERATIONAL.map((v) => ({
            value: v,
            label: t(`status.vehicleOperational.${v}`),
          }))}
          value={operational}
          onChange={(v) => list.setFilters({ operational: v })}
        />
        <MultiSelectFilter
          label={t("vehicles.filters.category")}
          options={CATEGORIES.map((v) => ({ value: v, label: t(`enums.rideCategory.${v}`) }))}
          value={category}
          onChange={(v) => list.setFilters({ category: v })}
        />
        {canSeeFleets && (
          <SingleSelectFilter
            label={t("vehicles.filters.fleet")}
            options={
              fleets.data?.items.map((fl) => ({ value: fl.id, label: fl.companyName })) ?? []
            }
            value={fleet}
            onChange={(v) => list.setFilters({ fleet: v })}
          />
        )}
        {!expirations && (
          <ToggleFilter
            label={t("vehicles.filters.expiring")}
            pressed={expiring}
            onChange={(on) => list.setFilters({ expiring: on || null })}
          />
        )}
      </FilterBar>

      <DataTable
        tableId="vehicles"
        caption={t("nav.items.vehicles")}
        columns={columns}
        data={query.data}
        isPending={query.isPending}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => query.refetch()}
        sort={sort || (expirations ? "nextExpiry:asc" : "")}
        onSortChange={(v) => list.set({ sort: v || null, page: null })}
        pageSize={size}
        onPageChange={(p) => list.set({ page: p })}
        onPageSizeChange={(s) => list.set({ size: s, page: null })}
        getRowId={(v) => v.id}
        onOpenRow={(v) => router.push(`/vehicles/${v.id}`)}
        filtered={list.hasFilters}
        onClearFilters={list.clearFilters}
        emptyTitle={expirations ? t("vehicles.noExpirations", { days }) : undefined}
        rowActions={(v) => (
          <>
            <DropdownMenuItem onSelect={() => router.push(`/vehicles/${v.id}`)}>
              <Eye />
              {t("vehicles.actions.view")}
            </DropdownMenuItem>
            {allowed("documents", "view") && (
              <DropdownMenuItem onSelect={() => router.push(`/vehicles/${v.id}?tab=documents`)}>
                <FileSearch />
                {t("vehicles.actions.reviewDocuments")}
              </DropdownMenuItem>
            )}
            {allowed("vehicles", "edit") && (
              <DropdownMenuItem onSelect={() => router.push(`/vehicles/${v.id}/edit`)}>
                <Pencil />
                {t("vehicles.actions.edit")}
              </DropdownMenuItem>
            )}
            {allowed("vehicles", "suspend") && <DropdownMenuSeparator />}
            {allowed("vehicles", "suspend") && v.operational !== "ACTIVE" && (
              <DropdownMenuItem onSelect={() => actions.open.status(v, "ACTIVE")}>
                <CircleCheck />
                {t("vehicles.actions.status.ACTIVE.action")}
              </DropdownMenuItem>
            )}
            {allowed("vehicles", "suspend") && v.operational === "ACTIVE" && (
              <DropdownMenuItem onSelect={() => actions.open.status(v, "INACTIVE")}>
                <CirclePause />
                {t("vehicles.actions.status.INACTIVE.action")}
              </DropdownMenuItem>
            )}
            {allowed("vehicles", "suspend") && v.operational !== "SUSPENDED" && (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => actions.open.status(v, "SUSPENDED")}
              >
                <Ban />
                {t("vehicles.actions.status.SUSPENDED.action")}
              </DropdownMenuItem>
            )}
          </>
        )}
        mobileCard={(v) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="tabular font-medium">{v.plate}</span>
              <StatusBadge kind="vehicleOperational" value={v.operational} />
            </div>
            <span className="text-caption truncate">
              {v.id} · {v.make} {v.model} · {v.driverName ?? t("vehicles.unassigned")}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge kind="vehicleApproval" value={v.approval} />
              {v.insurance.status !== "VALID" && (
                <StatusBadge kind="credential" value={v.insurance.status} />
              )}
              {v.inspection.status !== "VALID" && (
                <StatusBadge kind="credential" value={v.inspection.status} />
              )}
            </div>
          </div>
        )}
      />
      {actions.dialogs}
    </div>
  );
}
