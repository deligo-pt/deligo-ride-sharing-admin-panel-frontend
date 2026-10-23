"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { PaymentListItem } from "@/types/payment";
import { ReasonDialog } from "@/components/dialogs/reason-dialog";
import { MoneyInput } from "@/components/forms/money-input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { qk } from "@/lib/query-keys";
import { isServiceError } from "@/lib/service-error";
import { useFormat } from "@/lib/use-format";
import { markPaymentReconciled, refundPayment } from "@/services/payments";
import { leftToRefund } from "./payment-utils";

/**
 * The two money actions on a payment, shared by the drawer and the row menus.
 * Both follow the §G pattern: ReasonDialog → useServiceMutation → invalidate →
 * toast (the service checks the permission, validates and writes the audit
 * entry). Each hook returns `open(payment)` and the `dialog` to render once.
 */

/** ⚠ Full or partial refund (§12): amount ≤ what is left, reason ≥ 10 characters. */
export function useRefundAction() {
  const t = useTranslations();
  const f = useFormat();
  const radioId = useId();
  const [target, setTarget] = useState<PaymentListItem | null>(null);
  const [mode, setMode] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState<number | null>(null);

  const left = target ? leftToRefund(target) : 0;
  const refundCents = mode === "full" ? left : amount;
  // Shown above the reason and keeps the confirm button off until it is right.
  const amountError =
    mode !== "partial"
      ? undefined
      : amount === null
        ? t("payments.refund.enterAmount")
        : amount <= 0
          ? t("payments.refund.zero")
          : amount > left
            ? t("payments.refund.tooHigh", { amount: f.eur(left) })
            : undefined;

  const mutation = useServiceMutation({
    mutationFn: (v: { id: string; amountCents: number; reason: string }) =>
      refundPayment(v.id, v.amountCents, v.reason),
    invalidate: [qk.payments.all, qk.rides.all, qk.audit.all],
    onSuccess: (payment, v) =>
      toast.success(
        t("payments.refund.done", {
          amount: f.eur(v.amountCents),
          reference: payment.refunds.at(-1)?.gatewayRef ?? "",
        }),
      ),
    onError: (error) => {
      // Reason errors show in the dialog; the rest as a toast.
      if (isServiceError(error) && error.field === "reason") return;
      toast.error(t(`feedback.errors.${isServiceError(error) ? error.code : "UNKNOWN"}`));
    },
  });

  const open = (payment: PaymentListItem) => {
    setMode("full");
    setAmount(null);
    setTarget(payment);
  };

  const dialog = (
    <ReasonDialog
      open={target !== null}
      onOpenChange={(next) => !next && setTarget(null)}
      title={t("payments.refund.title", { id: target?.id ?? "" })}
      description={t("payments.refund.description", {
        method: target ? (target.methodDetail ?? t(`enums.paymentMethod.${target.method}`)) : "",
      })}
      confirmLabel={t("payments.refund.confirm", { amount: f.eur(refundCents ?? 0) })}
      destructive
      blocked={amountError}
      extra={
        target && (
          <div className="flex flex-col gap-3">
            <RadioGroup
              value={mode}
              onValueChange={(next) => setMode(next as "full" | "partial")}
              className="flex flex-col gap-2"
              aria-label={t("payments.drawer.refunds")}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="full" id={`${radioId}-full`} />
                <Label htmlFor={`${radioId}-full`}>{t("payments.refund.full", { amount: f.eur(left) })}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="partial" id={`${radioId}-partial`} />
                <Label htmlFor={`${radioId}-partial`}>{t("payments.refund.partial")}</Label>
              </div>
            </RadioGroup>
            {mode === "partial" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${radioId}-amount`}>{t("payments.refund.amount")}</Label>
                <MoneyInput
                  id={`${radioId}-amount`}
                  value={amount}
                  onChange={setAmount}
                  invalid={amountError !== undefined && amount !== null}
                  placeholder="0,00"
                />
              </div>
            )}
            <p className="text-caption">
              {t("payments.refund.left", { amount: f.eur(left), total: f.eur(target.amountCents) })}
            </p>
          </div>
        )
      }
      onConfirm={(reason) => mutation.mutateAsync({ id: target!.id, amountCents: refundCents ?? 0, reason })}
    />
  );

  return { open, dialog };
}

/** ⚠ Mark a mismatched payment as matched, after checking it with the gateway. */
export function useReconcileAction() {
  const t = useTranslations();
  const [target, setTarget] = useState<Pick<PaymentListItem, "id"> | null>(null);

  const mutation = useServiceMutation({
    mutationFn: (v: { id: string; reason: string }) => markPaymentReconciled(v.id, v.reason),
    invalidate: [qk.payments.all, qk.audit.all],
    onSuccess: (payment) => toast.success(t("payments.reconcile.done", { id: payment.id })),
    onError: (error) => {
      if (isServiceError(error) && error.field === "reason") return;
      toast.error(t(`feedback.errors.${isServiceError(error) ? error.code : "UNKNOWN"}`));
    },
  });

  const dialog = (
    <ReasonDialog
      open={target !== null}
      onOpenChange={(next) => !next && setTarget(null)}
      title={t("payments.reconcile.title", { id: target?.id ?? "" })}
      description={t("payments.reconcile.description")}
      confirmLabel={t("payments.reconcile.confirm")}
      onConfirm={(reason) => mutation.mutateAsync({ id: target!.id, reason })}
    />
  );

  return { open: setTarget, dialog };
}
