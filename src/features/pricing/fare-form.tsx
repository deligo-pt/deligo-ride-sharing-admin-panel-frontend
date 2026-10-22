"use client";

import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import * as z from "zod/mini";
import type { PricingRuleInput, VatRate, Weekday } from "@/types/pricing";
import { FormField } from "@/components/forms/form-field";
import { MoneyInput } from "@/components/forms/money-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { MONEY_FIELDS, VAT_RATES, WEEK } from "./pricing-utils";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_BANDS = 6;

/**
 * Step 1 — the values of the new fare version. Money fields work in cents
 * (MoneyInput); the checks mirror the service's (`validateRule`) so mistakes
 * show on the field before anything is sent: whole cents 0–1 000,00 €, minimum
 * fare not below the base fare, surge cap 1.0–3.0, time bands with at least one
 * day, HH:mm times and a 1.0–3.0 multiplier.
 */
export function FareForm({
  initial,
  onSubmit,
  onSaveDraft,
  saving,
  cancel,
}: {
  initial: PricingRuleInput;
  onSubmit: (input: PricingRuleInput) => void;
  onSaveDraft: (input: PricingRuleInput) => void;
  saving: boolean;
  cancel: React.ReactNode;
}) {
  const t = useTranslations("pricing");
  const te = useTranslations("pricing.editor.errors");

  const schema = useMemo(() => {
    const required = te("required");
    const money = z
      .number(required)
      .check(z.int(te("money")), z.minimum(0, te("money")), z.maximum(100_000, te("money")));
    return z
      .object({
        baseFare: money,
        minimumFare: money,
        perKm: money,
        perMinute: money,
        bookingFee: money,
        waitingPerMinute: money,
        cancellationFee: money,
        vat: z.enum(["6", "13", "23"]),
        surgeEnabled: z.boolean(),
        surgeMax: z.number(required).check(z.minimum(1, te("multiplier")), z.maximum(3, te("multiplier"))),
        timeBands: z
          .array(
            z.object({
              days: z.array(z.number()).check(z.minLength(1, te("days"))),
              from: z.string().check(z.regex(HHMM, te("time"))),
              to: z.string().check(z.regex(HHMM, te("time"))),
              multiplier: z
                .number(required)
                .check(z.minimum(1, te("multiplier")), z.maximum(3, te("multiplier"))),
            }),
          )
          .check(z.maxLength(MAX_BANDS, te("tooManyBands", { max: MAX_BANDS }))),
      })
      .check(
        z.refine((v) => v.minimumFare >= v.baseFare, {
          path: ["minimumFare"],
          error: te("minimumBelowBase"),
        }),
      );
  }, [te]);
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      baseFare: initial.baseFare,
      minimumFare: initial.minimumFare,
      perKm: initial.perKm,
      perMinute: initial.perMinute,
      bookingFee: initial.bookingFee,
      waitingPerMinute: initial.waitingPerMinute,
      cancellationFee: initial.cancellationFee,
      vat: String(Math.round(initial.vatRate * 100)) as Values["vat"],
      surgeEnabled: initial.surge.enabled,
      surgeMax: initial.surge.enabled ? initial.surge.maxMultiplier : 1.5,
      timeBands: initial.timeBands.map((b) => ({ ...b, days: [...b.days] })),
    },
  });
  const { register, control, handleSubmit, formState } = form;
  const bands = useFieldArray({ control, name: "timeBands" });
  const surgeEnabled = useWatch({ control, name: "surgeEnabled" });
  const err = (name: keyof Values) => {
    const e = formState.errors[name];
    return e && "message" in e && typeof e.message === "string" ? e.message : undefined;
  };

  const toInput = (v: Values): PricingRuleInput => ({
    category: initial.category,
    zoneId: initial.zoneId,
    baseFare: v.baseFare,
    minimumFare: v.minimumFare,
    perKm: v.perKm,
    perMinute: v.perMinute,
    bookingFee: v.bookingFee,
    waitingPerMinute: v.waitingPerMinute,
    cancellationFee: v.cancellationFee,
    timeBands: v.timeBands.map((b) => ({
      days: b.days as Weekday[],
      from: b.from,
      to: b.to,
      multiplier: b.multiplier,
    })),
    surge: { enabled: v.surgeEnabled, maxMultiplier: v.surgeEnabled ? v.surgeMax : 1 },
    vatRate: (Number(v.vat) / 100) as VatRate,
  });

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(toInput(v)))} className="flex flex-col gap-4" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">{t("editor.sections.fare")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MONEY_FIELDS.map((key) => (
            <FormField
              key={key}
              label={t(`fields.${key}`)}
              hint={t(`editor.hints.${key}`)}
              error={err(key)}
            >
              {(p) => (
                <Controller
                  control={control}
                  name={key}
                  render={({ field }) => (
                    <MoneyInput
                      {...p}
                      value={field.value ?? null}
                      onChange={(cents) => field.onChange(cents as number)}
                      invalid={Boolean(err(key))}
                    />
                  )}
                />
              )}
            </FormField>
          ))}
          <FormField label={t("fields.vatRate")} hint={t("editor.hints.vatRate")}>
            {(p) => (
              <Controller
                control={control}
                name="vat"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...p} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VAT_RATES.map((rate) => (
                        <SelectItem key={rate} value={String(Math.round(rate * 100))}>
                          {Math.round(rate * 100)} %
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">{t("fields.surge")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="surgeEnabled"
            render={({ field }) => (
              <label className="text-dense flex items-center gap-3 self-end pb-2">
                <Switch checked={field.value} onCheckedChange={field.onChange} />
                {t("editor.surgeEnabled")}
              </label>
            )}
          />
          <FormField label={t("editor.surgeMax")} hint={t("editor.hints.surgeMax")} error={err("surgeMax")}>
            {(p) => (
              <Input
                {...p}
                type="number"
                step="0.1"
                inputMode="decimal"
                disabled={!surgeEnabled}
                {...register("surgeMax", { valueAsNumber: true })}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-card-title">{t("fields.timeBands")}</CardTitle>
            <p className="text-caption">{t("editor.hints.timeBands")}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={bands.fields.length >= MAX_BANDS}
            onClick={() => bands.append({ days: [5, 6], from: "22:00", to: "04:00", multiplier: 1.2 })}
          >
            <Plus />
            {t("editor.addBand")}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {bands.fields.length === 0 && <p className="text-dense text-muted-foreground">{t("active.noBands")}</p>}
          {bands.fields.map((band, i) => {
            const bandErrors = formState.errors.timeBands?.[i];
            return (
              <div key={band.id} className="flex flex-col gap-3 rounded-lg border p-3" data-testid={`band-${i}`}>
                <Controller
                  control={control}
                  name={`timeBands.${i}.days`}
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("editor.days")}>
                      {WEEK.map((day) => {
                        const on = field.value.includes(day);
                        return (
                          <Button
                            key={day}
                            type="button"
                            size="sm"
                            variant={on ? "default" : "outline"}
                            aria-pressed={on}
                            onClick={() =>
                              field.onChange(on ? field.value.filter((d) => d !== day) : [...field.value, day])
                            }
                          >
                            {t(`days.short.${day}`)}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                />
                {bandErrors?.days?.message && (
                  <p className="text-caption text-destructive" role="alert">
                    {bandErrors.days.message}
                  </p>
                )}
                <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <FormField label={t("editor.from")} error={bandErrors?.from?.message}>
                    {(p) => <Input {...p} type="time" {...register(`timeBands.${i}.from`)} />}
                  </FormField>
                  <FormField label={t("editor.to")} error={bandErrors?.to?.message}>
                    {(p) => <Input {...p} type="time" {...register(`timeBands.${i}.to`)} />}
                  </FormField>
                  <FormField label={t("editor.multiplier")} error={bandErrors?.multiplier?.message}>
                    {(p) => (
                      <Input
                        {...p}
                        type="number"
                        step="0.05"
                        inputMode="decimal"
                        {...register(`timeBands.${i}.multiplier`, { valueAsNumber: true })}
                      />
                    )}
                  </FormField>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn("self-end text-muted-foreground")}
                    onClick={() => bands.remove(i)}
                    aria-label={t("editor.removeBand")}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {cancel}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={handleSubmit((v) => onSaveDraft(toInput(v)))}
          >
            {saving ? t("editor.saving") : t("editor.saveDraft")}
          </Button>
          <Button type="submit" disabled={saving}>
            {t("editor.toPreview")}
          </Button>
        </div>
      </div>
    </form>
  );
}
