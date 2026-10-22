"use client";

import { useTranslations } from "next-intl";
import type { TimeBand } from "@/types/pricing";
import { WEEK } from "./pricing-utils";

/** "Mon, Tue · 07:30–09:30 · ×1.1" — one time band as text. */
export function useBandLabel() {
  const t = useTranslations("pricing.days");
  return (band: TimeBand) => {
    const days = WEEK.filter((d) => band.days.includes(d))
      .map((d) => t(`short.${d}`))
      .join(", ");
    return `${days} · ${band.from}–${band.to} · ×${band.multiplier}`;
  };
}
