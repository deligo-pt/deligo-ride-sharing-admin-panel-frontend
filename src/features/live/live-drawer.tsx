"use client";

import { ArrowRight, Flag, MapPin, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/badges/status-badge";
import { usePermission } from "@/components/session/permissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRide } from "@/hooks/queries/rides";
import { Link } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { Ago } from "./ago";
import { AttentionBadges } from "./attention-badges";
import type { LiveItem } from "./live-utils";

/** Address and fare lines — only mounted for roles that may open rides, so the others never trigger the request. */
function RideLines({ id }: { id: string }) {
  const t = useTranslations("live.drawer");
  const f = useFormat();
  const query = useRide(id);
  if (query.isPending) return <Skeleton className="h-24 w-full" />;
  if (query.isError) return <p className="text-caption">{t("detailsUnavailable")}</p>;
  const ride = query.data;
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        <li className="flex items-start gap-2.5">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
          <span className="flex flex-col">
            <span className="text-caption">{t("pickup")}</span>
            <span className="text-dense">{ride.pickup.address}</span>
          </span>
        </li>
        <li className="flex items-start gap-2.5">
          <Flag aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="flex flex-col">
            <span className="text-caption">{t("dropoff")}</span>
            <span className="text-dense">{ride.dropoff.address}</span>
          </span>
        </li>
      </ol>
      <dl className="text-dense grid grid-cols-2 gap-2">
        <div>
          <dt className="text-caption">{t("estimatedFare")}</dt>
          <dd className="tabular font-medium">{f.eur(ride.estimatedFareCents)}</dd>
        </div>
        <div>
          <dt className="text-caption">{t("distance")}</dt>
          <dd className="tabular font-medium">{f.km(ride.distanceKm)}</dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * The ride drawer (§10): opens over the map when a ride is picked there or in
 * the list, without hiding either. It doesn't block the map (it isn't a modal),
 * so the operator can keep clicking around. "Open ride details" goes to the
 * full page for roles that may open rides.
 */
export function LiveDrawer({ ride, onClose }: { ride: LiveItem; onClose: () => void }) {
  const t = useTranslations("live.drawer");
  const allowed = usePermission();
  const canOpen = allowed("rides", "view");

  return (
    <Card
      role="dialog"
      aria-label={t("label", { id: ride.rideId })}
      data-testid="live-drawer"
      className={cn(
        "absolute inset-x-3 bottom-3 z-10 max-h-[55%] gap-0 overflow-y-auto py-0 shadow-lg",
        "sm:inset-x-auto sm:top-3 sm:right-3 sm:bottom-3 sm:max-h-none sm:w-80",
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b p-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="text-card-title tabular">{ride.rideId}</h2>
          <div>
            <StatusBadge kind="ride" value={ride.status} />
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t("close")}>
          <X />
        </Button>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <AttentionBadges reasons={ride.attention} />
        <dl className="text-dense grid grid-cols-2 gap-x-3 gap-y-3">
          <div className="min-w-0">
            <dt className="text-caption">{t("customer")}</dt>
            <dd className="truncate">{ride.customerName ?? "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-caption">{t("driver")}</dt>
            <dd className="truncate">
              {ride.driverName ?? (ride.driverId ? ride.driverId : t("noDriver"))}
              {ride.vehiclePlate && <span className="text-muted-foreground"> · {ride.vehiclePlate}</span>}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-caption">{t("lastUpdate")}</dt>
            <dd className={cn(ride.stale && "text-warning")}>
              {ride.location ? (
                <Ago iso={ride.location.at} />
              ) : ride.driverId ? (
                t("locationUnavailable")
              ) : (
                t("noDriverYet")
              )}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-caption">{t("inStatus")}</dt>
            <dd>{t("minutes", { n: ride.minutesInStatus })}</dd>
          </div>
        </dl>
        {canOpen && <RideLines id={ride.rideId} />}
        {canOpen ? (
          <Button asChild>
            <Link href={`/rides/${ride.rideId}`}>
              {t("openDetails")}
              <ArrowRight />
            </Link>
          </Button>
        ) : (
          <p className="text-caption">{t("noRideAccess")}</p>
        )}
      </div>
    </Card>
  );
}
