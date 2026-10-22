import { TZDate } from "@date-fns/tz";
import { endOfDay, startOfDay, subDays } from "date-fns";
import type { DateRange } from "@/types/common";
import { TIME_ZONE } from "./format";

/**
 * Date-range presets for filters (§P5: Today / Yesterday / 7d / 30d / custom).
 * Day boundaries are Lisbon days. Custom dates travel in the URL as
 * "yyyy-MM-dd"; services receive ISO strings.
 */
export const DATE_PRESETS = ["today", "yesterday", "7d", "30d", "custom"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

const lisbonNow = () => new TZDate(Date.now(), TIME_ZONE);

/** "2026-10-19" → Lisbon midnight of that day. */
function lisbonDay(ymd: string) {
  const [y = 1970, m = 1, d = 1] = ymd.split("-").map(Number);
  return new TZDate(y, m - 1, d, TIME_ZONE);
}

export function resolveDateRange(
  preset: DatePreset | null,
  from?: string | null,
  to?: string | null,
): DateRange {
  const now = lisbonNow();
  switch (preset) {
    case "today":
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
    case "yesterday": {
      const y = subDays(now, 1);
      return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() };
    }
    case "7d":
      return { from: startOfDay(subDays(now, 6)).toISOString(), to: endOfDay(now).toISOString() };
    case "30d":
      return { from: startOfDay(subDays(now, 29)).toISOString(), to: endOfDay(now).toISOString() };
    case "custom":
      return {
        from: from ? startOfDay(lisbonDay(from)).toISOString() : undefined,
        to: to ? endOfDay(lisbonDay(to)).toISOString() : undefined,
      };
    default:
      return {};
  }
}

/** The last `days` Lisbon days including today — for periods that aren't a preset (earnings: 90 days). */
export function resolveLastDays(days: number): DateRange {
  const now = lisbonNow();
  return {
    from: startOfDay(subDays(now, days - 1)).toISOString(),
    to: endOfDay(now).toISOString(),
  };
}

/** Date → "yyyy-MM-dd" in Lisbon (for the URL). */
export function toYmd(date: Date) {
  const d = new TZDate(date.getTime(), TIME_ZONE);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "yyyy-MM-dd" → a local Date at noon (safe for the calendar widget). */
export function fromYmd(ymd: string) {
  const [y = 1970, m = 1, d = 1] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
