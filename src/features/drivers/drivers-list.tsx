"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Building2, Eye, FileSearch, RotateCcw, Star, UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsBoolean, parseAsString } from "nuqs";
import type { DriverListItem } from "@/types/driver";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useDrivers } from "@/hooks/queries/drivers";
import { useFleetManagers } from "@/hooks/queries/fleet";
import { useRouter } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";
import { initials } from "@/lib/utils";
import { exportDrivers } from "@/services/drivers";
import { CredentialCell } from "./credential-cell";
import { useDriverActions } from "./driver-actions";

/**
 * Drivers list (§6) — copy of the P5 list template. Many columns: Contact
 * (e-mail, phone) starts hidden and is one click away in "Columns".
 * Filters live in the URL: `?verification=PENDING_DOCS,UNDER_REVIEW` (the
 * dashboard links here), `?expiring=true`, `?fleet=FLT-301`, `?presence=online`.
 */
const VERIFICATIONS = statusValues("driverVerification");
const ACCOUNTS = statusValues("account");
const PRESENCE = ["online", "offline"] as const;

export function DriversList() {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const allowed = usePermission();
  const list = useListState({
    verification: enumList(VERIFICATIONS),
    account: enumList(ACCOUNTS),
    presence: enumList(PRESENCE),
    fleet: parseAsString,
    expiring: parseAsBoolean.withDefault(false),
  });
  const { page, size, q, sort, verification, account, presence, fleet, expiring } = list.state;

  const filters = {
    q: q || undefined,
    sort: sort || undefined,
    verification,
    accountStatus: account,
    // Both or none picked = no filter on presence.
    online: presence.length === 1 ? presence[0] === "online" : undefined,
    fleetManagerId: fleet ?? undefined,
    expiring: expiring || undefined,
  };
  const query = useDrivers({ ...filters, page, pageSize: size });
  // The fleet filter only exists for roles that may open Fleet managers.
  const canSeeFleets = allowed("fleet", "view");
  const fleets = useFleetManagers(
    { page: 1, pageSize: 100, sort: "companyName:asc" },
    canSeeFleets,
  );
  const actions = useDriverActions();

  const columns = useMemo<ColumnDef<DriverListItem, unknown>[]>(
    () => [
      {
        id: "name",
        enableSorting: true,
        meta: { label: t("drivers.columns.driver"), alwaysVisible: true, className: "min-w-56" },
        header: t("drivers.columns.driver"),
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-9">
              <AvatarImage src={row.original.photoUrl} alt="" />
              <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
                {initials(row.original.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{row.original.name}</span>
              <span className="text-caption tabular-nums">{row.original.id}</span>
            </div>
          </div>
        ),
      },
      {
        id: "contact",
        meta: { label: t("drivers.columns.contact"), defaultHidden: true },
        header: t("drivers.columns.contact"),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="text-dense truncate">{row.original.email}</span>
            <span className="text-caption tabular-nums">{f.phone(row.original.phone)}</span>
          </div>
        ),
      },
      {
        id: "verification",
        meta: { label: t("drivers.columns.verification") },
        header: t("drivers.columns.verification"),
        cell: ({ row }) => (
          <StatusBadge kind="driverVerification" value={row.original.verification} />
        ),
      },
      {
        id: "licenceExpiresAt",
        enableSorting: true,
        meta: { label: t("drivers.columns.licence") },
        header: t("drivers.columns.licence"),
        cell: ({ row }) => <CredentialCell credential={row.original.licence} />,
      },
      {
        id: "tvdeExpiresAt",
        enableSorting: true,
        meta: { label: t("drivers.columns.tvde") },
        header: t("drivers.columns.tvde"),
        cell: ({ row }) => <CredentialCell credential={row.original.tvde} />,
      },
      {
        id: "fleet",
        meta: { label: t("drivers.columns.fleetVehicle"), className: "min-w-40" },
        header: t("drivers.columns.fleetVehicle"),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="text-dense flex items-center gap-1.5 truncate">
              <Building2 aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{row.original.fleetName ?? t("drivers.independent")}</span>
            </span>
            <span className="text-caption truncate">
              {row.original.vehiclePlate
                ? `${row.original.vehiclePlate} · ${row.original.vehicleLabel}`
                : t("drivers.noVehicle")}
            </span>
          </div>
        ),
      },
      {
        id: "presence",
        meta: { label: t("drivers.columns.presence"), className: "min-w-36" },
        header: t("drivers.columns.presence"),
        cell: ({ row }) => (
          <div className="flex flex-col items-start gap-1">
            <span className="text-dense flex items-center gap-1.5">
              <span
                aria-hidden
                className={
                  row.original.online
                    ? "size-2 rounded-full bg-success"
                    : "size-2 rounded-full bg-muted-foreground/40"
                }
              />
              {t(row.original.online ? "drivers.online" : "drivers.offline")}
            </span>
            {row.original.currentRideStatus ? (
              <StatusBadge kind="ride" value={row.original.currentRideStatus} />
            ) : (
              <span className="text-caption">{t("drivers.noRide")}</span>
            )}
          </div>
        ),
      },
      {
        id: "completedRides",
        enableSorting: true,
        meta: {
          label: t("drivers.columns.rides"),
          className: "text-right tabular-nums whitespace-nowrap",
        },
        header: t("drivers.columns.rides"),
        cell: ({ row }) => (
          <span>
            {f.number(row.original.completedRides)}
            <span className="text-caption"> / {f.number(row.original.cancelledRides)}</span>
          </span>
        ),
      },
      {
        id: "rating",
        enableSorting: true,
        meta: {
          label: t("drivers.columns.rating"),
          className: "text-right tabular-nums whitespace-nowrap",
        },
        header: t("drivers.columns.rating"),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1">
            <Star aria-hidden className="size-3.5 fill-warning text-warning" />
            {f.number(row.original.rating, { decimals: 1 })}
          </span>
        ),
      },
      {
        id: "account",
        meta: { label: t("drivers.columns.account") },
        header: t("drivers.columns.account"),
        cell: ({ row }) => <StatusBadge kind="account" value={row.original.accountStatus} />,
      },
    ],
    [t, f],
  );

  const getExport = async () => {
    const rows = await exportDrivers(filters);
    const col = (key: string, label: string) => ({ key, label });
    return {
      columns: [
        col("id", t("drivers.columns.id")),
        col("name", t("drivers.columns.driver")),
        col("email", t("drivers.export.email")),
        col("phone", t("drivers.export.phone")),
        col("verification", t("drivers.columns.verification")),
        col("licence", t("drivers.export.licenceExpiry")),
        col("tvde", t("drivers.export.tvdeExpiry")),
        col("fleet", t("drivers.export.fleet")),
        col("vehicle", t("drivers.export.vehicle")),
        col("online", t("drivers.columns.presence")),
        col("completed", t("drivers.export.completed")),
        col("cancelled", t("drivers.export.cancelled")),
        col("rating", t("drivers.columns.rating")),
        col("account", t("drivers.columns.account")),
      ],
      rows: rows.map((d) => ({
        id: d.id,
        name: d.name,
        email: d.email,
        phone: f.phone(d.phone),
        verification: t(`status.driverVerification.${d.verification}`),
        licence: f.date(d.licence.expiresAt),
        tvde: f.date(d.tvde.expiresAt),
        fleet: d.fleetName ?? t("drivers.independent"),
        vehicle: d.vehiclePlate ?? "",
        online: t(d.online ? "drivers.online" : "drivers.offline"),
        completed: d.completedRides,
        cancelled: d.cancelledRides,
        rating: d.rating,
        account: t(`status.account.${d.accountStatus}`),
      })),
    };
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title">{t("nav.items.drivers")}</h1>
        <p className="text-dense text-muted-foreground">{t("drivers.subtitle")}</p>
      </div>

      <FilterBar
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        actions={
          <Can module="drivers" action="export">
            <ExportButton filename={t("drivers.exportFile")} getData={getExport} />
          </Can>
        }
      >
        <SearchInput
          value={q}
          onChange={(v) => list.setFilters({ q: v })}
          placeholder={t("drivers.searchPlaceholder")}
        />
        <MultiSelectFilter
          label={t("drivers.filters.verification")}
          options={VERIFICATIONS.map((v) => ({
            value: v,
            label: t(`status.driverVerification.${v}`),
          }))}
          value={verification}
          onChange={(v) => list.setFilters({ verification: v })}
        />
        <MultiSelectFilter
          label={t("drivers.filters.account")}
          options={ACCOUNTS.map((v) => ({ value: v, label: t(`status.account.${v}`) }))}
          value={account}
          onChange={(v) => list.setFilters({ account: v })}
        />
        <MultiSelectFilter
          label={t("drivers.filters.presence")}
          options={PRESENCE.map((v) => ({ value: v, label: t(`drivers.${v}`) }))}
          value={presence}
          onChange={(v) => list.setFilters({ presence: v })}
        />
        {canSeeFleets && (
          <SingleSelectFilter
            label={t("drivers.filters.fleet")}
            options={
              fleets.data?.items.map((fl) => ({ value: fl.id, label: fl.companyName })) ?? []
            }
            value={fleet}
            onChange={(v) => list.setFilters({ fleet: v })}
          />
        )}
        <ToggleFilter
          label={t("drivers.filters.expiring")}
          pressed={expiring}
          onChange={(on) => list.setFilters({ expiring: on || null })}
        />
      </FilterBar>

      <DataTable
        tableId="drivers"
        caption={t("nav.items.drivers")}
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
        getRowId={(d) => d.id}
        onOpenRow={(d) => router.push(`/drivers/${d.id}`)}
        filtered={list.hasFilters}
        onClearFilters={list.clearFilters}
        rowActions={(d) => (
          <>
            <DropdownMenuItem onSelect={() => router.push(`/drivers/${d.id}`)}>
              <Eye />
              {t("drivers.actions.view")}
            </DropdownMenuItem>
            {allowed("documents", "view") && (
              <DropdownMenuItem onSelect={() => router.push(`/drivers/${d.id}?tab=documents`)}>
                <FileSearch />
                {t("drivers.actions.reviewDocuments")}
              </DropdownMenuItem>
            )}
            {allowed("drivers", "suspend") && <DropdownMenuSeparator />}
            {allowed("drivers", "approve") &&
              ["UNDER_REVIEW", "PENDING_DOCS", "REJECTED"].includes(d.verification) && (
                <DropdownMenuItem onSelect={() => router.push(`/drivers/${d.id}?tab=documents`)}>
                  <UserCheck />
                  {t("drivers.actions.checkEligibility")}
                </DropdownMenuItem>
              )}
            {allowed("drivers", "suspend") &&
              (d.accountStatus === "ACTIVE" ? (
                <DropdownMenuItem variant="destructive" onSelect={() => actions.open.status(d)}>
                  <Ban />
                  {t("drivers.actions.suspend")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => actions.open.status(d)}>
                  <RotateCcw />
                  {t("drivers.actions.reactivate")}
                </DropdownMenuItem>
              ))}
          </>
        )}
        mobileCard={(d) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarImage src={d.photoUrl} alt="" />
                <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
                  {initials(d.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">{d.name}</span>
                <span className="text-caption tabular-nums">
                  {d.id} · {d.online ? t("drivers.online") : t("drivers.offline")}
                </span>
              </div>
              <StatusBadge kind="account" value={d.accountStatus} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge kind="driverVerification" value={d.verification} />
              {d.licence.status !== "VALID" && (
                <StatusBadge kind="credential" value={d.licence.status} />
              )}
              {d.tvde.status !== "VALID" && <StatusBadge kind="credential" value={d.tvde.status} />}
            </div>
            <span className="text-caption">
              {t("drivers.columns.rides")}: {f.number(d.completedRides)} /{" "}
              {f.number(d.cancelledRides)} · ★ {f.number(d.rating, { decimals: 1 })}
            </span>
          </div>
        )}
      />
      {actions.dialogs}
    </div>
  );
}
