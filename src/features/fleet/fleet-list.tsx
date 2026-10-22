"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, Eye, FileSearch, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { FleetManager } from "@/types/fleet";
import { StatusBadge, statusValues } from "@/components/badges/status-badge";
import { DataTable } from "@/components/data/data-table";
import { ExportButton } from "@/components/data/export-button";
import { FilterBar, MultiSelectFilter, SearchInput } from "@/components/data/filter-bar";
import { enumList, useListState } from "@/components/data/use-list-state";
import { Can, usePermission } from "@/components/session/permissions";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useFleetManagers } from "@/hooks/queries/fleet";
import { useRouter } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";
import { exportFleetManagers } from "@/services/fleet";
import { useFleetActions } from "./fleet-actions";

/**
 * Fleet managers list (§7) — copy of the P5 list template. Filters live in
 * the URL: `?verification=PENDING` (the dashboard links here) and `?account=`.
 */
const VERIFICATIONS = statusValues("fleetVerification");
const ACCOUNTS = statusValues("account");

export function FleetList() {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const allowed = usePermission();
  const list = useListState({ verification: enumList(VERIFICATIONS), account: enumList(ACCOUNTS) });
  const { page, size, q, sort, verification, account } = list.state;

  const filters = {
    q: q || undefined,
    sort: sort || undefined,
    verification,
    accountStatus: account,
  };
  const query = useFleetManagers({ ...filters, page, pageSize: size });
  const actions = useFleetActions();

  const columns = useMemo<ColumnDef<FleetManager, unknown>[]>(
    () => [
      {
        id: "companyName",
        enableSorting: true,
        meta: { label: t("fleet.columns.company"), alwaysVisible: true, className: "min-w-56" },
        header: t("fleet.columns.company"),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{row.original.companyName}</span>
            <span className="text-caption truncate">
              {row.original.contactName} · <span className="tabular-nums">{row.original.id}</span>
            </span>
          </div>
        ),
      },
      {
        id: "contact",
        meta: { label: t("fleet.columns.contact") },
        header: t("fleet.columns.contact"),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="text-dense truncate">{row.original.email}</span>
            <span className="text-caption tabular-nums">{f.phone(row.original.phone)}</span>
          </div>
        ),
      },
      {
        id: "verification",
        meta: { label: t("fleet.columns.verification") },
        header: t("fleet.columns.verification"),
        cell: ({ row }) => (
          <StatusBadge kind="fleetVerification" value={row.original.verification} />
        ),
      },
      {
        id: "drivers",
        enableSorting: true,
        meta: { label: t("fleet.columns.drivers"), className: "text-right tabular-nums" },
        header: t("fleet.columns.drivers"),
        cell: ({ row }) => f.number(row.original.driverIds.length),
      },
      {
        id: "vehicles",
        enableSorting: true,
        meta: { label: t("fleet.columns.vehicles"), className: "text-right tabular-nums" },
        header: t("fleet.columns.vehicles"),
        cell: ({ row }) => f.number(row.original.vehicleIds.length),
      },
      {
        id: "completedRides",
        enableSorting: true,
        meta: { label: t("fleet.columns.rides"), className: "text-right tabular-nums" },
        header: t("fleet.columns.rides"),
        cell: ({ row }) => f.number(row.original.completedRides),
      },
      {
        id: "settlementBalanceCents",
        enableSorting: true,
        meta: {
          label: t("fleet.columns.balance"),
          className: "text-right tabular-nums whitespace-nowrap",
        },
        header: t("fleet.columns.balance"),
        cell: ({ row }) => f.eur(row.original.settlementBalanceCents),
      },
      {
        id: "account",
        meta: { label: t("fleet.columns.account") },
        header: t("fleet.columns.account"),
        cell: ({ row }) => <StatusBadge kind="account" value={row.original.accountStatus} />,
      },
    ],
    [t, f],
  );

  const getExport = async () => {
    const rows = await exportFleetManagers(filters);
    const col = (key: string, label: string) => ({ key, label });
    return {
      columns: [
        col("id", t("fleet.columns.id")),
        col("company", t("fleet.columns.company")),
        col("contactName", t("fleet.export.contactName")),
        col("email", t("fleet.export.email")),
        col("phone", t("fleet.export.phone")),
        col("nif", t("fleet.export.nif")),
        col("verification", t("fleet.columns.verification")),
        col("drivers", t("fleet.columns.drivers")),
        col("vehicles", t("fleet.columns.vehicles")),
        col("rides", t("fleet.columns.rides")),
        col("balance", t("fleet.export.balance")),
        col("account", t("fleet.columns.account")),
      ],
      rows: rows.map((fl) => ({
        id: fl.id,
        company: fl.companyName,
        contactName: fl.contactName,
        email: fl.email,
        phone: f.phone(fl.phone),
        nif: fl.nif,
        verification: t(`status.fleetVerification.${fl.verification}`),
        drivers: fl.driverIds.length,
        vehicles: fl.vehicleIds.length,
        rides: fl.completedRides,
        balance: fl.settlementBalanceCents / 100,
        account: t(`status.account.${fl.accountStatus}`),
      })),
    };
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title">{t("nav.items.fleet")}</h1>
        <p className="text-dense text-muted-foreground">{t("fleet.subtitle")}</p>
      </div>

      <FilterBar
        hasFilters={list.hasFilters}
        onClear={list.clearFilters}
        actions={
          <Can module="fleet" action="export">
            <ExportButton filename={t("fleet.exportFile")} getData={getExport} />
          </Can>
        }
      >
        <SearchInput
          value={q}
          onChange={(v) => list.setFilters({ q: v })}
          placeholder={t("fleet.searchPlaceholder")}
        />
        <MultiSelectFilter
          label={t("fleet.filters.verification")}
          options={VERIFICATIONS.map((v) => ({
            value: v,
            label: t(`status.fleetVerification.${v}`),
          }))}
          value={verification}
          onChange={(v) => list.setFilters({ verification: v })}
        />
        <MultiSelectFilter
          label={t("fleet.filters.account")}
          options={ACCOUNTS.map((v) => ({ value: v, label: t(`status.account.${v}`) }))}
          value={account}
          onChange={(v) => list.setFilters({ account: v })}
        />
      </FilterBar>

      <DataTable
        tableId="fleet"
        caption={t("nav.items.fleet")}
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
        getRowId={(fl) => fl.id}
        onOpenRow={(fl) => router.push(`/fleet-managers/${fl.id}`)}
        filtered={list.hasFilters}
        onClearFilters={list.clearFilters}
        rowActions={(fl) => (
          <>
            <DropdownMenuItem onSelect={() => router.push(`/fleet-managers/${fl.id}`)}>
              <Eye />
              {t("fleet.actions.view")}
            </DropdownMenuItem>
            {allowed("documents", "view") && (
              <DropdownMenuItem
                onSelect={() => router.push(`/fleet-managers/${fl.id}?tab=documents`)}
              >
                <FileSearch />
                {t("fleet.actions.reviewDocuments")}
              </DropdownMenuItem>
            )}
            {allowed("fleet", "suspend") && <DropdownMenuSeparator />}
            {allowed("fleet", "suspend") &&
              (fl.accountStatus === "ACTIVE" ? (
                <DropdownMenuItem variant="destructive" onSelect={() => actions.open.status(fl)}>
                  <Ban />
                  {t("fleet.actions.suspend")}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => actions.open.status(fl)}>
                  <RotateCcw />
                  {t("fleet.actions.reactivate")}
                </DropdownMenuItem>
              ))}
          </>
        )}
        mobileCard={(fl) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{fl.companyName}</span>
              <StatusBadge kind="account" value={fl.accountStatus} />
            </div>
            <span className="text-caption truncate">
              {fl.contactName} · {fl.id}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge kind="fleetVerification" value={fl.verification} />
              <span className="text-caption">
                {t("fleet.columns.drivers")}: {f.number(fl.driverIds.length)} ·{" "}
                {t("fleet.columns.vehicles")}: {f.number(fl.vehicleIds.length)}
              </span>
            </div>
            <span className="text-caption tabular-nums">
              {t("fleet.columns.balance")}: {f.eur(fl.settlementBalanceCents)}
            </span>
          </div>
        )}
      />
      {actions.dialogs}
    </div>
  );
}
