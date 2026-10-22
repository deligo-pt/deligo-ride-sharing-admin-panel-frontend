import type { AppLocale } from "@/i18n/routing";

/**
 * Display formatting — the only place numbers, money and dates become text.
 * Pure functions (usable in services, CSV export, server components); in
 * components prefer `useFormat()`, which binds the current locale.
 *
 * Conventions (ride_plan.md §D): money is integer **cents**, dates are ISO UTC
 * strings, everything is shown in Lisbon time. Percentages are **fractions**
 * (0.2 → "20%").
 */

export const TIME_ZONE = "Europe/Lisbon";

const INTL_LOCALE: Record<AppLocale, string> = { pt: "pt-PT", en: "en-GB" };

export type DateInput = Date | string | number;

const toDate = (value: DateInput) => (value instanceof Date ? value : new Date(value));

// Intl constructors are slow; tables render thousands of cells — cache them.
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>();
function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>(
  key: string,
  make: () => T,
): T {
  let formatter = cache.get(key);
  if (!formatter) {
    formatter = make();
    cache.set(key, formatter);
  }
  return formatter as T;
}

function numberFormat(locale: AppLocale, options: Intl.NumberFormatOptions) {
  return cached(
    `n|${locale}|${JSON.stringify(options)}`,
    () => new Intl.NumberFormat(INTL_LOCALE[locale], options),
  );
}

function dateFormat(locale: AppLocale, options: Intl.DateTimeFormatOptions) {
  return cached(
    `d|${locale}|${JSON.stringify(options)}`,
    () => new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: TIME_ZONE, ...options }),
  );
}

/**
 * 123450 → "1234,50 €" (pt — no separator below 10 000, per pt-PT) / "€1,234.50"
 * (en). `compact` for KPI tiles: "12,3 mil €" / "€12.3k".
 */
export function formatEUR(cents: number, locale: AppLocale, options: { compact?: boolean } = {}) {
  return numberFormat(locale, {
    style: "currency",
    currency: "EUR",
    ...(options.compact ? { notation: "compact", maximumFractionDigits: 1 } : {}),
  }).format(cents / 100);
}

export function formatNumber(
  value: number,
  locale: AppLocale,
  options: { compact?: boolean; decimals?: number } = {},
) {
  return numberFormat(locale, {
    maximumFractionDigits: options.decimals ?? 0,
    minimumFractionDigits: options.decimals ?? 0,
    ...(options.compact
      ? { notation: "compact", maximumFractionDigits: 1, minimumFractionDigits: 0 }
      : {}),
  }).format(value);
}

/** Fraction in, percent out: 0.125 → "12,5%" (pt) / "12.5%" (en). */
export function formatPercent(fraction: number, locale: AppLocale, decimals = 1) {
  return numberFormat(locale, { style: "percent", maximumFractionDigits: decimals }).format(
    fraction,
  );
}

/** "18/10/2026" in Lisbon time. */
export function formatDate(value: DateInput, locale: AppLocale) {
  return dateFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    toDate(value),
  );
}

/** "18/10/2026, 14:05" (24 h) in Lisbon time. */
export function formatDateTime(value: DateInput, locale: AppLocale) {
  return dateFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(toDate(value));
}

/** "14:05" in Lisbon time. */
export function formatTime(value: DateInput, locale: AppLocale) {
  return dateFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    toDate(value),
  );
}

/**
 * "18 out 2026" / "18 Oct 2026" — for headers and chart tooltips.
 * pt-PT's Intl "short month" is numeric ("18/10/2026"), so the month name is
 * built from the standalone month ("out.", dot dropped).
 */
export function formatDateShort(value: DateInput, locale: AppLocale) {
  return dayMonth(value, locale, true);
}

/** "18 out" / "18 Oct" — chart axes. */
export function formatDayMonth(value: DateInput, locale: AppLocale) {
  return dayMonth(value, locale, false);
}

function dayMonth(value: DateInput, locale: AppLocale, withYear: boolean) {
  const date = toDate(value);
  if (locale === "en") {
    return dateFormat(locale, {
      day: "numeric",
      month: "short",
      ...(withYear && { year: "numeric" }),
    }).format(date);
  }
  const day = dateFormat(locale, { day: "numeric" }).format(date);
  const month = dateFormat(locale, { month: "short" }).format(date).replace(/\.$/, "");
  return withYear
    ? `${day} ${month} ${dateFormat(locale, { year: "numeric" }).format(date)}`
    : `${day} ${month}`;
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.345],
  ["month", 12],
  ["year", Infinity],
];

/**
 * "há 5 minutos" / "5 minutes ago", "dentro de 2 dias" / "in 2 days".
 * Pass `now` when rendering on the server and the client to keep them equal.
 */
export function formatRelative(value: DateInput, locale: AppLocale, now: DateInput = Date.now()) {
  const formatter = cached(
    `r|${locale}`,
    () => new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: "auto" }),
  );
  let amount = (toDate(value).getTime() - toDate(now).getTime()) / 1000;
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(amount) < size) return formatter.format(Math.round(amount), unit);
    amount /= size;
  }
  return formatter.format(Math.round(amount), "year");
}

/** 12.345 → "12,3 km". */
export function formatKm(km: number, locale: AppLocale) {
  return `${formatNumber(km, locale, { decimals: 1 })} km`;
}

/** Seconds → "12 min" / "1 h 05 min". */
export function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/** "+351912345678" → "+351 912 345 678". Other formats are returned unchanged. */
export function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("351")) {
    return `+351 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return phone;
}

/** For roles without the `sensitive` permission (P7): "+351 912 *** 678". */
export function maskPhone(phone: string) {
  const formatted = formatPhone(phone);
  const parts = formatted.split(" ");
  if (parts.length === 4) return `${parts[0]} ${parts[1]} *** ${parts[3]}`;
  return formatted.length > 4 ? `${"*".repeat(formatted.length - 3)}${formatted.slice(-3)}` : "***";
}

/** For roles without the `sensitive` permission (P7): "ana.martins@deligo.pt" → "an***@deligo.pt". */
export function maskEmail(email: string) {
  const [user = "", domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 2)}***@${domain}`;
}

/** NIF, IBAN, licence numbers… for roles without `sensitive`: "*****789". */
export function maskTail(value: string, visible = 3) {
  return value.length > visible ? `*****${value.slice(-visible)}` : "***";
}
