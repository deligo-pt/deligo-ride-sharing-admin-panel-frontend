import type { AdminNote, DateRange, GeoPoint, ISODate, ListParams, StatusChange } from "./common";

export type TicketCategory =
  | "SAFETY"
  | "COMPLAINT"
  | "LOST_ITEM"
  | "PAYMENT"
  | "DRIVER_BEHAVIOUR"
  | "GENERAL";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "ESCALATED" | "RESOLVED" | "CLOSED";

/** One entry in the ticket's history — every action is kept (§15). */
export type TicketEvent = {
  id: string;
  type: "CREATED" | "ASSIGNED" | "STATUS" | "NOTE" | "ESCALATED" | "RESOLVED" | "PRIORITY";
  at: ISODate;
  by: string;
  byName: string;
  detail?: string;
};

export type Ticket = {
  id: string;
  rideId?: string;
  customerId?: string;
  driverId?: string;
  /** Who opened it. */
  reporter: "CUSTOMER" | "DRIVER" | "ADMIN";
  category: TicketCategory;
  subject: string;
  /** Written by the customer or driver — kept in the language they used. */
  description: string;
  createdAt: ISODate;
  updatedAt: ISODate;
  priority: TicketPriority;
  assigneeId?: string;
  status: TicketStatus;
  resolution?: string;
  notes: AdminNote[];
  history: TicketEvent[];
};

export type TicketListItem = Ticket & {
  customerName?: string;
  driverName?: string;
  assigneeName?: string;
};

export type TicketListParams = ListParams &
  DateRange & {
    status?: TicketStatus[];
    priority?: TicketPriority[];
    category?: TicketCategory[];
    assigneeId?: string | "UNASSIGNED";
    rideId?: string;
    customerId?: string;
    driverId?: string;
  };

export type IncidentStatus = "ACTIVE" | "RESOLVED" | "FALSE_ALARM";

/** SOS raised from the app during a ride. Access is restricted and audited (§15). */
export type SafetyIncident = {
  id: string;
  rideId: string;
  customerId: string;
  driverId?: string;
  initiator: "CUSTOMER" | "DRIVER";
  location: GeoPoint & { address: string };
  raisedAt: ISODate;
  status: IncidentStatus;
  /** "112" (emergency services), "PSP" (police), "SAFETY_TEAM". */
  escalatedTo?: "112" | "PSP" | "SAFETY_TEAM";
  resolvedAt?: ISODate;
  resolvedBy?: string;
  outcome?: string;
  timeline: StatusChange<IncidentStatus | "ESCALATED">[];
};

export type IncidentListItem = SafetyIncident & { customerName: string; driverName?: string };

export type IncidentListParams = ListParams &
  DateRange & { status?: IncidentStatus[]; driverId?: string; customerId?: string };
