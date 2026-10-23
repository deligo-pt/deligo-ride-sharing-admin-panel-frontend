"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Settlement } from "@/types/finance";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { ReasonDialog } from "@/components/dialogs/reason-dialog";
import { MoneyInput } from "@/components/forms/money-input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { qk } from "@/lib/query-keys";
import { isServiceError } from "@/lib/service-error";
import { useFormat } from "@/lib/use-format";
import { ADJUSTMENT_LIMIT_CENTS, adjustSettlement, approveSettlements } from "@/services/commission";

/**
 * The two money actions on settlements, shared by the list and the detail page.
 * Approve (needs `payouts.approve`) asks for a confirmation; an adjustment
 * (needs `commission.edit`) asks for a reason (§G). Each hook returns
 * `open(...)` and the `dialog` to render once.
 */

/** ✔ Approve pending settlements: each with something to pay gets a SEPA payout. */
export function useApproveAction() {
  const t = useTranslations();
  const f = useFormat();
  const [targets, setTargets] = useState<Settlement[] | null>(null);

  const mutation = useServiceMutation({
    mutationFn: (ids: string[]) => approveSettlements(ids),
    invalidate: [qk.commission.all, qk.payouts.all, qk.audit.all, qk.dashboard.all],
    onSuccess: (payouts, ids) =>
      toast.success(t("commission.approve.done", { count: ids.length, payouts: payouts.length })),
    onError: (error) => toast.error(t(`feedback.errors.${isServiceError(error) ? error.code : "UNKNOWN"}`)),
  });

  const paying = (targets ?? []).filter((s) => s.netCents > 0);
  const dialog = (
    <ConfirmDialog
      open={targets !== null}
      onOpenChange={(open) => !open && setTargets(null)}
      title={t("commission.approve.title", { count: targets?.length ?? 0 })}
      description={t("commission.approve.body", {
        payouts: paying.length,
        total: f.eur(paying.reduce((sum, s) => sum + s.netCents, 0)),
      })}
      confirmLabel={t("commission.approve.confirm")}
      onConfirm={() => mutation.mutateAsync((targets ?? []).map((s) => s.id))}
    />
  );
  return { open: setTargets, dialog };
}

/** ⚠ A manual credit or deduction on a pending settlement (§12): amount ≤ €1 000, reason ≥ 10 characters. */
export function useAdjustAction() {
  const t = useTranslations();
  const f = useFormat();
  const radioId = useId();
  const [target, setTarget] = useState<Settlement | null>(null);
  const [kind, setKind] = useState<"credit" | "deduction">("credit");
  const [amount, setAmount] = useState<number | null>(null);

  const signed = amount === null ? 0 : kind === "credit" ? amount : -amount;
  const amountError =
    amount === null
      ? t("commission.detail.adjust.enterAmount")
      : amount <= 0
        ? t("commission.detail.adjust.zero")
        : amount > ADJUSTMENT_LIMIT_CENTS
          ? t("commission.detail.adjust.tooHigh", { amount: f.eur(ADJUSTMENT_LIMIT_CENTS) })
          : undefined;

  const mutation = useServiceMutation({
    mutationFn: (v: { id: string; amountCents: number; reason: string }) =>
      adjustSettlement(v.id, v.amountCents, v.reason),
    invalidate: [qk.commission.all, qk.audit.all],
    onSuccess: (settlement) =>
      toast.success(t("commission.detail.adjust.done", { net: f.eur(settlement.netCents) })),
    onError: (error) => {
      if (isServiceError(error) && error.field === "reason") return;
      toast.error(t(`feedback.errors.${isServiceError(error) ? error.code : "UNKNOWN"}`));
    },
  });

  const open = (settlement: Settlement) => {
    setKind("credit");
    setAmount(null);
    setTarget(settlement);
  };

  const dialog = (
    <ReasonDialog
      open={target !== null}
      onOpenChange={(next) => !next && setTarget(null)}
      title={t("commission.detail.adjust.title", { id: target?.id ?? "" })}
      description={t("commission.detail.adjust.description")}
      confirmLabel={t(kind === "credit" ? "commission.detail.adjust.confirmCredit" : "commission.detail.adjust.confirmDeduction", {
        amount: f.eur(amount ?? 0),
      })}
      destructive={kind === "deduction"}
      blocked={amountError}
      extra={
        target && (
          <div className="flex flex-col gap-3">
            <RadioGroup value={kind} onValueChange={(next) => setKind(next as "credit" | "deduction")} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="credit" id={`${radioId}-credit`} />
                <Label htmlFor={`${radioId}-credit`}>{t("commission.detail.adjust.credit")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="deduction" id={`${radioId}-deduction`} />
                <Label htmlFor={`${radioId}-deduction`}>{t("commission.detail.adjust.deduction")}</Label>
              </div>
            </RadioGroup>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`${radioId}-amount`}>{t("commission.detail.adjust.amount")}</Label>
              <MoneyInput
                id={`${radioId}-amount`}
                value={amount}
                onChange={setAmount}
                invalid={amountError !== undefined && amount !== null}
                placeholder="0,00"
              />
              <p className="text-caption">{t("commission.detail.adjust.limit", { amount: f.eur(ADJUSTMENT_LIMIT_CENTS) })}</p>
            </div>
            <p className="text-dense tabular font-medium">
              {t("commission.detail.adjust.newNet", { amount: f.eur(target.netCents + signed) })}
            </p>
          </div>
        )
      }
      onConfirm={(reason) => mutation.mutateAsync({ id: target!.id, amountCents: signed, reason })}
    />
  );
  return { open, dialog };
}
