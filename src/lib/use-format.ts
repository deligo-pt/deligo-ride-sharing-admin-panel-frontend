import { useLocale } from "next-intl";
import { useMemo } from "react";
import * as f from "./format";

/**
 * The formatters from `lib/format.ts`, bound to the current locale. Works in
 * client components and non-async server components; async server components
 * call `getLocale()` and the plain functions.
 */
export function useFormat() {
  const locale = useLocale();
  return useMemo(
    () => ({
      locale,
      eur: (cents: number, options?: { compact?: boolean }) => f.formatEUR(cents, locale, options),
      number: (value: number, options?: { compact?: boolean; decimals?: number }) =>
        f.formatNumber(value, locale, options),
      percent: (fraction: number, decimals?: number) => f.formatPercent(fraction, locale, decimals),
      date: (value: f.DateInput) => f.formatDate(value, locale),
      dateShort: (value: f.DateInput) => f.formatDateShort(value, locale),
      dayMonth: (value: f.DateInput) => f.formatDayMonth(value, locale),
      dateTime: (value: f.DateInput) => f.formatDateTime(value, locale),
      time: (value: f.DateInput) => f.formatTime(value, locale),
      relative: (value: f.DateInput, now?: f.DateInput) => f.formatRelative(value, locale, now),
      km: (km: number) => f.formatKm(km, locale),
      duration: f.formatDuration,
      phone: f.formatPhone,
      maskPhone: f.maskPhone,
      maskEmail: f.maskEmail,
    }),
    [locale],
  );
}
