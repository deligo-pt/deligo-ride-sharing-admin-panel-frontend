"use client";

import { Ban, ChevronDown, Info, Route, UserRoundCog } from "lucide-react";
import { useTranslations } from "next-intl";
import { INTERVENABLE_RIDE_STATUSES } from "@/types/ride";
import { StatusBadge } from "@/components/badges/status-badge";
import { DetailHeader } from "@/components/detail/detail-parts";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { DetailSkeleton, EmptyState, ErrorState } from "@/components/feedback/states";
import { usePermission } from "@/components/session/permissions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRide } from "@/hooks/queries/rides";
import { useRouter } from "@/i18n/navigation";
import { isServiceError } from "@/lib/service-error";
import { useFormat } from "@/lib/use-format";
import { RideMapCard } from "./ride-map-card";
import {
  RideCancellationCard,
  RideCustomerCard,
  RideDriverCard,
  RideSummaryCard,
} from "./ride-info-cards";
import {
  RideAuditCard,
  RideNotesCard,
  RideSupportCard,
  RideTimelineCard,
} from "./ride-history-cards";
import { RideFareCard, RidePaymentCard } from "./ride-money-cards";
import { useRideActions } from "./ride-actions";

/**
 * Ride detail (§9) — one page, no tabs (a ride is read as a whole): header
 * with the interventions, the map and fare on the left, people / payment /
 * support on the right, then timeline, notes and audit. Parts that belong to
 * another module (payment, support, audit) appear only for roles that may
 * open it. Completed rides are read-only; a ride in progress can't be
 * cancelled or reassigned (safety flow instead).
 */
export function RideDetailView({ id }: { id: string }) {
  const t = useTranslations("rides.detail");
  const router = useRouter();
  const allowed = usePermission();
  const f = useFormat();
  const query = useRide(id);
  const actions = useRideActions();

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError) {
    if (isServiceError(query.error) && query.error.code === "NOT_FOUND") {
      return (
        <EmptyState
          icon={Route}
          title={t("notFound")}
          action={
            <Button variant="outline" size="sm" onClick={() => router.push("/rides")}>
              {t("backToList")}
            </Button>
          }
        />
      );
    }
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  const ride = query.data;
  const canEdit = allowed("rides", "edit");
  const intervenable = INTERVENABLE_RIDE_STATUSES.includes(ride.status);
  const finished =
    ride.status === "COMPLETED" || ride.status === "CANCELLED" || ride.status === "EXPIRED";

  return (
    <>
      <div className="flex flex-col gap-6">
        <DetailHeader
          backHref="/rides"
          backLabel={t("backToList")}
          title={<span className="tabular">{ride.id}</span>}
          subtitle={`${ride.customerName} · ${f.dateTime(ride.scheduledFor ?? ride.bookedAt)}`}
          badges={<StatusBadge kind="ride" value={ride.status} />}
          actions={
            canEdit && intervenable ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    {t("actions.more")}
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onSelect={() => actions.open.reassign(ride)}>
                    <UserRoundCog />
                    {t("actions.reassign")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => actions.open.cancel(ride)}
                  >
                    <Ban />
                    {t("actions.cancel")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : undefined
          }
        />

        {finished ? (
          <InlineAlert tone="info">
            <span className="flex items-center gap-2">
              <Info aria-hidden className="size-4 shrink-0" />
              {t("readOnly")}
            </span>
          </InlineAlert>
        ) : (
          !intervenable && canEdit && <InlineAlert tone="info">{t("duringTrip")}</InlineAlert>
        )}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <RideMapCard ride={ride} />
            <RideFareCard ride={ride} />
            <RideTimelineCard ride={ride} />
            <RideNotesCard ride={ride} />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <RideSummaryCard ride={ride} />
            <RideCancellationCard ride={ride} />
            <RideCustomerCard ride={ride} />
            <RideDriverCard ride={ride} />
            {allowed("payments", "view") && <RidePaymentCard ride={ride} />}
            {allowed("support", "view") && <RideSupportCard ride={ride} />}
            {allowed("audit", "view") && <RideAuditCard ride={ride} />}
          </div>
        </div>
        {actions.dialogs}
      </div>
    </>
  );
}
