"use client";

import { useTranslations } from "next-intl";
import { useSecondTick } from "@/lib/use-ticker";

/** "12 s ago" that keeps counting between polls — its own clock, so the list around it doesn't re-render every second. */
export function Ago({ iso, className }: { iso: string; className?: string }) {
  const t = useTranslations("live.ago");
  const now = useSecondTick();
  const seconds = Math.max(0, Math.round(((now || Date.parse(iso)) - Date.parse(iso)) / 1000));
  const label =
    seconds < 60
      ? t("seconds", { n: seconds })
      : seconds < 3600
        ? t("minutes", { n: Math.floor(seconds / 60) })
        : t("hours", { n: Math.floor(seconds / 3600) });
  return (
    <time dateTime={iso} className={className}>
      {label}
    </time>
  );
}
