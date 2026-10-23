import { useLocale } from "next-intl";
import type { RideCategory } from "@/types/vehicle";
import { TIME_ZONE } from "@/lib/format";
import { useFormat } from "@/lib/use-format";

export const RIDE_CATEGORIES: readonly RideCategory[] = ["ECONOMY", "COMFORT", "PREMIUM"];

/** The sample fare (before VAT) the rates tab uses to show what a rate means. */
export const EXAMPLE_FARE_CENTS = 1000;

/** 0.2 → "20%", 0.215 → "21.5%" (no trailing ".0"). */
export function rateDecimals(rate: number): number {
  return Math.abs(rate * 100 - Math.round(rate * 100)) < 1e-9 ? 0 : 1;
}

/**
 * "12 – 18 Oct 2026" for a settlement's week (both ends in the same month: the
 * month and year are said once), or both dates in full when it spans two.
 */
export function useWeekLabel() {
  const f = useFormat();
  const locale = useLocale();
  return (from: string, to: string) => {
    const part = (iso: string, options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale === "pt" ? "pt-PT" : "en-GB", { timeZone: TIME_ZONE, ...options }).format(new Date(iso));
    const sameMonth = part(from, { month: "numeric", year: "numeric" }) === part(to, { month: "numeric", year: "numeric" });
    return sameMonth ? `${part(from, { day: "numeric" })} – ${f.dateShort(to)}` : `${f.dateShort(from)} – ${f.dateShort(to)}`;
  };
}
