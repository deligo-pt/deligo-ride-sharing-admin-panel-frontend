"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import type { Settlement } from "@/types/finance";
import { StatusBadge } from "@/components/badges/status-badge";
import { DataTable } from "@/components/data/data-table";
import { PayeePayouts } from "@/components/detail/payee-payouts";
import { usePermission } from "@/components/session/permissions";
import { useSettlements } from "@/hooks/queries/commission";
import { useFormat } from "@/lib/use-format";

/**
 * Statements & settlements (§7 "financial statements and settlements"): the
 * weekly statements for the fleet (gross − commission − deductions = net) and
 * the bank transfers that paid them. Each table needs its module's `view`
 * (`commission`, `payouts`).
 */
export function FleetSettlementsTab({ fleetId }: { fleetId: string }) {
  const t = useTranslations("fleet.settlements");
  const allowed = usePermission();
  const showSettlements = allowed("commission", "view");
  const showPayouts = allowed("payouts", "view");
  return (
    <div className="flex flex-col gap-6">
      {showSettlements && (
        <section className="flex flex-col gap-3" aria-label={t("statementsTitle")}>
          {showPayouts && <h2 className="text-card-title">{t("statementsTitle")}</h2>}
          <FleetStatements fleetId={fleetId} />
        </section>
      )}
      {showPayouts && (
        <section className="flex flex-col gap-3" aria-label={t("payoutsTitle")}>
          {showSettlements && <h2 className="text-card-title">{t("payoutsTitle")}</h2>}
          <PayeePayouts payeeId={fleetId} caption={t("payoutsTitle")} />
        </section>
      )}
    </div>
  );
}

function FleetStatements({ fleetId }: { fleetId: string }) {
  const t = useTranslations("fleet.settlements");
  const f = useFormat();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [sort, setSort] = useState("");
  const query = useSettlements({ payeeId: fleetId, page, pageSize: size, sort: sort || undefined });
  const columns = useMemo<ColumnDef<Settlement, unknown>[]>(
    () => [
      {
        id: "id",
        meta: { label: t("columns.statement"), className: "tabular-nums whitespace-nowrap" },
        header: t("columns.statement"),
        cell: ({ row }) => row.original.id,
      },
      {
        id: "periodFrom",
        enableSorting: true,
        meta: { label: t("columns.period"), className: "whitespace-nowrap" },
        header: t("columns.period"),
        cell: ({ row }) =>
          `${f.dateShort(row.original.periodFrom)} – ${f.dateShort(row.original.periodTo)}`,
      },
      {
        id: "rideCount",
        enableSorting: true,
        meta: { label: t("columns.rides"), className: "text-right tabular-nums" },
        header: t("columns.rides"),
        cell: ({ row }) => f.number(row.original.rideCount),
      },
      {
        id: "grossCents",
        enableSorting: true,
        meta: { label: t("columns.gross"), className: "text-right tabular-nums" },
        header: t("columns.gross"),
        cell: ({ row }) => f.eur(row.original.grossCents),
      },
      {
        id: "commission",
        meta: { label: t("columns.commission"), className: "text-right tabular-nums" },
        header: t("columns.commission"),
        cell: ({ row }) => f.eur(row.original.commissionCents),
      },
      {
        id: "deductions",
        meta: { label: t("columns.deductions"), className: "text-right tabular-nums" },
        header: t("columns.deductions"),
        cell: ({ row }) => f.eur(row.original.deductionsCents),
      },
      {
        id: "netCents",
        enableSorting: true,
        meta: { label: t("columns.net"), className: "text-right tabular-nums font-medium" },
        header: t("columns.net"),
        cell: ({ row }) => f.eur(row.original.netCents),
      },
      {
        id: "status",
        meta: { label: t("columns.status") },
        header: t("columns.status"),
        cell: ({ row }) => <StatusBadge kind="settlement" value={row.original.status} />,
      },
    ],
    [t, f],
  );
  return (
    <DataTable
      tableId="fleet-settlements"
      caption={t("statementsTitle")}
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
      getRowId={(s) => s.id}
      emptyTitle={t("empty")}
      mobileCard={(s) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium tabular-nums">{f.eur(s.netCents)}</span>
            <StatusBadge kind="settlement" value={s.status} />
          </div>
          <span className="text-caption">
            {s.id} · {f.dateShort(s.periodFrom)} – {f.dateShort(s.periodTo)}
          </span>
        </div>
      )}
    />
  );
}
