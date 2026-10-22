"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import type { Payout } from "@/types/payout";
import { StatusBadge } from "@/components/badges/status-badge";
import { DataTable } from "@/components/data/data-table";
import { usePayouts } from "@/hooks/queries/payouts";
import { useFormat } from "@/lib/use-format";

/**
 * Bank transfers (SEPA payouts) to one driver or fleet manager (§13). Needs
 * `payouts.view` — the caller decides whether to render it.
 */
export function PayeePayouts({ payeeId, caption }: { payeeId: string; caption: string }) {
  const t = useTranslations("payouts.payee");
  const f = useFormat();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [sort, setSort] = useState("");
  const query = usePayouts({ payeeId, page, pageSize: size, sort: sort || undefined });
  const columns = useMemo<ColumnDef<Payout, unknown>[]>(
    () => [
      {
        id: "id",
        meta: { label: t("payout"), className: "tabular-nums whitespace-nowrap" },
        header: t("payout"),
        cell: ({ row }) => row.original.id,
      },
      {
        id: "createdAt",
        enableSorting: true,
        meta: { label: t("date"), className: "whitespace-nowrap" },
        header: t("date"),
        cell: ({ row }) => f.date(row.original.createdAt),
      },
      {
        id: "amountCents",
        enableSorting: true,
        meta: { label: t("amount"), className: "text-right tabular-nums" },
        header: t("amount"),
        cell: ({ row }) => f.eur(row.original.amountCents),
      },
      {
        id: "iban",
        meta: { label: t("iban"), className: "whitespace-nowrap tabular-nums" },
        header: t("iban"),
        cell: ({ row }) => row.original.ibanMasked,
      },
      {
        id: "status",
        meta: { label: t("status") },
        header: t("status"),
        cell: ({ row }) => (
          <div className="flex flex-col items-start gap-1">
            <StatusBadge kind="payout" value={row.original.status} />
            {row.original.failureReason && (
              <span className="text-caption text-destructive">{row.original.failureReason}</span>
            )}
          </div>
        ),
      },
    ],
    [t, f],
  );
  return (
    <DataTable
      tableId="payee-payouts"
      caption={caption}
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
      emptyTitle={t("empty")}
      mobileCard={(p) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium tabular-nums">{f.eur(p.amountCents)}</span>
            <StatusBadge kind="payout" value={p.status} />
          </div>
          <span className="text-caption">
            {p.id} · {f.date(p.createdAt)}
          </span>
        </div>
      )}
    />
  );
}
