"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DriverListItem } from "@/types/driver";
import { StatusBadge } from "@/components/badges/status-badge";
import { DataTable } from "@/components/data/data-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDrivers } from "@/hooks/queries/drivers";
import { useRouter } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";
import { initials } from "@/lib/utils";

/** The drivers who work for this fleet (§7 "view associated drivers"). Rows open the driver profile. */
export function FleetDriversTab({ fleetId }: { fleetId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [sort, setSort] = useState("");
  const query = useDrivers({
    fleetManagerId: fleetId,
    page,
    pageSize: size,
    sort: sort || undefined,
  });

  const columns = useMemo<ColumnDef<DriverListItem, unknown>[]>(
    () => [
      {
        id: "name",
        enableSorting: true,
        meta: {
          label: t("fleet.driverColumns.driver"),
          alwaysVisible: true,
          className: "min-w-56",
        },
        header: t("fleet.driverColumns.driver"),
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
        id: "verification",
        meta: { label: t("fleet.driverColumns.verification") },
        header: t("fleet.driverColumns.verification"),
        cell: ({ row }) => (
          <StatusBadge kind="driverVerification" value={row.original.verification} />
        ),
      },
      {
        id: "vehicle",
        meta: { label: t("fleet.driverColumns.vehicle"), className: "whitespace-nowrap" },
        header: t("fleet.driverColumns.vehicle"),
        cell: ({ row }) =>
          row.original.vehiclePlate
            ? `${row.original.vehiclePlate} · ${row.original.vehicleLabel}`
            : t("drivers.noVehicle"),
      },
      {
        id: "presence",
        meta: { label: t("fleet.driverColumns.presence") },
        header: t("fleet.driverColumns.presence"),
        cell: ({ row }) => (
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
        ),
      },
      {
        id: "completedRides",
        enableSorting: true,
        meta: { label: t("fleet.driverColumns.rides"), className: "text-right tabular-nums" },
        header: t("fleet.driverColumns.rides"),
        cell: ({ row }) => f.number(row.original.completedRides),
      },
      {
        id: "rating",
        enableSorting: true,
        meta: {
          label: t("fleet.driverColumns.rating"),
          className: "text-right tabular-nums whitespace-nowrap",
        },
        header: t("fleet.driverColumns.rating"),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1">
            <Star aria-hidden className="size-3.5 fill-warning text-warning" />
            {f.number(row.original.rating, { decimals: 1 })}
          </span>
        ),
      },
      {
        id: "account",
        meta: { label: t("fleet.driverColumns.account") },
        header: t("fleet.driverColumns.account"),
        cell: ({ row }) => <StatusBadge kind="account" value={row.original.accountStatus} />,
      },
    ],
    [t, f],
  );

  return (
    <DataTable
      tableId="fleet-drivers"
      caption={t("fleet.tabs.drivers")}
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
      onPageSizeChange={(s) => (setSize(s), setPage(1))}
      getRowId={(d) => d.id}
      onOpenRow={(d) => router.push(`/drivers/${d.id}`)}
      emptyTitle={t("fleet.noDrivers")}
      mobileCard={(d) => (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{d.name}</span>
            <StatusBadge kind="account" value={d.accountStatus} />
          </div>
          <span className="text-caption">
            {d.id} · {d.online ? t("drivers.online") : t("drivers.offline")} · ★{" "}
            {f.number(d.rating, { decimals: 1 })}
          </span>
        </div>
      )}
    />
  );
}
