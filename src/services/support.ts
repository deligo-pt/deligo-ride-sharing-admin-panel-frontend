import type { AdminNote, Page } from "@/types/common";
import type {
  IncidentListItem,
  IncidentListParams,
  SafetyIncident,
  Ticket,
  TicketEvent,
  TicketListItem,
  TicketListParams,
  TicketPriority,
  TicketStatus,
} from "@/types/support";
import { ServiceError } from "@/lib/service-error";
import { inRange, inSet, matchesQuery, paginate, sortRows } from "@/mock/query";
import { actor, assertState, audit, authorize, backend, clone, makeNote, nowIso, requireReason, requireText, type Backend } from "./_shared";

/** Complaints, support & safety incidents — requirements §15. Every action lands in the ticket history. */

const PRIORITY_RANK: Record<TicketPriority, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

/** Allowed status moves (closing needs a resolution first). */
const NEXT_STATUS: Record<TicketStatus, readonly TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "ESCALATED"],
  IN_PROGRESS: ["OPEN", "ESCALATED", "RESOLVED"],
  ESCALATED: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: [],
};

function withNames({ db }: Backend, t: Ticket): TicketListItem {
  return {
    ...t,
    customerName: t.customerId ? db.customers.get(t.customerId)?.name : undefined,
    driverName: t.driverId ? db.drivers.get(t.driverId)?.name : undefined,
    assigneeName: t.assigneeId ? db.admins.get(t.assigneeId)?.name : undefined,
  };
}

function event(b: Backend, type: TicketEvent["type"], detail?: string): TicketEvent {
  const who = actor();
  return { id: `EVT-${b.seq.ticketEvent.take()}`, type, at: nowIso(), by: who.id, byName: who.name, detail };
}

/** Apply a change, append history and bump `updatedAt`. */
function change(b: Backend, id: string, patch: Partial<Ticket>, ev: TicketEvent) {
  return b.db.tickets.update(id, (t) => ({ ...t, ...patch, updatedAt: ev.at, history: [...t.history, ev] }));
}

/**
 * Sort fields: createdAt, updatedAt, priority.
 * // API: GET /admin/support/tickets
 */
export async function listTickets(params: TicketListParams): Promise<Page<TicketListItem>> {
  const b = await backend();
  authorize("support", "view");
  const { db } = b;
  const rows = db.tickets.all().filter(
    (t) =>
      inSet(t.status, params.status) &&
      inSet(t.priority, params.priority) &&
      inSet(t.category, params.category) &&
      (!params.assigneeId || (params.assigneeId === "UNASSIGNED" ? !t.assigneeId : t.assigneeId === params.assigneeId)) &&
      (!params.rideId || t.rideId === params.rideId) &&
      (!params.customerId || t.customerId === params.customerId) &&
      (!params.driverId || t.driverId === params.driverId) &&
      inRange(t.createdAt, params.from, params.to) &&
      matchesQuery(params.q, t.id, t.subject, t.description, t.rideId, t.customerId ? db.customers.get(t.customerId)?.name : undefined),
  );
  const sorted = sortRows(
    rows,
    params.sort,
    { createdAt: (t) => t.createdAt, updatedAt: (t) => t.updatedAt, priority: (t) => PRIORITY_RANK[t.priority] },
    "createdAt:desc",
  );
  const page = paginate(sorted, params.page, params.pageSize);
  return { ...page, items: page.items.map((t) => withNames(b, t)) };
}

/** // API: GET /admin/support/tickets/:id */
export async function getTicket(id: string): Promise<TicketListItem> {
  const b = await backend();
  return clone(withNames(b, b.db.tickets.require(id)));
}

/** Assign to an active admin (support agents usually). // API: PATCH /admin/support/tickets/:id (❌ assignment) */
export async function assignTicket(id: string, adminId: string): Promise<TicketListItem> {
  const b = await backend();
  const current = b.db.tickets.require(id);
  assertState(current.status, ["OPEN", "IN_PROGRESS", "ESCALATED"], "assign");
  const admin = b.db.admins.require(adminId);
  if (admin.status !== "ACTIVE") throw new ServiceError("CONFLICT", "Admin is not active", "adminId");
  const next = change(b, id, { assigneeId: adminId }, event(b, "ASSIGNED", adminId));
  audit(b, { action: "ticket.assign", resourceType: "ticket", resourceId: id, before: { assigneeId: current.assigneeId ?? null }, after: { assigneeId: adminId } });
  return clone(withNames(b, next));
}

/** Move through the allowed statuses. Use `resolveTicket` to resolve (it needs the outcome). // API: PATCH /admin/support/tickets/:id */
export async function updateTicketStatus(id: string, status: TicketStatus): Promise<TicketListItem> {
  const b = await backend();
  const current = b.db.tickets.require(id);
  if (!NEXT_STATUS[current.status].includes(status) || status === "RESOLVED") {
    throw new ServiceError("CONFLICT", `Cannot move a ${current.status} ticket to ${status}`);
  }
  const next = change(b, id, { status }, event(b, "STATUS", status));
  audit(b, { action: "ticket.update_status", resourceType: "ticket", resourceId: id, before: { status: current.status }, after: { status } });
  return clone(withNames(b, next));
}

/** // API: PATCH /admin/support/tickets/:id */
export async function setTicketPriority(id: string, priority: TicketPriority): Promise<TicketListItem> {
  const b = await backend();
  const current = b.db.tickets.require(id);
  if (current.priority === priority) return clone(withNames(b, current));
  const next = change(b, id, { priority }, event(b, "PRIORITY", priority));
  audit(b, { action: "ticket.set_priority", resourceType: "ticket", resourceId: id, before: { priority: current.priority }, after: { priority } });
  return clone(withNames(b, next));
}

/** Internal note — never shown to the customer. // API: POST /admin/support/tickets/:id/notes (❌) */
export async function addTicketNote(id: string, text: string): Promise<AdminNote> {
  const b = await backend();
  const note = makeNote(b, text);
  b.db.tickets.update(id, (t) => {
    const ev = event(b, "NOTE");
    return { ...t, notes: [note, ...t.notes], history: [...t.history, ev], updatedAt: ev.at };
  });
  audit(b, { action: "ticket.add_note", resourceType: "ticket", resourceId: id });
  return clone(note);
}

/** Serious cases go to the safety team; priority is raised to at least HIGH. // API: POST /admin/support/tickets/:id/escalate (❌) */
export async function escalateTicket(id: string, reason: string): Promise<TicketListItem> {
  const b = await backend();
  const text = requireReason(reason);
  const current = b.db.tickets.require(id);
  assertState(current.status, ["OPEN", "IN_PROGRESS"], "escalate");
  const priority = PRIORITY_RANK[current.priority] < PRIORITY_RANK.HIGH ? "HIGH" : current.priority;
  const next = change(b, id, { status: "ESCALATED", priority }, event(b, "ESCALATED", text));
  audit(b, { action: "ticket.escalate", resourceType: "ticket", resourceId: id, before: { status: current.status, priority: current.priority }, after: { status: "ESCALATED", priority }, reason: text });
  return clone(withNames(b, next));
}

/** Record the investigation result and resolve. // API: PATCH /admin/support/tickets/:id */
export async function resolveTicket(id: string, resolution: string): Promise<TicketListItem> {
  const b = await backend();
  const text = requireText(resolution, "resolution");
  const current = b.db.tickets.require(id);
  assertState(current.status, ["IN_PROGRESS", "ESCALATED"], "resolve");
  const next = change(b, id, { status: "RESOLVED", resolution: text }, event(b, "RESOLVED", text));
  audit(b, { action: "ticket.resolve", resourceType: "ticket", resourceId: id, before: { status: current.status }, after: { status: "RESOLVED" }, reason: text });
  return clone(withNames(b, next));
}

// ---- Safety incidents (SOS) -------------------------------------------------

function incidentItem({ db }: Backend, i: SafetyIncident): IncidentListItem {
  return {
    ...i,
    customerName: db.customers.get(i.customerId)?.name ?? i.customerId,
    driverName: i.driverId ? db.drivers.get(i.driverId)?.name : undefined,
  };
}

/** Active first, then newest. // API: GET /safety/sos (✅ active only) */
export async function listIncidents(params: IncidentListParams): Promise<Page<IncidentListItem>> {
  const b = await backend();
  authorize("support", "view");
  const rows = b.db.incidents
    .all()
    .filter(
      (i) =>
        inSet(i.status, params.status) &&
        (!params.driverId || i.driverId === params.driverId) &&
        (!params.customerId || i.customerId === params.customerId) &&
        inRange(i.raisedAt, params.from, params.to) &&
        matchesQuery(params.q, i.id, i.rideId, i.location.address),
    )
    .sort((a, c) => Number(c.status === "ACTIVE") - Number(a.status === "ACTIVE") || c.raisedAt.localeCompare(a.raisedAt));
  const page = paginate(rows, params.page, params.pageSize);
  return { ...page, items: page.items.map((i) => incidentItem(b, i)) };
}

/**
 * Opening an incident is itself audited — the information is sensitive (§15).
 * // API: GET /safety/sos/:id
 */
export async function getIncident(id: string): Promise<IncidentListItem> {
  const b = await backend();
  const incident = b.db.incidents.require(id);
  audit(b, { action: "incident.view", resourceType: "incident", resourceId: id });
  return clone(incidentItem(b, incident));
}

/** Hand over to 112, the police (PSP) or the safety team. // API: POST /safety/sos/:id/escalate (❌) */
export async function escalateIncident(id: string, to: NonNullable<SafetyIncident["escalatedTo"]>, reason: string): Promise<IncidentListItem> {
  const b = await backend();
  const text = requireReason(reason);
  const current = b.db.incidents.require(id);
  assertState(current.status, ["ACTIVE"], "escalate");
  const next = b.db.incidents.update(id, (i) => ({
    ...i,
    escalatedTo: to,
    timeline: [...i.timeline, { status: "ESCALATED", at: nowIso(), by: actor().id, reason: `${to}: ${text}` }],
  }));
  audit(b, { action: "incident.escalate", resourceType: "incident", resourceId: id, before: { escalatedTo: current.escalatedTo ?? null }, after: { escalatedTo: to }, reason: text });
  return clone(incidentItem(b, next));
}

/**
 * Close the SOS. Resolving the incident also ends the EMERGENCY state of its
 * ride (back to IN_PROGRESS so the trip can finish).
 * // API: PATCH /safety/sos/:id/resolve
 */
export async function resolveIncident(id: string, outcome: "RESOLVED" | "FALSE_ALARM", note: string): Promise<IncidentListItem> {
  const b = await backend();
  const text = requireReason(note);
  const current = b.db.incidents.require(id);
  assertState(current.status, ["ACTIVE"], "resolve");
  const at = nowIso();
  const who = actor();
  const next = b.db.incidents.update(id, (i) => ({
    ...i,
    status: outcome,
    resolvedAt: at,
    resolvedBy: who.id,
    outcome: text,
    timeline: [...i.timeline, { status: outcome, at, by: who.id, reason: text }],
  }));
  const ride = b.db.rides.get(current.rideId);
  if (ride?.status === "EMERGENCY") {
    b.db.rides.update(ride.id, (r) => ({ ...r, status: "IN_PROGRESS", timeline: [...r.timeline, { status: "IN_PROGRESS", at, by: who.id, reason: `SOS ${id} closed` }] }));
  }
  audit(b, { action: "incident.resolve", resourceType: "incident", resourceId: id, before: { status: "ACTIVE" }, after: { status: outcome }, reason: text });
  return clone(incidentItem(b, next));
}
