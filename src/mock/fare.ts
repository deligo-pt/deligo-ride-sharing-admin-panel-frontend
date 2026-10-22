import type { Cents } from "@/types/common";
import type { PricingRule, TimeBand, Weekday } from "@/types/pricing";
import type { FareBreakdown } from "@/types/ride";
import type { DiscountType } from "@/types/promotion";
import { lisbonParts } from "./clock";

/**
 * The fare formula — the backend's job. Used when generating rides and by the
 * pricing preview, so both always agree (§11: preview before publishing).
 *
 *   lines = base + km·perKm + min·perMinute + waiting + booking fee + zone
 *   surge = (base + distance + time) × (multiplier − 1)
 *   net   = max(lines + surge, minimum fare) − discount
 *   total = net + VAT
 */
export type FareInput = {
  distanceKm: number;
  durationMin: number;
  waitingMin: number;
  /** Booking time — picks the time band. */
  atMs: number;
  /** Demand surge (1 = none), capped by the rule. */
  surge: number;
  zoneCents: Cents;
  discount?: { type: DiscountType; value: number; maxCents?: Cents };
};

export type FareResult = FareBreakdown & { multiplier: number; minimumApplied: boolean; net: Cents };

function minutesOfDay(hhmm: string) {
  const [h = "0", m = "0"] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

/** Does a Lisbon time fall in the band? Bands past midnight belong to the day they start. */
function inBand(band: TimeBand, weekday: number, minute: number) {
  const from = minutesOfDay(band.from);
  const to = minutesOfDay(band.to);
  if (from < to) return band.days.includes(weekday as Weekday) && minute >= from && minute < to;
  const yesterday = ((weekday + 6) % 7) as Weekday;
  return (
    (band.days.includes(weekday as Weekday) && minute >= from) ||
    (band.days.includes(yesterday) && minute < to)
  );
}

export function timeBandMultiplier(rule: Pick<PricingRule, "timeBands">, atMs: number) {
  const { hour, weekday } = lisbonParts(atMs);
  // Lisbon's UTC offset is whole hours, so UTC minutes are Lisbon minutes.
  const minute = hour * 60 + new Date(atMs).getUTCMinutes();
  return rule.timeBands.reduce((m, band) => (inBand(band, weekday, minute) ? Math.max(m, band.multiplier) : m), 1);
}

export function computeFare(rule: PricingRule, input: FareInput): FareResult {
  const surge = rule.surge.enabled ? Math.min(Math.max(1, input.surge), rule.surge.maxMultiplier) : 1;
  const multiplier = Math.round(timeBandMultiplier(rule, input.atMs) * surge * 100) / 100;

  const base = rule.baseFare;
  const distance = Math.round(rule.perKm * input.distanceKm);
  const time = Math.round(rule.perMinute * input.durationMin);
  const waiting = Math.round(rule.waitingPerMinute * input.waitingMin);
  const booking = rule.bookingFee;
  const zone = input.zoneCents;
  const surgeCents = Math.round((base + distance + time) * (multiplier - 1));

  let subtotal = base + distance + time + waiting + booking + zone + surgeCents;
  let topUp = 0;
  if (subtotal < rule.minimumFare) {
    topUp = rule.minimumFare - subtotal;
    subtotal = rule.minimumFare;
  }

  let discount = 0;
  if (input.discount) {
    discount =
      input.discount.type === "FLAT"
        ? input.discount.value
        : Math.round(subtotal * input.discount.value);
    if (input.discount.maxCents !== undefined) discount = Math.min(discount, input.discount.maxCents);
    discount = Math.min(discount, subtotal);
  }

  const net = subtotal - discount;
  const vat = Math.round(net * rule.vatRate);
  return {
    // The minimum-fare top-up is shown inside the base line.
    base: base + topUp,
    distance,
    time,
    waiting,
    booking,
    zone,
    surge: surgeCents,
    discount,
    vatRate: rule.vatRate,
    vat,
    total: net + vat,
    multiplier,
    minimumApplied: topUp > 0,
    net,
  };
}

/** Fare net of VAT — what commission is charged on. */
export const fareNet = (fare: Pick<FareBreakdown, "total" | "vat">) => fare.total - fare.vat;
