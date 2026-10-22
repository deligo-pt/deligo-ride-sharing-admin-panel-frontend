"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { FarePreview, PricingRule, PricingRuleInput, Weekday } from "@/types/pricing";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { FormField } from "@/components/forms/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePreviewFare } from "@/hooks/queries/pricing";
import { useFormat } from "@/lib/use-format";
import { useSlowTick } from "@/lib/use-ticker";
import { cn } from "@/lib/utils";
import { nextLisbonSlot, toInput, WEEK } from "./pricing-utils";

const SURGES = [1, 1.2, 1.5, 2] as const;
const LINES = ["base", "distance", "time", "waiting", "booking", "zone", "surge", "vat"] as const;

/** Whole number from a text input; empty or invalid = the fallback. */
const num = (text: string, fallback: number, max: number) => {
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : fallback;
};

/**
 * Step 2 — the sample-trip calculator (§11 "preview before publishing"): the
 * same formula as a real ride, run for the fare in force and for the new
 * values, side by side. Try a short and a long trip, a Friday night, a surge.
 */
export function FarePreviewStep({
  values,
  current,
  onBack,
  onNext,
}: {
  values: PricingRuleInput;
  /** The fare in force for the category (nothing to compare when there isn't one). */
  current?: PricingRule;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("pricing.preview");
  const tp = useTranslations("pricing");
  const f = useFormat();
  const clock = useSlowTick();
  const [distance, setDistance] = useState("8");
  const [duration, setDuration] = useState("22");
  const [waiting, setWaiting] = useState("0");
  const [weekday, setWeekday] = useState<Weekday>(1);
  const [time, setTime] = useState("12:00");
  const [surge, setSurge] = useState<number>(1);

  const ready = clock > 0 && /^\d{2}:\d{2}$/.test(time);
  const trip = {
    distanceKm: num(distance, 8, 500),
    durationMin: num(duration, 22, 600),
    waitingMin: num(waiting, 0, 120),
    at: ready ? nextLisbonSlot(clock, weekday, time) : undefined,
    surge,
  };
  const next = usePreviewFare({ rule: values, ...trip }, ready);
  const old = usePreviewFare({ rule: current ? toInput(current) : values, ...trip }, ready && Boolean(current));

  const cell = (preview: FarePreview | undefined, key: (typeof LINES)[number]) =>
    preview?.lines.find((l) => l.key === key)?.cents;
  const diff = (a?: number, b?: number) => (a === undefined || b === undefined ? undefined : a - b);
  const money = (cents?: number) => (cents === undefined ? "—" : f.eur(cents));
  const delta = (cents?: number) =>
    cents === undefined ? "—" : cents === 0 ? f.eur(0) : `${cents > 0 ? "+" : "−"}${f.eur(Math.abs(cents))}`;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-card-title">{t("trip")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <FormField label={t("distance")}>
            {(p) => <Input {...p} inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} />}
          </FormField>
          <FormField label={t("duration")}>
            {(p) => <Input {...p} inputMode="decimal" value={duration} onChange={(e) => setDuration(e.target.value)} />}
          </FormField>
          <FormField label={t("waiting")}>
            {(p) => <Input {...p} inputMode="decimal" value={waiting} onChange={(e) => setWaiting(e.target.value)} />}
          </FormField>
          <FormField label={t("day")}>
            {(p) => (
              <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v) as Weekday)}>
                <SelectTrigger {...p} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEK.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {tp(`days.long.${d}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label={t("time")}>
            {(p) => <Input {...p} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
          </FormField>
          <FormField label={t("surge")}>
            {(p) => (
              <Select value={String(surge)} onValueChange={(v) => setSurge(Number(v))}>
                <SelectTrigger {...p} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SURGES.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s === 1 ? t("noSurge") : `×${s}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
        </CardContent>
      </Card>

      {!current && <InlineAlert tone="info">{t("noCurrent")}</InlineAlert>}

      <Card className="gap-0 overflow-x-auto py-0" data-testid="preview-table">
        {next.isPending ? (
          <Skeleton className="m-4 h-72" />
        ) : next.isError ? (
          <p className="text-dense p-4 text-destructive">{t("failed")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("line")}</TableHead>
                {current && <TableHead className="text-right">{t("current", { n: current.version })}</TableHead>}
                <TableHead className="text-right">{t("new")}</TableHead>
                {current && <TableHead className="text-right">{t("difference")}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {LINES.map((key) => {
                const a = cell(old.data, key);
                const b = cell(next.data, key);
                // Hide lines that are zero on both sides (no waiting, no zone).
                if (!(a || b) && key !== "base") return null;
                return (
                  <TableRow key={key}>
                    <TableCell>{t(`lines.${key}`)}</TableCell>
                    {current && <TableCell className="tabular text-right">{money(a)}</TableCell>}
                    <TableCell className="tabular text-right">{money(b)}</TableCell>
                    {current && <TableCell className="tabular text-right">{delta(diff(b, a))}</TableCell>}
                  </TableRow>
                );
              })}
              <TableRow className="font-semibold">
                <TableCell>{t("lines.total")}</TableCell>
                {current && <TableCell className="tabular text-right">{money(old.data?.totalCents)}</TableCell>}
                <TableCell className="tabular text-right" data-testid="preview-total-new">
                  {money(next.data?.totalCents)}
                </TableCell>
                {current && (
                  <TableCell
                    className={cn("tabular text-right", (diff(next.data?.totalCents, old.data?.totalCents) ?? 0) !== 0 && "text-warning")}
                    data-testid="preview-total-diff"
                  >
                    {delta(diff(next.data?.totalCents, old.data?.totalCents))}
                  </TableCell>
                )}
              </TableRow>
            </TableBody>
          </Table>
        )}
      </Card>
      {next.data && (
        <div className="flex flex-wrap gap-2">
          {next.data.multiplier > 1 && <Badge variant="warning">{t("multiplier", { x: next.data.multiplier })}</Badge>}
          {next.data.minimumApplied && <Badge variant="info">{t("minimumApplied")}</Badge>}
          {old.data?.minimumApplied && <Badge variant="neutral">{t("minimumAppliedCurrent")}</Badge>}
        </div>
      )}

      <div className="flex justify-between gap-2">
        <Button type="button" variant="outline" onClick={onBack}>
          {tp("editor.back")}
        </Button>
        <Button type="button" onClick={onNext}>
          {tp("editor.toPublish")}
        </Button>
      </div>
    </div>
  );
}
