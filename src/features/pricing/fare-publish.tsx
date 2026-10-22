"use client";

import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { PricingRule, PricingRuleInput } from "@/types/pricing";
import { ReasonDialog } from "@/components/dialogs/reason-dialog";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { useRouter } from "@/i18n/navigation";
import { qk } from "@/lib/query-keys";
import { isServiceError } from "@/lib/service-error";
import { useFormat } from "@/lib/use-format";
import { useSlowTick } from "@/lib/use-ticker";
import { createPricingDraft, publishPricingRule, updatePricingDraft } from "@/services/pricing";
import { lisbonIso, lisbonToday, MONEY_FIELDS } from "./pricing-utils";

/**
 * Step 3 — when the fare takes effect, then ⚠ publish (§11). "Now" makes it the
 * fare in force and archives the one before; a later date schedules it, and the
 * switch happens by itself on that date. Rides already completed keep the fare
 * they were charged; nothing is recalculated.
 */
export function FarePublishStep({
  values,
  current,
  draftId,
  onBack,
}: {
  values: PricingRuleInput;
  current?: PricingRule;
  draftId?: string;
  onBack: () => void;
}) {
  const t = useTranslations("pricing.publish");
  const tp = useTranslations("pricing");
  const tc = useTranslations("enums.rideCategory");
  const tError = useTranslations("feedback.errors");
  const router = useRouter();
  const f = useFormat();
  const clock = useSlowTick();
  const [mode, setMode] = useState<"now" | "later">("now");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("00:00");
  const [open, setOpen] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  const minDate = clock ? lisbonToday(clock) : "";
  const chosenDate = date || (clock ? lisbonToday(clock + 24 * 3_600_000) : "");

  const changes = current
    ? [
        ...MONEY_FIELDS.filter((k) => current[k] !== values[k]).map((k) => ({
          key: k,
          label: tp(`fields.${k}`),
          from: f.eur(current[k]),
          to: f.eur(values[k]),
        })),
        ...(current.vatRate !== values.vatRate
          ? [{ key: "vat", label: tp("fields.vatRate"), from: f.percent(current.vatRate, 0), to: f.percent(values.vatRate, 0) }]
          : []),
        ...(JSON.stringify(current.surge) !== JSON.stringify(values.surge)
          ? [{ key: "surge", label: tp("fields.surge"), from: current.surge.enabled ? `×${current.surge.maxMultiplier}` : "—", to: values.surge.enabled ? `×${values.surge.maxMultiplier}` : "—" }]
          : []),
        ...(JSON.stringify(current.timeBands) !== JSON.stringify(values.timeBands)
          ? [{ key: "bands", label: tp("fields.timeBands"), from: String(current.timeBands.length), to: String(values.timeBands.length) }]
          : []),
      ]
    : [];

  const mutation = useServiceMutation({
    mutationFn: async (v: { reason: string; effectiveFrom: string }) => {
      const draft = draftId ? await updatePricingDraft(draftId, values) : await createPricingDraft(values);
      return publishPricingRule(draft.id, v.effectiveFrom, v.reason);
    },
    invalidate: [qk.pricing.all, qk.audit.all],
    onSuccess: (rule) => {
      toast.success(
        rule.status === "ACTIVE"
          ? t("publishedNow", { category: tc(rule.category), n: rule.version })
          : t("publishedLater", { category: tc(rule.category), n: rule.version, date: f.date(rule.effectiveFrom) }),
      );
      router.push("/pricing");
    },
    onError: (error) => {
      if (isServiceError(error) && error.field === "reason") return;
      if (isServiceError(error) && error.field === "effectiveFrom") {
        setOpen(false);
        return setDateError(t("dateInPast"));
      }
      toast.error(tError(isServiceError(error) ? error.code : "UNKNOWN"));
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">{t("when")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as "now" | "later")} className="gap-3">
            <div className="flex items-start gap-3">
              <RadioGroupItem value="now" id="when-now" className="mt-1" />
              <Label htmlFor="when-now" className="flex flex-col items-start gap-0.5">
                {t("now")}
                <span className="text-caption font-normal">{t("nowHint")}</span>
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <RadioGroupItem value="later" id="when-later" className="mt-1" />
              <Label htmlFor="when-later" className="flex flex-col items-start gap-0.5">
                {t("later")}
                <span className="text-caption font-normal">{t("laterHint")}</span>
              </Label>
            </div>
          </RadioGroup>
          {mode === "later" && (
            <div className="grid max-w-md grid-cols-2 gap-3">
              <FormField label={t("date")} error={dateError ?? undefined}>
                {(p) => (
                  <Input
                    {...p}
                    type="date"
                    min={minDate}
                    value={chosenDate}
                    onChange={(e) => {
                      setDate(e.target.value);
                      setDateError(null);
                    }}
                  />
                )}
              </FormField>
              <FormField label={t("time")}>
                {(p) => <Input {...p} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
              </FormField>
            </div>
          )}
          <InlineAlert tone="info">{t("rules")}</InlineAlert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">{t("summary")}</CardTitle>
        </CardHeader>
        <CardContent>
          {changes.length === 0 ? (
            <p className="text-dense text-muted-foreground">{current ? t("noChanges") : t("firstVersion")}</p>
          ) : (
            <ul className="text-dense flex flex-col gap-1.5" data-testid="change-summary">
              {changes.map((c) => (
                <li key={c.key} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{c.label}</span>
                  <span className="tabular text-muted-foreground">{c.from}</span>
                  <span aria-hidden>→</span>
                  <span className="tabular font-medium">{c.to}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          {tp("editor.back")}
        </Button>
        <Button
          type="button"
          onClick={() => {
            setDateError(null);
            setOpen(true);
          }}
        >
          <TriangleAlert />
          {t("publish")}
        </Button>
      </div>

      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={t("confirmTitle", { category: tc(values.category) })}
        description={mode === "now" ? t("confirmNow") : t("confirmLater", { date: f.date(lisbonIso(chosenDate || minDate, time)) })}
        confirmLabel={t("publish")}
        onConfirm={(reason) =>
          mutation.mutateAsync({
            reason,
            // "Now" is the moment of the click (read here, in the handler).
            effectiveFrom: mode === "now" ? new Date().toISOString() : lisbonIso(chosenDate, time),
          })
        }
      />
    </div>
  );
}
