"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import type { IncidentListItem, TicketListItem } from "@/types/support";
import { StatusBadge } from "@/components/badges/status-badge";
import { DataTable } from "@/components/data/data-table";
import { useIncidents, useTickets } from "@/hooks/queries/support";
import { useFormat } from "@/lib/use-format";

/**
 * Complaints & incidents (§6): tickets that name this driver and the SOS
 * alerts raised on their rides. Rows don't open yet — the Support module
 * (P21) adds the ticket and incident pages.
 */
export function DriverSupportTab({ driverId }: { driverId: string }) {
  const t = useTranslations("drivers.support");
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3" aria-label={t("ticketsTitle")}>
        <h2 className="text-card-title">{t("ticketsTitle")}</h2>
        <DriverTickets driverId={driverId} />
      </section>
      <section className="flex flex-col gap-3" aria-label={t("incidentsTitle")}>
        <h2 className="text-card-title">{t("incidentsTitle")}</h2>
        <DriverIncidents driverId={driverId} />
      </section>
    </div>
  );
}

function DriverTickets({ driverId }: { driverId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [sort, setSort] = useState("");
  const query = useTickets({ driverId, page, pageSize: size, sort: sort || undefined });
  const columns = useMemo<ColumnDef<TicketListItem, unknown>[]>(
    () => [
      {
        id: "subject",
        meta: {
          label: t("customers.ticketColumns.ticket"),
          alwaysVisible: true,
          className: "min-w-56",
        },
        header: t("customers.ticketColumns.ticket"),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{row.original.subject}</span>
            <span className="text-caption truncate">{row.original.id}</span>
          </div>
        ),
      },
      {
        id: "category",
        meta: { label: t("customers.ticketColumns.category") },
        header: t("customers.ticketColumns.category"),
        cell: ({ row }) => t(`enums.ticketCategory.${row.original.category}`),
      },
      {
        id: "createdAt",
        enableSorting: true,
        meta: { label: t("customers.ticketColumns.date"), className: "whitespace-nowrap" },
        header: t("customers.ticketColumns.date"),
        cell: ({ row }) => f.dateTime(row.original.createdAt),
      },
      {
        id: "priority",
        meta: { label: t("customers.ticketColumns.priority") },
        header: t("customers.ticketColumns.priority"),
        cell: ({ row }) => <StatusBadge kind="priority" value={row.original.priority} />,
      },
      {
        id: "status",
        meta: { label: t("customers.ticketColumns.status") },
        header: t("customers.ticketColumns.status"),
        cell: ({ row }) => <StatusBadge kind="ticket" value={row.original.status} />,
      },
    ],
    [t, f],
  );
  return (
    <DataTable
      tableId="driver-tickets"
      caption={t("drivers.support.ticketsTitle")}
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
      getRowId={(ticket) => ticket.id}
      emptyTitle={t("drivers.support.noTickets")}
      mobileCard={(ticket) => (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{ticket.subject}</span>
            <StatusBadge kind="ticket" value={ticket.status} />
          </div>
          <span className="text-caption">
            {ticket.id} · {t(`enums.ticketCategory.${ticket.category}`)} ·{" "}
            {f.dateTime(ticket.createdAt)}
          </span>
        </div>
      )}
    />
  );
}

function DriverIncidents({ driverId }: { driverId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const query = useIncidents({ driverId, page, pageSize: size });
  const columns = useMemo<ColumnDef<IncidentListItem, unknown>[]>(
    () => [
      {
        id: "id",
        meta: {
          label: t("drivers.support.incidentColumns.incident"),
          className: "tabular-nums whitespace-nowrap",
        },
        header: t("drivers.support.incidentColumns.incident"),
        cell: ({ row }) => row.original.id,
      },
      {
        id: "rideId",
        meta: {
          label: t("drivers.support.incidentColumns.ride"),
          className: "tabular-nums whitespace-nowrap",
        },
        header: t("drivers.support.incidentColumns.ride"),
        cell: ({ row }) => row.original.rideId,
      },
      {
        id: "raisedAt",
        meta: {
          label: t("drivers.support.incidentColumns.raised"),
          className: "whitespace-nowrap",
        },
        header: t("drivers.support.incidentColumns.raised"),
        cell: ({ row }) => f.dateTime(row.original.raisedAt),
      },
      {
        id: "initiator",
        meta: { label: t("drivers.support.incidentColumns.by") },
        header: t("drivers.support.incidentColumns.by"),
        cell: ({ row }) => t(`drivers.support.initiator.${row.original.initiator}`),
      },
      {
        id: "status",
        meta: { label: t("drivers.support.incidentColumns.status") },
        header: t("drivers.support.incidentColumns.status"),
        cell: ({ row }) => <StatusBadge kind="incident" value={row.original.status} />,
      },
    ],
    [t, f],
  );
  return (
    <DataTable
      tableId="driver-incidents"
      caption={t("drivers.support.incidentsTitle")}
      columns={columns}
      data={query.data}
      isPending={query.isPending}
      isFetching={query.isFetching}
      error={query.error}
      onRetry={() => query.refetch()}
      sort=""
      onSortChange={() => undefined}
      pageSize={size}
      onPageChange={setPage}
      onPageSizeChange={(s) => (setSize(s), setPage(1))}
      getRowId={(i) => i.id}
      emptyTitle={t("drivers.support.noIncidents")}
      mobileCard={(i) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium tabular-nums">{i.id}</span>
            <StatusBadge kind="incident" value={i.status} />
          </div>
          <span className="text-caption">
            {i.rideId} · {f.dateTime(i.raisedAt)}
          </span>
        </div>
      )}
    />
  );
}
