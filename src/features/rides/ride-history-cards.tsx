"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { RideDetail } from "@/types/ride";
import { StatusBadge } from "@/components/badges/status-badge";
import { Timeline } from "@/components/detail/detail-parts";
import { NotesCard } from "@/components/detail/notes-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { qk } from "@/lib/query-keys";
import { isServiceError } from "@/lib/service-error";
import { useFormat } from "@/lib/use-format";
import { addRideNote } from "@/services/rides";

const TONE = {
  COMPLETED: "success",
  CANCELLED: "danger",
  EXPIRED: "danger",
  EMERGENCY: "danger",
  IN_PROGRESS: "default",
} as const;

/** Status changes with who caused them and why (§9 "review the ride timeline and status changes"). */
export function RideTimelineCard({ ride }: { ride: RideDetail }) {
  const t = useTranslations("rides.detail");
  const tAll = useTranslations();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-title">{t("sections.timeline")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Timeline
          emptyLabel={t("timelineEmpty")}
          items={[...ride.timeline].reverse().map((entry, i) => ({
            id: `${entry.at}-${i}`,
            title: tAll(`status.ride.${entry.status}`),
            at: entry.at,
            by: entry.by,
            description: entry.reason,
            tone: TONE[entry.status as keyof typeof TONE] ?? "default",
          }))}
        />
      </CardContent>
    </Card>
  );
}

/** Support tickets and SOS incidents about this ride (§9). Rows don't open yet — the Support module (P21) adds those pages. */
export function RideSupportCard({ ride }: { ride: RideDetail }) {
  const t = useTranslations("rides.detail.support");
  const tAll = useTranslations();
  const f = useFormat();
  const empty = ride.tickets.length === 0 && ride.incidents.length === 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-title">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {empty && <p className="text-dense text-muted-foreground">{t("none")}</p>}
        {ride.incidents.length > 0 && (
          <section className="flex flex-col gap-2" aria-label={t("incidents")}>
            <h3 className="text-dense font-semibold">{t("incidents")}</h3>
            <ul className="flex flex-col divide-y rounded-lg border">
              {ride.incidents.map((i) => (
                <li key={i.id} className="flex flex-col gap-0.5 px-3 py-2">
                  <span className="flex items-center justify-between gap-2">
                    <span className="tabular text-dense font-medium">{i.id}</span>
                    <StatusBadge kind="incident" value={i.status} />
                  </span>
                  <span className="text-caption">
                    {t(`initiator.${i.initiator}`)} · {f.dateTime(i.raisedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {ride.tickets.length > 0 && (
          <section className="flex flex-col gap-2" aria-label={t("tickets")}>
            <h3 className="text-dense font-semibold">{t("tickets")}</h3>
            <ul className="flex flex-col divide-y rounded-lg border">
              {ride.tickets.map((ticket) => (
                <li key={ticket.id} className="flex flex-col gap-0.5 px-3 py-2">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-dense truncate font-medium">{ticket.subject}</span>
                    <StatusBadge kind="ticket" value={ticket.status} />
                  </span>
                  <span className="text-caption">
                    {ticket.id} · {tAll(`enums.ticketCategory.${ticket.category}`)} ·{" "}
                    {f.dateTime(ticket.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}

/** Internal notes on the ride; adding needs `rides.edit`. */
export function RideNotesCard({ ride }: { ride: RideDetail }) {
  const t = useTranslations("rides.detail.notes");
  const tError = useTranslations("feedback.errors");
  const mutation = useServiceMutation({
    mutationFn: (text: string) => addRideNote(ride.id, text),
    invalidate: [qk.rides.detail(ride.id), qk.audit.all],
    onSuccess: () => toast.success(t("added")),
    onError: (error) => toast.error(tError(isServiceError(error) ? error.code : "UNKNOWN")),
  });
  return (
    <section className="flex flex-col gap-3" aria-label={t("title")}>
      <h2 className="text-card-title">{t("title")}</h2>
      <NotesCard
        module="rides"
        notes={ride.notes}
        placeholder={t("placeholder")}
        addLabel={t("add")}
        emptyLabel={t("empty")}
        onAdd={(text) => mutation.mutateAsync(text)}
      />
    </section>
  );
}

/** Admin actions on this ride (§9 "ride-related audit records"). Needs `audit.view`. */
export function RideAuditCard({ ride }: { ride: RideDetail }) {
  const t = useTranslations("rides.detail.audit");
  const tAll = useTranslations();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-title">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Timeline
          emptyLabel={t("empty")}
          items={ride.auditTrail.map((a) => {
            // Message keys cannot contain "." — "ride.cancel" → "ride_cancel".
            const key = `rides.activityActions.${a.action.replace(".", "_")}`;
            return {
              id: a.id,
              title: tAll.has(key as Parameters<typeof tAll>[0])
                ? tAll(key as Parameters<typeof tAll>[0])
                : a.action,
              at: a.at,
              by: a.adminName,
              description: a.reason,
              tone: /cancel/.test(a.action) ? "danger" : "default",
            };
          })}
        />
      </CardContent>
    </Card>
  );
}
