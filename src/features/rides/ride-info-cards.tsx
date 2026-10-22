"use client";

import { Car, Star, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import type { RideDetail } from "@/types/ride";
import { StatusBadge } from "@/components/badges/status-badge";
import { KeyValueGrid } from "@/components/detail/detail-parts";
import { usePermission } from "@/components/session/permissions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { useFormat } from "@/lib/use-format";
import { initials } from "@/lib/utils";

/** A name that links to its page when the role may open that module. */
function MaybeLink({
  href,
  allowed,
  children,
}: {
  href: `/${string}`;
  allowed: boolean;
  children: React.ReactNode;
}) {
  return allowed ? (
    <Link href={href} className="text-primary hover:underline">
      {children}
    </Link>
  ) : (
    <>{children}</>
  );
}

/** Trip facts: times, type, distance, duration, surge, rating (§9 "complete ride information"). */
export function RideSummaryCard({ ride }: { ride: RideDetail }) {
  const t = useTranslations("rides.detail");
  const tAll = useTranslations();
  const f = useFormat();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-title">{t("sections.summary")}</CardTitle>
      </CardHeader>
      <CardContent>
        <KeyValueGrid
          columns={1}
          items={[
            { label: t("summary.status"), value: <StatusBadge kind="ride" value={ride.status} /> },
            { label: t("summary.type"), value: tAll(`enums.rideCategory.${ride.rideType}`) },
            { label: t("summary.booked"), value: f.dateTime(ride.bookedAt) },
            ...(ride.scheduledFor
              ? [{ label: t("summary.scheduled"), value: f.dateTime(ride.scheduledFor) }]
              : []),
            {
              label: t("summary.started"),
              value: ride.startedAt ? f.dateTime(ride.startedAt) : null,
            },
            {
              label: t("summary.completed"),
              value: ride.completedAt ? f.dateTime(ride.completedAt) : null,
            },
            {
              label: t("summary.distance"),
              value:
                ride.status === "COMPLETED"
                  ? f.km(ride.distanceKm)
                  : `${f.km(ride.distanceKm)} (${t("summary.estimate")})`,
            },
            { label: t("summary.duration"), value: f.duration(ride.durationMin * 60) },
            ...(ride.surgeMultiplier > 1
              ? [
                  {
                    label: t("summary.surge"),
                    value: `${f.number(ride.surgeMultiplier, { decimals: 1 })}×`,
                  },
                ]
              : []),
            ...(ride.rating
              ? [
                  {
                    label: t("summary.rating"),
                    value: (
                      <span className="inline-flex items-center gap-1">
                        <Star aria-hidden className="size-3.5 fill-warning text-warning" />
                        {ride.rating} / 5
                      </span>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </CardContent>
    </Card>
  );
}

export function RideCustomerCard({ ride }: { ride: RideDetail }) {
  const t = useTranslations("rides.detail");
  const f = useFormat();
  const allowed = usePermission();
  const c = ride.customer;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-title flex items-center gap-2">
          <UserRound aria-hidden className="size-5 text-muted-foreground" />
          {t("sections.customer")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <KeyValueGrid
          columns={1}
          items={[
            {
              label: t("customer.name"),
              value: (
                <MaybeLink href={`/customers/${c.id}`} allowed={allowed("customers", "view")}>
                  {c.name}
                </MaybeLink>
              ),
            },
            { label: t("customer.id"), value: <span className="tabular">{c.id}</span> },
            { label: t("customer.phone"), value: f.phone(c.phone) },
            { label: t("customer.email"), value: c.email },
          ]}
        />
      </CardContent>
    </Card>
  );
}

/** Driver and vehicle, or "no driver yet" while the ride is still searching. */
export function RideDriverCard({ ride }: { ride: RideDetail }) {
  const t = useTranslations("rides.detail");
  const tAll = useTranslations();
  const f = useFormat();
  const allowed = usePermission();
  const d = ride.driver;
  const v = ride.vehicle;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-title flex items-center gap-2">
          <Car aria-hidden className="size-5 text-muted-foreground" />
          {t("sections.driver")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!d ? (
          <p className="text-dense text-muted-foreground">{t("noDriver")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Avatar className="size-11">
                <AvatarImage src={d.photoUrl} alt="" />
                <AvatarFallback className="bg-accent font-semibold text-accent-foreground">
                  {initials(d.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <MaybeLink href={`/drivers/${d.id}`} allowed={allowed("drivers", "view")}>
                  <span className="text-dense font-semibold">{d.name}</span>
                </MaybeLink>
                <span className="text-caption tabular-nums">
                  {d.id} · ★ {f.number(d.rating, { decimals: 1 })}
                </span>
              </div>
            </div>
            <KeyValueGrid
              columns={1}
              items={[
                { label: t("driver.phone"), value: f.phone(d.phone) },
                {
                  label: t("driver.vehicle"),
                  value: v ? (
                    <MaybeLink href={`/vehicles/${v.id}`} allowed={allowed("vehicles", "view")}>
                      <span className="tabular font-medium">{v.plate}</span> · {v.make} {v.model}
                    </MaybeLink>
                  ) : null,
                },
                {
                  label: t("driver.category"),
                  value: v ? tAll(`enums.rideCategory.${v.category}`) : null,
                },
                { label: t("driver.fleet"), value: ride.fleetName ?? t("driver.independent") },
              ]}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Who cancelled, why, the note and the fee (§9 "review cancellation reasons"). */
export function RideCancellationCard({ ride }: { ride: RideDetail }) {
  const t = useTranslations("rides.detail");
  const f = useFormat();
  const c = ride.cancellation;
  if (!c) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-title">{t("sections.cancellation")}</CardTitle>
      </CardHeader>
      <CardContent>
        <KeyValueGrid
          columns={1}
          items={[
            { label: t("cancellation.by"), value: t(`cancelledBy.${c.by}`) },
            { label: t("cancellation.reason"), value: t(`cancelReasons.${c.reason}`) },
            { label: t("cancellation.note"), value: c.note ?? null },
            {
              label: t("cancellation.fee"),
              value: c.feeCents > 0 ? f.eur(c.feeCents) : t("cancellation.noFee"),
            },
            { label: t("cancellation.at"), value: f.dateTime(c.at) },
          ]}
        />
      </CardContent>
    </Card>
  );
}
