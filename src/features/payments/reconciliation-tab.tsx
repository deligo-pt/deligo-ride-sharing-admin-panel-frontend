"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CircleCheck, Clock, Eye, GitCompare, Hourglass, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { RECONCILIATION_STATES, type PaymentListItem, type ReconciliationState } from "@/types/payment";
import { StatusBadge } from "@/components/badges/status-badge";
import { DataTable } from "@/components/data/data-table";
import { usePermission } from "@/components/session/permissions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { usePaymentSummary, usePayments } from "@/hooks/queries/payments";
import { useFormat } from "@/lib/use-format";
import { MetricCard, MetricCardSkeleton } from "@/components/data/metric-card";

/**
 * Reconciliation (§12): payments matched against the gateway's settlement
 * file. Five cards count the states (the one picked is in the URL, `?rec=`);
 * the table lists them. "Needs review" — should be in the file and isn't
 * matched — is the working list: it shows what the file says and lets
 * Finance mark a payment as reconciled after checking it (reason, audited).
 * The file itself is simulated in this prototype.
 */
const ICON = {
  MISMATCH: GitCompare,
  AWAITING_FILE: Clock,
  MATCHED: CircleCheck,
  IN_PROGRESS: Hourglass,
  NOT_EXPECTED: XCircle,
} as const;

export function ReconciliationTab({
  onOpen,
  onReconcile,
}: {
  onOpen: (id: string) => void;
  onReconcile: (payment: PaymentListItem) => void;
}) {
  const t = useTranslations("payments.reconciliation");
  const f = useFormat();
  const [state, setState] = useQueryState(
    "rec",
    parseAsStringLiteral(RECONCILIATION_STATES).withDefault("MISMATCH").withOptions({ history: "replace", clearOnDefault: true }),
  );
  const summary = usePaymentSummary({});
  const s = summary.data;
  const counts: Record<ReconciliationState, number> | undefined = s && {
    MISMATCH: s.mismatched,
    AWAITING_FILE: s.awaitingFile,
    MATCHED: s.matched,
    IN_PROGRESS: s.pending,
    NOT_EXPECTED: s.notExpected,
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-dense max-w-3xl text-muted-foreground">{t("intro")}</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {counts
          ? RECONCILIATION_STATES.map((key) => (
              <MetricCard
                key={key}
                icon={ICON[key]}
                tone={key === "MISMATCH" && counts[key] > 0 ? "warning" : key === "MATCHED" ? "success" : "default"}
                label={t(`state.${key}.label`)}
                value={f.number(counts[key])}
                sub={key === "MISMATCH" && s ? f.eur(s.mismatchedCents) : t(`state.${key}.hint`)}
                pressed={state === key}
                onClick={() => setState(key)}
              />
            ))
          : Array.from({ length: 5 }, (_, i) => <MetricCardSkeleton key={i} />)}
      </div>
      <StateTable key={state} state={state} onOpen={onOpen} onReconcile={onReconcile} />
    </div>
  );
}

/** The table for one state; remounts per state so its page and sort start over. */
function StateTable({
  state,
  onOpen,
  onReconcile,
}: {
  state: ReconciliationState;
  onOpen: (id: string) => void;
  onReconcile: (payment: PaymentListItem) => void;
}) {
  const t = useTranslations();
  const f = useFormat();
  const allowed = usePermission();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(25);
  const [sort, setSort] = useState("");
  const query = usePayments({ reconciliation: [state], page, pageSize: size, sort: sort || undefined });
  const canReconcile = state === "MISMATCH" && allowed("payments", "refund");

  const gatewayText = (p: PaymentListItem) => {
    const m = p.mismatch;
    if (!m) return "—";
    return m.kind === "AMOUNT_DIFFERS"
      ? t("payments.reconciliation.gateway.AMOUNT_DIFFERS", { amount: f.eur(m.gatewayAmountCents) })
      : m.kind === "STATUS_DIFFERS"
        ? t("payments.reconciliation.gateway.STATUS_DIFFERS", { status: t(`payments.drawer.mismatchStatus.${m.gatewayStatus}`) })
        : t("payments.reconciliation.gateway.MISSING");
  };

  const columns = useMemo<ColumnDef<PaymentListItem, unknown>[]>(
    () => [
      {
        id: "id",
        meta: { label: t("payments.reconciliation.columns.id"), alwaysVisible: true, className: "tabular-nums whitespace-nowrap" },
        header: t("payments.reconciliation.columns.id"),
        cell: ({ row }) => <span className="font-medium">{row.original.id}</span>,
      },
      {
        id: "ride",
        meta: { label: t("payments.reconciliation.columns.ride"), className: "tabular-nums whitespace-nowrap" },
        header: t("payments.reconciliation.columns.ride"),
        cell: ({ row }) => row.original.rideId,
      },
      {
        id: "createdAt",
        enableSorting: true,
        meta: { label: t("payments.reconciliation.columns.date"), className: "whitespace-nowrap" },
        header: t("payments.reconciliation.columns.date"),
        cell: ({ row }) => <span className="text-dense">{f.dateTime(row.original.createdAt)}</span>,
      },
      {
        id: "amountCents",
        enableSorting: true,
        meta: { label: t("payments.reconciliation.columns.ours"), className: "min-w-40" },
        header: t("payments.reconciliation.columns.ours"),
        cell: ({ row }) => (
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular font-medium">{f.eur(row.original.amountCents)}</span>
            <StatusBadge kind="payment" value={row.original.status} />
          </div>
        ),
      },
      {
        id: "gateway",
        meta: { label: t("payments.reconciliation.columns.gateway"), className: "min-w-44" },
        header: t("payments.reconciliation.columns.gateway"),
        cell: ({ row }) => <span className="text-dense">{gatewayText(row.original)}</span>,
      },
      {
        id: "reference",
        meta: { label: t("payments.reconciliation.columns.reference"), className: "tabular-nums whitespace-nowrap" },
        header: t("payments.reconciliation.columns.reference"),
        cell: ({ row }) => <span className="text-caption">{row.original.gatewayRef ?? "—"}</span>,
      },
    ],
    // `gatewayText` only reads `t` and `f`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, f],
  );

  return (
    <DataTable
      tableId="payments-reconciliation"
      caption={t(`payments.reconciliation.state.${state}.label`)}
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
      onPageSizeChange={(n) => (setSize(n), setPage(1))}
      getRowId={(p) => p.id}
      onOpenRow={(p) => onOpen(p.id)}
      emptyTitle={t(`payments.reconciliation.empty.${state === "MISMATCH" ? "MISMATCH" : "other"}`)}
      rowActions={(p) => (
        <>
          <DropdownMenuItem onSelect={() => onOpen(p.id)}>
            <Eye />
            {t("payments.actions.view")}
          </DropdownMenuItem>
          {canReconcile && (
            <DropdownMenuItem onSelect={() => onReconcile(p)}>
              <GitCompare />
              {t("payments.actions.reconcile")}
            </DropdownMenuItem>
          )}
        </>
      )}
      mobileCard={(p) => (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="tabular font-medium">{p.id}</span>
            <span className="tabular font-semibold">{f.eur(p.amountCents)}</span>
          </div>
          <span className="text-caption">
            {p.rideId} · {f.dateTime(p.createdAt)}
          </span>
          {p.mismatch && <span className="text-dense">{gatewayText(p)}</span>}
        </div>
      )}
    />
  );
}
