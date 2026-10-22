"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/badges/status-badge";
import { cn } from "@/lib/utils";
import { Ago } from "./ago";
import { AttentionBadges } from "./attention-badges";
import type { LiveItem } from "./live-utils";

/** The side list, in step with the map: the selected ride is highlighted and scrolled into view. */
export function LiveList({
  items,
  selectedId,
  onSelect,
}: {
  items: LiveItem[];
  selectedId: string | null;
  onSelect: (rideId: string) => void;
}) {
  const t = useTranslations("live.list");
  const selectedRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  return (
    <ul className="flex flex-col divide-y" aria-label={t("label")}>
      {items.map((ride) => {
        const selected = ride.rideId === selectedId;
        return (
          <li key={ride.rideId} ref={selected ? selectedRef : undefined} data-ride-id={ride.rideId}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(ride.rideId)}
              className={cn(
                "flex w-full flex-col gap-1.5 px-3 py-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60",
                selected && "bg-accent",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="tabular text-dense font-medium">{ride.rideId}</span>
                <StatusBadge kind="ride" value={ride.status} />
              </span>
              <span className="text-dense truncate">
                {ride.customerName ?? "—"}
                <span className="text-muted-foreground"> · {ride.city}</span>
              </span>
              <span className="text-caption truncate">
                {ride.driverName
                  ? `${ride.driverName}${ride.vehiclePlate ? ` · ${ride.vehiclePlate}` : ""}`
                  : ride.driverId
                    ? (ride.vehiclePlate ?? ride.driverId)
                    : t("noDriver")}
              </span>
              <AttentionBadges reasons={ride.attention} />
              <span className={cn("text-caption", ride.stale && "text-warning")}>
                {ride.location ? (
                  <>
                    {t("lastUpdate")} <Ago iso={ride.location.at} />
                  </>
                ) : ride.driverId ? (
                  t("locationUnavailable")
                ) : (
                  t("minutesInStatus", { n: ride.minutesInStatus })
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
