"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import type { Vehicle } from "@/types/vehicle";
import { StatusBadge } from "@/components/badges/status-badge";
import { DataTable } from "@/components/data/data-table";
import { useVehicles } from "@/hooks/queries/vehicles";
import { useRouter } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";
import { CredentialCell } from "@/features/drivers/credential-cell";

/** The vehicles registered under this fleet (§7 "view registered vehicles"). Rows open the vehicle page. */
export function FleetVehiclesTab({ fleetId }: { fleetId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [sort, setSort] = useState("");
  const query = useVehicles({
    fleetManagerId: fleetId,
    page,
    pageSize: size,
    sort: sort || undefined,
  });

  const columns = useMemo<ColumnDef<Vehicle, unknown>[]>(
    () => [
      {
        id: "plate",
        enableSorting: true,
        meta: {
          label: t("fleet.vehicleColumns.vehicle"),
          alwaysVisible: true,
          className: "min-w-48",
        },
        header: t("fleet.vehicleColumns.vehicle"),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="tabular font-medium">{row.original.plate}</span>
            <span className="text-caption truncate">
              {row.original.make} {row.original.model} ({row.original.year})
            </span>
          </div>
        ),
      },
      {
        id: "category",
        meta: { label: t("fleet.vehicleColumns.category") },
        header: t("fleet.vehicleColumns.category"),
        cell: ({ row }) => t(`enums.rideCategory.${row.original.category}`),
      },
      {
        id: "approval",
        meta: { label: t("fleet.vehicleColumns.approval") },
        header: t("fleet.vehicleColumns.approval"),
        cell: ({ row }) => <StatusBadge kind="vehicleApproval" value={row.original.approval} />,
      },
      {
        id: "operational",
        meta: { label: t("fleet.vehicleColumns.operational") },
        header: t("fleet.vehicleColumns.operational"),
        cell: ({ row }) => (
          <StatusBadge kind="vehicleOperational" value={row.original.operational} />
        ),
      },
      {
        id: "insuranceExpiresAt",
        enableSorting: true,
        meta: { label: t("fleet.vehicleColumns.insurance") },
        header: t("fleet.vehicleColumns.insurance"),
        cell: ({ row }) => <CredentialCell credential={row.original.insurance} />,
      },
      {
        id: "inspectionExpiresAt",
        enableSorting: true,
        meta: { label: t("fleet.vehicleColumns.inspection") },
        header: t("fleet.vehicleColumns.inspection"),
        cell: ({ row }) => <CredentialCell credential={row.original.inspection} />,
      },
    ],
    [t],
  );

  return (
    <DataTable
      tableId="fleet-vehicles"
      caption={t("fleet.tabs.vehicles")}
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
      getRowId={(v) => v.id}
      onOpenRow={(v) => router.push(`/vehicles/${v.id}`)}
      emptyTitle={t("fleet.noVehicles")}
      mobileCard={(v) => (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="tabular font-medium">{v.plate}</span>
            <StatusBadge kind="vehicleApproval" value={v.approval} />
          </div>
          <span className="text-caption">
            {v.make} {v.model} · {t("fleet.vehicleColumns.insurance")}:{" "}
            {f.date(v.insurance.expiresAt)}
          </span>
        </div>
      )}
    />
  );
}
