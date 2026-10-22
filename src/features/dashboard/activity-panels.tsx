"use client";

import { ArrowRight } from "lucide-react";
import { useNow, useTranslations } from "next-intl";
import type { RecentRegistration } from "@/types/analytics";
import type { RideListItem } from "@/types/ride";
import { StatusBadge, type StatusValue } from "@/components/badges/status-badge";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";

type Query<T> = { data: T | undefined; isPending: boolean; error: unknown; refetch: () => unknown };

const shortAddress = (address: string) => address.split(",")[0] ?? address;

function Rows() {
  return (
    <div className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  );
}

/** The latest rides, live and finished (§4). Only for roles that may open Rides. */
export function RecentRidesCard({ query }: { query: Query<RideListItem[]> }) {
  const t = useTranslations("dashboard.recentRides");
  const f = useFormat();
  // Relative times follow the clock without a hydration mismatch.
  const now = useNow({ updateInterval: 60_000 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-title">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/rides">
              {t("viewAll")}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <Rows />
        ) : query.data === undefined ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} className="py-6" />
        ) : query.data.length === 0 ? (
          <EmptyState title={t("empty")} className="py-6" />
        ) : (
          <ul className="-mx-2 flex flex-col divide-y">
            {query.data.map((ride) => (
              <li key={ride.id}>
                <Link
                  href={`/rides/${ride.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2.5 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <div className="flex min-w-0 flex-1 basis-56 flex-col">
                    <span className="text-dense truncate font-medium">
                      {shortAddress(ride.pickup.address)} → {shortAddress(ride.dropoff.address)}
                    </span>
                    <span className="text-caption truncate">
                      {ride.id} · {ride.customerName} · {f.relative(ride.bookedAt, now)}
                    </span>
                  </div>
                  <span className="text-dense tabular w-20 text-right font-medium">
                    {f.eur(ride.finalFareCents ?? ride.estimatedFareCents)}
                  </span>
                  <StatusBadge kind="ride" value={ride.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const REGISTRATION_HREF = {
  CUSTOMER: "/customers",
  DRIVER: "/drivers",
  FLEET: "/fleet-managers",
} as const;

function RegistrationStatus({ item }: { item: RecentRegistration }) {
  // The service sends each kind's own status enum as a string.
  if (item.kind === "CUSTOMER")
    return <StatusBadge kind="customer" value={item.status as StatusValue<"customer">} />;
  if (item.kind === "DRIVER")
    return (
      <StatusBadge
        kind="driverVerification"
        value={item.status as StatusValue<"driverVerification">}
      />
    );
  return (
    <StatusBadge kind="fleetVerification" value={item.status as StatusValue<"fleetVerification">} />
  );
}

/** Newest customers, drivers and fleets — only the kinds the role may open (the service trims them). */
export function RecentRegistrationsCard({ query }: { query: Query<RecentRegistration[]> }) {
  const t = useTranslations("dashboard.registrations");
  const f = useFormat();
  const now = useNow({ updateInterval: 60_000 });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-title">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <Rows />
        ) : query.data === undefined ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} className="py-6" />
        ) : query.data.length === 0 ? (
          <EmptyState title={t("empty")} className="py-6" />
        ) : (
          <ul className="-mx-2 flex flex-col divide-y">
            {query.data.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  href={`${REGISTRATION_HREF[item.kind]}/${item.id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-dense truncate font-medium">{item.name}</span>
                    <span className="text-caption truncate">
                      {item.id} · {f.relative(item.at, now)}
                    </span>
                  </div>
                  <Badge variant="neutral" className="text-micro h-5 shrink-0">
                    {t(`kind.${item.kind}`)}
                  </Badge>
                  <RegistrationStatus item={item} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
