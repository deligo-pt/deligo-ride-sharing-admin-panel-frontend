"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import type { DriverListItem } from "@/types/driver";
import type { RideListItem } from "@/types/ride";
import { StatusBadge } from "@/components/badges/status-badge";
import { DataTable } from "@/components/data/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { useRides } from "@/hooks/queries/rides";
import { useRouter } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";

/** Rides & performance (§6): headline numbers, then the driver's ride history. */
export function DriverRidesTab({ driver }: { driver: DriverListItem }) {
  const t = useTranslations("drivers.performance");
  const f = useFormat();
  const finished = driver.completedRides + driver.cancelledRides;
  const cards = [
    { label: t("completed"), value: f.number(driver.completedRides) },
    { label: t("cancelled"), value: f.number(driver.cancelledRides) },
    {
      label: t("cancellationRate"),
      value: finished ? f.percent(driver.cancelledRides / finished, 1) : "—",
    },
    { label: t("rating"), value: `${f.number(driver.rating, { decimals: 1 })} / 5` },
  ];
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} size="sm">
            <CardContent className="flex flex-col gap-1">
              <dt className="text-dense text-muted-foreground">{c.label}</dt>
              <dd className="tabular text-2xl font-bold tracking-tight">{c.value}</dd>
            </CardContent>
          </Card>
        ))}
      </dl>
      <DriverRides driverId={driver.id} />
    </div>
  );
}

function DriverRides({ driverId }: { driverId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [sort, setSort] = useState("");
  const query = useRides({ driverId, page, pageSize: size, sort: sort || undefined });
  const columns = useMemo<ColumnDef<RideListItem, unknown>[]>(
    () => [
      {
        id: "id",
        meta: { label: t("drivers.rideColumns.ride"), className: "tabular-nums whitespace-nowrap" },
        header: t("drivers.rideColumns.ride"),
        cell: ({ row }) => row.original.id,
      },
      {
        id: "bookedAt",
        enableSorting: true,
        meta: { label: t("drivers.rideColumns.date"), className: "whitespace-nowrap" },
        header: t("drivers.rideColumns.date"),
        cell: ({ row }) => f.dateTime(row.original.bookedAt),
      },
      {
        id: "route",
        meta: { label: t("drivers.rideColumns.route"), className: "max-w-80" },
        header: t("drivers.rideColumns.route"),
        cell: ({ row }) => (
          <span className="block truncate">
            {row.original.pickup.address.split(",")[0]} →{" "}
            {row.original.dropoff.address.split(",")[0]}
          </span>
        ),
      },
      {
        id: "customer",
        meta: { label: t("drivers.rideColumns.customer") },
        header: t("drivers.rideColumns.customer"),
        cell: ({ row }) => row.original.customerName,
      },
      {
        id: "finalFareCents",
        enableSorting: true,
        meta: { label: t("drivers.rideColumns.fare"), className: "text-right tabular-nums" },
        header: t("drivers.rideColumns.fare"),
        cell: ({ row }) => f.eur(row.original.finalFareCents ?? row.original.estimatedFareCents),
      },
      {
        id: "status",
        meta: { label: t("drivers.rideColumns.status") },
        header: t("drivers.rideColumns.status"),
        cell: ({ row }) => <StatusBadge kind="ride" value={row.original.status} />,
      },
    ],
    [t, f],
  );
  return (
    <DataTable
      tableId="driver-rides"
      caption={t("drivers.tabs.rides")}
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
      getRowId={(r) => r.id}
      onOpenRow={(r) => router.push(`/rides/${r.id}`)}
      emptyTitle={t("drivers.noRides")}
      mobileCard={(r) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium tabular-nums">{r.id}</span>
            <StatusBadge kind="ride" value={r.status} />
          </div>
          <span className="text-caption">
            {f.dateTime(r.bookedAt)} · {f.eur(r.finalFareCents ?? r.estimatedFareCents)}
          </span>
        </div>
      )}
    />
  );
}
