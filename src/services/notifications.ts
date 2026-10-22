import type { Page } from "@/types/common";
import type { Notification, NotificationInput, NotificationListParams } from "@/types/notification";
import { ServiceError } from "@/lib/service-error";
import { COUNTS } from "@/mock/ids";
import { inRange, inSet, matchesQuery, normalize, paginate, sortRows } from "@/mock/query";
import { actor, assertState, audit, backend, clone, diff, nowIso, requireReason, type Backend } from "./_shared";

/** Notifications & announcements — requirements §16. */

const DUPLICATE_WINDOW_MS = 24 * 3_600_000;

/** Rough audience size for the confirm dialog. */
function estimateRecipients({ db }: Backend, input: NotificationInput) {
  if (input.audience === "CUSTOMERS") return db.customers.all().filter((c) => c.status === "ACTIVE").length;
  if (input.audience === "DRIVERS") return db.drivers.all().filter((d) => d.accountStatus === "ACTIVE" && d.verification === "APPROVED").length;
  if (input.audience === "FLEET_MANAGERS") return db.fleets.all().filter((f) => f.verification === "APPROVED").length;
  return Math.round(COUNTS.customers * 0.15);
}

function validate(input: NotificationInput) {
  for (const lang of ["pt", "en"] as const) {
    if (!input.title[lang].trim()) throw new ServiceError("VALIDATION", "Title is required in both languages", `title.${lang}`);
    if (!input.body[lang].trim()) throw new ServiceError("VALIDATION", "Message is required in both languages", `body.${lang}`);
    if (input.title[lang].length > 65) throw new ServiceError("VALIDATION", "Title: at most 65 characters", `title.${lang}`);
  }
  if (!input.channels.length) throw new ServiceError("VALIDATION", "Pick at least one channel", "channels");
  if (input.audience === "SEGMENT" && !input.segment) throw new ServiceError("VALIDATION", "Pick a segment", "segment");
  if (input.scheduledFor && Date.parse(input.scheduledFor) < Date.now()) throw new ServiceError("VALIDATION", "Schedule time must be in the future", "scheduledFor");
}

/**
 * Sort fields: createdAt, sentAt, scheduledFor, recipients.
 * // API: GET /admin/notifications (❌ history)
 */
export async function listNotifications(params: NotificationListParams): Promise<Page<Notification>> {
  const { db } = await backend();
  const rows = db.notifications.all().filter(
    (n) =>
      inSet(n.status, params.status) &&
      inSet(n.audience, params.audience) &&
      (!params.channel?.length || n.channels.some((c) => params.channel!.includes(c))) &&
      inRange(n.createdAt, params.from, params.to) &&
      matchesQuery(params.q, n.id, n.title.pt, n.title.en, n.body.pt, n.body.en),
  );
  const sorted = sortRows(
    rows,
    params.sort,
    { createdAt: (n) => n.createdAt, sentAt: (n) => n.sentAt, scheduledFor: (n) => n.scheduledFor, recipients: (n) => n.recipients },
    "createdAt:desc",
  );
  return paginate(sorted, params.page, params.pageSize);
}

/** // API: GET /admin/notifications/:id (❌) */
export async function getNotification(id: string): Promise<Notification> {
  const { db } = await backend();
  return clone(db.notifications.require(id));
}

/** Saved as DRAFT; `scheduledFor` makes it SCHEDULED. // API: POST /admin/notifications (❌) */
export async function createNotification(input: NotificationInput): Promise<Notification> {
  const b = await backend();
  validate(input);
  const row = b.db.notifications.insert({
    ...input,
    id: `NTF-${b.seq.notification.take()}`,
    status: input.scheduledFor ? "SCHEDULED" : "DRAFT",
    recipients: estimateRecipients(b, input),
    delivery: { sent: 0, delivered: 0, failed: 0, opened: 0 },
    createdAt: nowIso(),
    createdBy: actor().id,
  });
  audit(b, { action: "notification.create", resourceType: "notification", resourceId: row.id, after: { audience: row.audience, status: row.status } });
  return clone(row);
}

/** // API: PATCH /admin/notifications/:id (❌) */
export async function updateNotification(id: string, input: NotificationInput): Promise<Notification> {
  const b = await backend();
  const current = b.db.notifications.require(id);
  assertState(current.status, ["DRAFT", "SCHEDULED"], "edit");
  validate(input);
  const next = b.db.notifications.update(id, { ...input, status: input.scheduledFor ? "SCHEDULED" : "DRAFT", recipients: estimateRecipients(b, input) });
  audit(b, { action: "notification.update", resourceType: "notification", resourceId: id, ...diff(current, next) });
  return clone(next);
}

/**
 * A sent notification with the same audience and title in the last 24 h —
 * the screen asks "send anyway?" (§16: avoid unintentional duplicates).
 * // API: GET /admin/notifications/:id/duplicates (❌)
 */
export async function findDuplicateNotification(id: string): Promise<Notification | null> {
  const { db } = await backend();
  const n = db.notifications.require(id);
  const dupe = db.notifications
    .all()
    .find(
      (o) =>
        o.id !== n.id &&
        o.status === "SENT" &&
        o.audience === n.audience &&
        normalize(o.title.pt) === normalize(n.title.pt) &&
        Date.now() - Date.parse(o.sentAt ?? o.createdAt) < DUPLICATE_WINDOW_MS,
    );
  return dupe ? clone(dupe) : null;
}

/**
 * Send now. Refuses a duplicate unless `force` (the admin confirmed).
 * Delivery numbers are simulated (~97% delivered).
 * // API: POST /admin/notifications/broadcast (✅)
 */
export async function sendNotification(id: string, options: { force?: boolean } = {}): Promise<Notification> {
  const b = await backend();
  const current = b.db.notifications.require(id);
  assertState(current.status, ["DRAFT", "SCHEDULED"], "send");
  if (!options.force) {
    const dupe = b.db.notifications.all().find(
      (o) => o.id !== id && o.status === "SENT" && o.audience === current.audience && normalize(o.title.pt) === normalize(current.title.pt) && Date.now() - Date.parse(o.sentAt ?? o.createdAt) < DUPLICATE_WINDOW_MS,
    );
    if (dupe) throw new ServiceError("CONFLICT", `Same announcement already sent (${dupe.id})`);
  }
  const sent = current.recipients * current.channels.length;
  const failed = Math.round(sent * 0.03);
  const next = b.db.notifications.update(id, {
    status: "SENT",
    sentAt: nowIso(),
    scheduledFor: undefined,
    delivery: { sent, delivered: sent - failed, failed, opened: 0 },
  });
  audit(b, { action: "notification.send", resourceType: "notification", resourceId: id, before: { status: current.status }, after: { status: "SENT", recipients: current.recipients } });
  return clone(next);
}

/** Cancel a scheduled notification. // API: POST /admin/notifications/:id/cancel (❌) */
export async function cancelNotification(id: string, reason: string): Promise<Notification> {
  const b = await backend();
  const text = requireReason(reason);
  const current = b.db.notifications.require(id);
  assertState(current.status, ["SCHEDULED", "DRAFT"], "cancel");
  const next = b.db.notifications.update(id, { status: "CANCELLED" });
  audit(b, { action: "notification.cancel", resourceType: "notification", resourceId: id, before: { status: current.status }, after: { status: "CANCELLED" }, reason: text });
  return clone(next);
}
