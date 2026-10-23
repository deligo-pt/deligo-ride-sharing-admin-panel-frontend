"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { CommissionRuleView } from "@/types/finance";
import type { RideCategory } from "@/types/vehicle";
import { ReasonDialog } from "@/components/dialogs/reason-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { qk } from "@/lib/query-keys";
import { isServiceError } from "@/lib/service-error";
import { useSlowTick } from "@/lib/use-ticker";
import { useFormat } from "@/lib/use-format";
import { lisbonIso, lisbonToday } from "@/features/pricing/pricing-utils";
import { createCommissionRule, withdrawCommissionRule } from "@/services/commission";
import { RIDE_CATEGORIES, rateDecimals } from "./commission-utils";

/**
 * Change a category's commission rate (§12) and cancel a change that hasn't
 * started. Both are ⚠ actions with a reason (§G); the service writes the audit
 * entry. The rate is typed as a percentage ("21.5") and sent as a fraction.
 */

/** ⚠ New rate: right away, or from a date (midnight Lisbon, up to a year ahead). */
export function useRateAction(rules: CommissionRuleView[] | undefined) {
  const t = useTranslations();
  const f = useFormat();
  const id = useId();
  const clock = useSlowTick();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<RideCategory>("ECONOMY");
  const [ratePct, setRatePct] = useState("");
  const [mode, setMode] = useState<"now" | "date">("now");
  const [date, setDate] = useState("");

  const current = rules?.find((r) => r.category === category && r.status === "ACTIVE");
  const scheduled = rules?.find((r) => r.category === category && r.status === "SCHEDULED");
  const minDate = clock ? lisbonToday(clock + 24 * 3_600_000) : "";
  const chosenDate = date || minDate;

  const pct = Number(ratePct.replace(",", "."));
  const rate = Math.round(pct * 10) / 1000;
  const error = scheduled
    ? t("commission.rates.dialog.errorScheduled")
    : ratePct.trim() === "" || !Number.isFinite(pct) || !(rate >= 0.001 && rate <= 0.499)
      ? t("commission.rates.dialog.errorRate")
      : current && Math.abs(current.rate - rate) < 1e-9
        ? t("commission.rates.dialog.errorSame")
        : mode === "date" && (!chosenDate || chosenDate < minDate)
          ? t("commission.rates.dialog.errorDate")
          : undefined;

  const mutation = useServiceMutation({
    mutationFn: (v: { category: RideCategory; rate: number; effectiveFrom: string; reason: string; now: boolean }) =>
      createCommissionRule(v.category, v.rate, v.effectiveFrom, v.reason),
    invalidate: [qk.commission.all, qk.audit.all],
    onSuccess: (rule, v) => {
      const label = t(`enums.rideCategory.${rule.category}`);
      const shown = f.percent(rule.rate, rateDecimals(rule.rate));
      toast.success(
        v.now
          ? t("commission.rates.dialog.doneNow", { category: label, rate: shown })
          : t("commission.rates.dialog.doneLater", { category: label, rate: shown, date: f.date(rule.effectiveFrom) }),
      );
    },
    onError: (e) => {
      if (isServiceError(e) && e.field === "reason") return;
      toast.error(t(`feedback.errors.${isServiceError(e) ? e.code : "UNKNOWN"}`));
    },
  });

  const start = (preselect?: RideCategory) => {
    setCategory(preselect ?? "ECONOMY");
    setRatePct("");
    setMode("now");
    setDate("");
    setOpen(true);
  };

  const dialog = (
    <ReasonDialog
      open={open}
      onOpenChange={setOpen}
      title={t("commission.rates.dialog.title")}
      description={t("commission.rates.dialog.description")}
      confirmLabel={t("commission.rates.dialog.confirm")}
      blocked={error}
      extra={
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-category`}>{t("commission.rates.dialog.category")}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as RideCategory)}>
              <SelectTrigger id={`${id}-category`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RIDE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`enums.rideCategory.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-rate`}>{t("commission.rates.dialog.rate")}</Label>
            <Input
              id={`${id}-rate`}
              inputMode="decimal"
              value={ratePct}
              onChange={(e) => setRatePct(e.target.value)}
              placeholder={t("commission.rates.dialog.ratePlaceholder")}
              aria-invalid={ratePct.trim() !== "" && error !== undefined && !scheduled}
            />
            {current && (
              <p className="text-caption">
                {t("commission.rates.dialog.currentRate", { rate: f.percent(current.rate, rateDecimals(current.rate)) })}
              </p>
            )}
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-dense mb-1 font-medium">{t("commission.rates.dialog.start")}</legend>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as "now" | "date")} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="now" id={`${id}-now`} />
                <Label htmlFor={`${id}-now`}>{t("commission.rates.dialog.now")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="date" id={`${id}-date-mode`} />
                <Label htmlFor={`${id}-date-mode`}>{t("commission.rates.dialog.onDate")}</Label>
              </div>
            </RadioGroup>
            {mode === "date" && (
              <div className="flex flex-col gap-1.5 pl-6">
                <Label htmlFor={`${id}-date`}>{t("commission.rates.dialog.date")}</Label>
                <Input id={`${id}-date`} type="date" min={minDate} value={chosenDate} onChange={(e) => setDate(e.target.value)} />
                <p className="text-caption">{t("commission.rates.dialog.dateHint")}</p>
              </div>
            )}
          </fieldset>
        </div>
      }
      onConfirm={(reason) =>
        mutation.mutateAsync({
          category,
          rate,
          reason,
          now: mode === "now",
          // "Right away" is the moment of the click (read here, in the handler).
          effectiveFrom: mode === "now" ? new Date().toISOString() : lisbonIso(chosenDate, "00:00"),
        })
      }
    />
  );
  return { open: start, dialog };
}

/** ⚠ Cancel a rate change that hasn't started; the rate before it carries on. */
export function useWithdrawAction(rules: CommissionRuleView[] | undefined) {
  const t = useTranslations();
  const f = useFormat();
  const [target, setTarget] = useState<CommissionRuleView | null>(null);
  const before = target && rules?.find((r) => r.category === target.category && r.effectiveTo === target.effectiveFrom);

  const mutation = useServiceMutation({
    mutationFn: (v: { id: string; reason: string }) => withdrawCommissionRule(v.id, v.reason),
    invalidate: [qk.commission.all, qk.audit.all],
    onSuccess: (rule) =>
      toast.success(
        t("commission.rates.withdrawDialog.done", {
          category: t(`enums.rideCategory.${rule.category}`),
          rate: before ? f.percent(before.rate, rateDecimals(before.rate)) : "",
        }),
      ),
    onError: (e) => {
      if (isServiceError(e) && e.field === "reason") return;
      toast.error(t(`feedback.errors.${isServiceError(e) ? e.code : "UNKNOWN"}`));
    },
  });

  const dialog = (
    <ReasonDialog
      open={target !== null}
      onOpenChange={(open) => !open && setTarget(null)}
      title={t("commission.rates.withdrawDialog.title", { rate: target ? f.percent(target.rate, rateDecimals(target.rate)) : "" })}
      description={t("commission.rates.withdrawDialog.description", {
        category: target ? t(`enums.rideCategory.${target.category}`) : "",
        date: target ? f.date(target.effectiveFrom) : "",
      })}
      confirmLabel={t("commission.rates.withdrawDialog.confirm")}
      destructive
      onConfirm={(reason) => mutation.mutateAsync({ id: target!.id, reason })}
    />
  );
  return { open: setTarget, dialog };
}
