"use client";

import { Hourglass, MapPinOff, Siren, TimerReset, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import type { LiveAttention } from "@/types/live";
import { Badge } from "@/components/ui/badge";
import { ATTENTION_ORDER } from "./live-utils";

const ICONS = {
  SOS: Siren,
  NO_LOCATION: MapPinOff,
  STALE_LOCATION: WifiOff,
  LONG_SEARCH: Hourglass,
  LONG_WAIT: TimerReset,
} as const;

/** Why a ride needs attention, most urgent first (§10). */
export function AttentionBadges({ reasons }: { reasons: readonly LiveAttention[] }) {
  const t = useTranslations("live.attention");
  const sorted = ATTENTION_ORDER.filter((r) => reasons.includes(r));
  if (sorted.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t("label")}>
      {sorted.map((reason) => {
        const Icon = ICONS[reason];
        return (
          <li key={reason}>
            <Badge variant={reason === "SOS" ? "danger" : "warning"}>
              <Icon aria-hidden />
              {t(reason)}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
