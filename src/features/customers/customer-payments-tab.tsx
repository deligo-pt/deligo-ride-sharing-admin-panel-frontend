"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import type { Invoice } from "@/types/invoice";
import type { PaymentListItem } from "@/types/payment";
import { StatusBadge } from "@/components/badges/status-badge";
import { DataTable } from "@/components/data/data-table";
import { usePermission } from "@/components/session/permissions";
import { useInvoices } from "@/hooks/queries/invoices";
import { usePayments } from "@/hooks/queries/payments";
import { useFormat } from "@/lib/use-format";

/**
 * "Payments & invoices" tab (§5 "payment history and invoices, where
 * permitted"): each table appears only when the role may open that module.
 */
export function CustomerPaymentsTab({ customerId }: { customerId: string }) {
  const t = useTranslations("customers");
  const allowed = usePermission();
  const showPayments = allowed("payments", "view");
  const showInvoices = allowed("invoices", "view");
  return (
    <div className="flex flex-col gap-6">
      {showPayments && (
        <section className="flex flex-col gap-3" aria-label={t("sections.payments")}>
          {showInvoices && <h2 className="text-card-title">{t("sections.payments")}</h2>}
          <CustomerPayments customerId={customerId} />
        </section>
      )}
      {showInvoices && (
        <section className="flex flex-col gap-3" aria-label={t("sections.invoices")}>
          {showPayments && <h2 className="text-card-title">{t("sections.invoices")}</h2>}
          <CustomerInvoices customerId={customerId} />
        </section>
      )}
    </div>
  );
}

function CustomerPayments({ customerId }: { customerId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [sort, setSort] = useState("");
  const query = usePayments({ customerId, page, pageSize: size, sort: sort || undefined });
  const columns = useMemo<ColumnDef<PaymentListItem, unknown>[]>(
    () => [
      {
        id: "id",
        meta: {
          label: t("customers.paymentColumns.payment"),
          className: "tabular-nums whitespace-nowrap",
        },
        header: t("customers.paymentColumns.payment"),
        cell: ({ row }) => row.original.id,
      },
      {
        id: "createdAt",
        enableSorting: true,
        meta: { label: t("customers.paymentColumns.date"), className: "whitespace-nowrap" },
        header: t("customers.paymentColumns.date"),
        cell: ({ row }) => f.dateTime(row.original.createdAt),
      },
      {
        id: "method",
        meta: { label: t("customers.paymentColumns.method") },
        header: t("customers.paymentColumns.method"),
        cell: ({ row }) =>
          row.original.methodDetail ?? t(`enums.paymentMethod.${row.original.method}`),
      },
      {
        id: "amountCents",
        enableSorting: true,
        meta: { label: t("customers.paymentColumns.amount"), className: "text-right tabular-nums" },
        header: t("customers.paymentColumns.amount"),
        cell: ({ row }) => f.eur(row.original.amountCents),
      },
      {
        id: "status",
        meta: { label: t("customers.paymentColumns.status") },
        header: t("customers.paymentColumns.status"),
        cell: ({ row }) => <StatusBadge kind="payment" value={row.original.status} />,
      },
    ],
    [t, f],
  );
  return (
    <DataTable
      tableId="customer-payments"
      caption={t("customers.sections.payments")}
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
      getRowId={(p) => p.id}
      emptyTitle={t("customers.noPayments")}
      mobileCard={(p) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium tabular-nums">{f.eur(p.amountCents)}</span>
            <StatusBadge kind="payment" value={p.status} />
          </div>
          <span className="text-caption">
            {p.id} · {f.dateTime(p.createdAt)}
          </span>
        </div>
      )}
    />
  );
}

function CustomerInvoices({ customerId }: { customerId: string }) {
  const t = useTranslations();
  const f = useFormat();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [sort, setSort] = useState("");
  const query = useInvoices({ customerId, page, pageSize: size, sort: sort || undefined });
  const columns = useMemo<ColumnDef<Invoice, unknown>[]>(
    () => [
      {
        id: "number",
        meta: {
          label: t("customers.invoiceColumns.number"),
          className: "tabular-nums whitespace-nowrap",
        },
        header: t("customers.invoiceColumns.number"),
        cell: ({ row }) => row.original.number,
      },
      {
        id: "issuedAt",
        enableSorting: true,
        meta: { label: t("customers.invoiceColumns.date"), className: "whitespace-nowrap" },
        header: t("customers.invoiceColumns.date"),
        cell: ({ row }) => f.dateTime(row.original.issuedAt),
      },
      {
        id: "rideId",
        meta: {
          label: t("customers.invoiceColumns.ride"),
          className: "tabular-nums whitespace-nowrap",
        },
        header: t("customers.invoiceColumns.ride"),
        cell: ({ row }) => row.original.rideId,
      },
      {
        id: "vat",
        meta: {
          label: t("customers.invoiceColumns.vat"),
          className: "text-right tabular-nums whitespace-nowrap",
        },
        header: t("customers.invoiceColumns.vat"),
        cell: ({ row }) =>
          `${f.eur(row.original.vatCents)} (${f.percent(row.original.vatRate, 0)})`,
      },
      {
        id: "totalCents",
        enableSorting: true,
        meta: { label: t("customers.invoiceColumns.total"), className: "text-right tabular-nums" },
        header: t("customers.invoiceColumns.total"),
        cell: ({ row }) => f.eur(row.original.totalCents),
      },
      {
        id: "status",
        meta: { label: t("customers.invoiceColumns.status") },
        header: t("customers.invoiceColumns.status"),
        cell: ({ row }) => <StatusBadge kind="invoice" value={row.original.status} />,
      },
    ],
    [t, f],
  );
  return (
    <DataTable
      tableId="customer-invoices"
      caption={t("customers.sections.invoices")}
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
      getRowId={(i) => i.id}
      emptyTitle={t("customers.noInvoices")}
      mobileCard={(i) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium tabular-nums">{i.number}</span>
            <StatusBadge kind="invoice" value={i.status} />
          </div>
          <span className="text-caption">
            {f.dateTime(i.issuedAt)} · {f.eur(i.totalCents)}
          </span>
        </div>
      )}
    />
  );
}
