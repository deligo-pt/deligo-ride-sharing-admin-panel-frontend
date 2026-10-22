"use client";

import { Bell } from "lucide-react";
import { useNow, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";

/** Sample operational alerts. P22 replaces these with the notifications service. */
const ALERTS = [
  { id: "sos", values: { ride: "R-48213" }, minutesAgo: 2, tone: "bg-danger" },
  { id: "documents", values: { count: 6 }, minutesAgo: 18, tone: "bg-warning" },
  {
    id: "surge",
    values: { multiplier: 1.6, zone: "Lisboa — Baixa" },
    minutesAgo: 35,
    tone: "bg-info",
  },
  { id: "payouts", values: {}, minutesAgo: 60, tone: "bg-success" },
] as const;

export function NotificationsBell() {
  const t = useTranslations("shell");
  const format = useFormat();
  // Alerts are relative to `now`, so server and browser render the same text.
  const now = useNow({ updateInterval: 60_000 }).getTime();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("notificationsLabel", { count: ALERTS.length })}
          className="relative"
        >
          <Bell />
          <span
            aria-hidden
            className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-dense font-semibold">{t("notifications")}</p>
          <span className="text-caption">{t("newCount", { count: ALERTS.length })}</span>
        </div>
        <ul className="max-h-80 divide-y overflow-y-auto">
          {ALERTS.map((alert) => (
            <li key={alert.id} className="flex gap-3 px-4 py-3">
              <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", alert.tone)} />
              <div className="min-w-0">
                <p className="text-dense">
                  {t(`alerts.${alert.id}`, {
                    ...alert.values,
                    ...("multiplier" in alert.values && {
                      multiplier: `${format.number(alert.values.multiplier, { decimals: 1 })}×`,
                    }),
                  })}
                </p>
                <p className="text-caption">
                  {format.relative(now - alert.minutesAgo * 60_000, now)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
