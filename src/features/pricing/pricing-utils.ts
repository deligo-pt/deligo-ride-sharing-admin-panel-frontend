import { TZDate } from "@date-fns/tz";
import type { PricingRule, PricingRuleInput, TimeBand, VatRate, Weekday } from "@/types/pricing";
import type { RideCategory } from "@/types/vehicle";

export const CATEGORIES: readonly RideCategory[] = ["ECONOMY", "COMFORT", "PREMIUM"];
export const VAT_RATES: readonly VatRate[] = [0.06, 0.13, 0.23];

/** Monday first, as a Portuguese week reads (0 = Sunday in the data). */
export const WEEK: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 0];

/** The money and rate fields shown side by side, in the order a fare reads. */
export const MONEY_FIELDS = [
  "baseFare",
  "minimumFare",
  "perKm",
  "perMinute",
  "bookingFee",
  "waitingPerMinute",
  "cancellationFee",
] as const;
export type MoneyField = (typeof MONEY_FIELDS)[number];

/** The editable part of a rule — what a new version starts from. */
export function toInput(rule: PricingRule): PricingRuleInput {
  return {
    category: rule.category,
    zoneId: rule.zoneId,
    baseFare: rule.baseFare,
    minimumFare: rule.minimumFare,
    perKm: rule.perKm,
    perMinute: rule.perMinute,
    bookingFee: rule.bookingFee,
    waitingPerMinute: rule.waitingPerMinute,
    cancellationFee: rule.cancellationFee,
    timeBands: rule.timeBands.map((b: TimeBand) => ({ ...b, days: [...b.days] })),
    surge: { ...rule.surge },
    vatRate: rule.vatRate,
  };
}

const LISBON = "Europe/Lisbon";

/** The next date (from `nowMs`) falling on a Lisbon weekday and "HH:mm", as ISO — for trying a fare at a given time of the week. */
export function nextLisbonSlot(nowMs: number, weekday: Weekday, hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  const today = new TZDate(nowMs, LISBON);
  const slot = new TZDate(today.getFullYear(), today.getMonth(), today.getDate(), h, m, 0, LISBON);
  slot.setDate(slot.getDate() + ((weekday - slot.getDay() + 7) % 7));
  return slot.toISOString();
}

/** A Lisbon calendar day ("yyyy-MM-dd") and time ("HH:mm") as ISO. */
export function lisbonIso(ymd: string, hhmm: string): string {
  const [y = 0, mo = 1, d = 1] = ymd.split("-").map(Number);
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return new TZDate(y, mo - 1, d, h, m, 0, LISBON).toISOString();
}

/** Today's Lisbon date as "yyyy-MM-dd". */
export function lisbonToday(nowMs: number): string {
  const d = new TZDate(nowMs, LISBON);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
