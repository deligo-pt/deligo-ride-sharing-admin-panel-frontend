"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import type { TicketListItem } from "@/types/support";
import { StatusBadge } from "@/components/badges/status-badge";
import { DataTable } from "@/components/data/data-table";
import { useTickets } from "@/hooks/queries/support";
import { useFormat } from "@/lib/use-format";

/**
 * "Complaints & support" tab (§5): every ticket this customer opened or that
 * names them, newest first. Rows don't open yet — the ticket page arrives
 * with the Support module (P21).
 */
export function CustomerSupportTab({ customerId }: { customerId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [sort, setSort] = useState("");
  const query = useTickets({ customerId, page, pageSize: size, sort: sort || undefined });

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
      tableId="customer-tickets"
      caption={t("customers.tabs.support")}
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
      emptyTitle={t("customers.noTickets")}
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
