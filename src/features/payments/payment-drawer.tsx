"use client";

import { ExternalLink, GitCompare, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { PaymentListItem } from "@/types/payment";
import { StatusBadge } from "@/components/badges/status-badge";
import { KeyValueGrid } from "@/components/detail/detail-parts";
import { ErrorState } from "@/components/feedback/states";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { Can, usePermission } from "@/components/session/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { usePayment } from "@/hooks/queries/payments";
import { Link } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";
import { leftToRefund, refundBlock } from "./payment-utils";

/**
 * One payment (§12): the transaction, what was refunded and by whom, how it
 * stands against the gateway's file, and — for roles with `payments.refund` —
 * the two money actions. Opens over any tab and from `?payment=…`, so a ride's
 * "Open payment" link lands here. Raw card data is never shown: only
 * "Visa •••• 4242" (§12).
 */
export function PaymentDrawer({
  id,
  onClose,
  onRefund,
  onReconcile,
}: {
  id: string | null;
  onClose: () => void;
  onRefund: (payment: PaymentListItem) => void;
  onReconcile: (payment: PaymentListItem) => void;
}) {
  const t = useTranslations("payments");
  const query = usePayment(id);
  return (
    <Sheet open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="pr-12">
          <SheetTitle>{t("drawer.title", { id: id ?? "" })}</SheetTitle>
          <SheetDescription>{t("drawer.description")}</SheetDescription>
        </SheetHeader>
        {query.isPending && id ? (
          <div className="flex flex-col gap-3 p-4" aria-hidden>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} title={t("drawer.loadFailed")} />
        ) : query.data ? (
          <DrawerBody payment={query.data} onRefund={onRefund} onReconcile={onReconcile} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({
  payment: p,
  onRefund,
  onReconcile,
}: {
  payment: PaymentListItem;
  onRefund: (payment: PaymentListItem) => void;
  onReconcile: (payment: PaymentListItem) => void;
}) {
  const t = useTranslations("payments");
  const tAll = useTranslations();
  const f = useFormat();
  const allowed = usePermission();
  const block = refundBlock(p);
  const left = leftToRefund(p);

  const mismatch = p.mismatch;
  const mismatchText =
    mismatch?.kind === "MISSING"
      ? t("drawer.mismatch.MISSING")
      : mismatch?.kind === "AMOUNT_DIFFERS"
        ? t("drawer.mismatch.AMOUNT_DIFFERS", {
            gateway: f.eur(mismatch.gatewayAmountCents),
            ours: f.eur(p.amountCents),
          })
        : mismatch?.kind === "STATUS_DIFFERS"
          ? t("drawer.mismatch.STATUS_DIFFERS", { status: t(`drawer.mismatchStatus.${mismatch.gatewayStatus}`) })
          : null;

  return (
    <>
      <div className="flex flex-col gap-5 px-4 pb-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <p className="tabular text-3xl font-bold tracking-tight">{f.eur(p.amountCents)}</p>
          <StatusBadge kind="payment" value={p.status} />
        </div>

        <KeyValueGrid
          columns={1}
          items={[
            {
              label: t("drawer.ride"),
              value: allowed("rides", "view") ? (
                <Link href={`/rides/${p.rideId}`} className="tabular inline-flex items-center gap-1 text-primary hover:underline">
                  {p.rideId}
                  <ExternalLink aria-hidden className="size-3" />
                  <span className="sr-only">{t("drawer.openRide")}</span>
                </Link>
              ) : (
                <span className="tabular">{p.rideId}</span>
              ),
            },
            {
              label: t("drawer.customer"),
              value: allowed("customers", "view") ? (
                <Link href={`/customers/${p.customerId}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                  {p.customerName}
                  <ExternalLink aria-hidden className="size-3" />
                  <span className="sr-only">{t("drawer.openCustomer")}</span>
                </Link>
              ) : (
                p.customerName
              ),
            },
            { label: t("drawer.method"), value: p.methodDetail ?? tAll(`enums.paymentMethod.${p.method}`) },
            { label: t("drawer.date"), value: f.dateTime(p.createdAt) },
            { label: t("drawer.reference"), value: p.gatewayRef ? <span className="tabular">{p.gatewayRef}</span> : null },
            ...(p.failureReason
              ? [{ label: t("drawer.failure"), value: <span className="text-destructive">{p.failureReason}</span> }]
              : []),
            {
              label: t("drawer.match"),
              value: <StatusBadge kind="reconciliation" value={p.reconciliation} />,
            },
          ]}
        />

        {mismatchText && (
          <InlineAlert tone="warning">
            <p className="font-medium">{t("drawer.gatewayFile")}</p>
            <p>{mismatchText}</p>
          </InlineAlert>
        )}

        <Separator />

        <section className="flex flex-col gap-3" aria-label={t("drawer.refunds")}>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-card-title">{t("drawer.refunds")}</h3>
            {p.refundedCents > 0 && (
              <span className="text-caption tabular">
                {t("refundOf", { refunded: f.eur(p.refundedCents), total: f.eur(p.amountCents) })}
              </span>
            )}
          </div>
          {p.refunds.length === 0 ? (
            <p className="text-dense text-muted-foreground">{t("drawer.noRefunds")}</p>
          ) : (
            <ul className="flex flex-col divide-y rounded-lg border">
              {p.refunds.map((r) => (
                <li key={r.id} className="flex flex-col gap-0.5 px-3 py-2">
                  <span className="flex items-center justify-between gap-2">
                    <span className="tabular text-dense font-medium">{f.eur(r.amountCents)}</span>
                    <Badge variant={r.status === "SUCCESSFUL" ? "success" : "danger"} className="text-micro h-5">
                      {t(`drawer.refundStatus.${r.status}`)}
                    </Badge>
                  </span>
                  <span className="text-caption">
                    {t("drawer.refundBy", { name: r.adminName ?? r.adminId, date: f.dateTime(r.createdAt) })}
                  </span>
                  <span className="text-dense">{r.reason}</span>
                  <span className="text-caption tabular">{r.gatewayRef}</span>
                </li>
              ))}
            </ul>
          )}
          {left > 0 && p.refundedCents > 0 && (
            <p className="text-caption tabular">
              {t("drawer.left")}: {f.eur(left)}
            </p>
          )}
        </section>
      </div>

      <SheetFooter className="border-t">
        <Can
          module="payments"
          action="refund"
          fallback={<p className="text-caption">{t("drawer.cannotRefund.role")}</p>}
        >
          {block ? (
            <p className="text-caption">
              {block === "status"
                ? t("drawer.cannotRefund.status", { status: tAll(`status.payment.${p.status}`).toLowerCase() })
                : t(`drawer.cannotRefund.${block}`)}
            </p>
          ) : (
            <Button onClick={() => onRefund(p)}>
              <Undo2 />
              {t("actions.refund")}
            </Button>
          )}
          {p.reconciliation === "MISMATCH" && (
            <Button variant="outline" onClick={() => onReconcile(p)}>
              <GitCompare />
              {t("actions.reconcile")}
            </Button>
          )}
        </Can>
      </SheetFooter>
    </>
  );
}
