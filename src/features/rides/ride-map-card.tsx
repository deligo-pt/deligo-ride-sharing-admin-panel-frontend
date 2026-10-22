"use client";

import { ArrowRight, Flag, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import type { RideDetail } from "@/types/ride";
import { RouteMap } from "@/components/map/lazy-map";
import { Card } from "@/components/ui/card";
import { useFormat } from "@/lib/use-format";

/** Pickup, stops and destination on a map with the route (§9 "view the pickup and destination on a map"), and the addresses under it. */
export function RideMapCard({ ride }: { ride: RideDetail }) {
  const t = useTranslations("rides.detail");
  const f = useFormat();
  const live =
    ride.lastLocation &&
    ["ACCEPTED", "DRIVER_ARRIVING", "DRIVER_ARRIVED", "IN_PROGRESS", "EMERGENCY"].includes(
      ride.status,
    )
      ? ride.lastLocation
      : undefined;
  return (
    <Card className="gap-0 py-0">
      <div className="h-72 sm:h-96" data-testid="ride-map">
        <RouteMap pickup={ride.pickup} dropoff={ride.dropoff} stops={ride.stops} driver={live} />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <ol className="flex flex-col gap-2">
          <li className="flex items-start gap-2.5">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
            <span className="flex flex-col">
              <span className="text-caption">{t("map.pickup")}</span>
              <span className="text-dense">{ride.pickup.address}</span>
            </span>
          </li>
          {ride.stops.map((stop, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <ArrowRight aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="flex flex-col">
                <span className="text-caption">{t("map.stop", { number: i + 1 })}</span>
                <span className="text-dense">{stop.address}</span>
              </span>
            </li>
          ))}
          <li className="flex items-start gap-2.5">
            <Flag aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="flex flex-col">
              <span className="text-caption">{t("map.dropoff")}</span>
              <span className="text-dense">{ride.dropoff.address}</span>
            </span>
          </li>
        </ol>
        {live && <p className="text-caption">{t("map.lastLocation", { time: f.time(live.at) })}</p>}
      </div>
    </Card>
  );
}
