/**
 * The sample data's "now". Every generated date is relative to it, so the demo
 * always shows "today" activity. It is fixed when the data is generated (and
 * again on reset) — floored to the minute so it is stable within a session.
 * Live positions use the real clock on top of it (services/live.ts).
 */
const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

let anchor = Math.floor(Date.now() / MINUTE) * MINUTE;

export const now = () => anchor;

/**
 * Lisbon midnight of the anchor's day. Generators base historical dates that
 * other records are compared with (sign-ups, fare versions, campaign windows)
 * on this, not on the minute — so regenerating later the same day gives
 * identical records, only "now"-relative things (live rides) move.
 */
export const today = () => startOfLisbonDay(anchor);

export function resetClock() {
  anchor = Math.floor(Date.now() / MINUTE) * MINUTE;
}

export const iso = (ms: number) => new Date(ms).toISOString();

export const minutesAgo = (minutes: number) => anchor - minutes * MINUTE;
export const hoursAgo = (hours: number) => anchor - hours * HOUR;
export const daysAgo = (days: number) => anchor - days * DAY;
export const daysAhead = (days: number) => anchor + days * DAY;

export const addMinutes = (ms: number, minutes: number) => ms + minutes * MINUTE;

/** Lisbon wall-clock parts of a timestamp (hour 0–23, weekday 0 = Sunday, date "YYYY-MM-DD"). */
const lisbon = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Lisbon",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});
const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function lisbonParts(ms: number) {
  const parts = Object.fromEntries(lisbon.formatToParts(ms).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    weekday: WEEKDAYS[parts.weekday ?? "Mon"] ?? 1,
  };
}

/** Lisbon calendar day "YYYY-MM-DD" (chart buckets). */
export const lisbonDay = (value: number | string) =>
  lisbonParts(typeof value === "string" ? Date.parse(value) : value).date;

/** UTC ms of Lisbon midnight for the day containing `ms`. */
export function startOfLisbonDay(ms: number) {
  const { hour } = lisbonParts(ms);
  const sameHour = ms - (ms % HOUR);
  let start = sameHour - hour * HOUR;
  // DST edges: step until the Lisbon date flips.
  while (lisbonParts(start - 1).date === lisbonParts(ms).date) start -= HOUR;
  while (lisbonParts(start).date !== lisbonParts(ms).date) start += HOUR;
  return start;
}

/** Monday 00:00 Lisbon of the week containing `ms` (settlement weeks). */
export function weekStart(ms: number) {
  const { weekday } = lisbonParts(ms);
  return startOfLisbonDay(ms - ((weekday + 6) % 7) * DAY);
}
