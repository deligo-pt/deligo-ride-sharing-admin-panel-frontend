import type { AdminNote, Cents, DateRange, GeoPoint, ISODate, ListParams, Place, StatusChange } from "./common";
import type { AuditLog } from "./audit";
import type { RideCommission } from "./finance";
import type { Invoice } from "./invoice";
import type { Payment, PaymentMethod, PaymentStatus } from "./payment";
import type { SafetyIncident, Ticket } from "./support";
import type { RideCategory } from "./vehicle";

/**
 * Union of the backend enum and requirements §9 so every state can be shown.
 * SEARCHING, DRIVER_ARRIVING and EXPIRED are not in the backend yet (Appendix B #3).
 */
export type RideStatus =
  | "SCHEDULED"
  | "REQUESTED"
  | "SEARCHING"
  | "ACCEPTED"
  | "DRIVER_ARRIVING"
  | "DRIVER_ARRIVED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED"
  | "EMERGENCY";

/** Rides happening right now (live map, "ongoing" tab). */
export const ACTIVE_RIDE_STATUSES: readonly RideStatus[] = [
  "REQUESTED",
  "SEARCHING",
  "ACCEPTED",
  "DRIVER_ARRIVING",
  "DRIVER_ARRIVED",
  "IN_PROGRESS",
  "EMERGENCY",
];

/**
 * Before pickup an admin may still reassign or cancel (§9). Completed rides
 * are never changed; during the trip (IN_PROGRESS, EMERGENCY) only the
 * safety flow applies.
 */
export const INTERVENABLE_RIDE_STATUSES: readonly RideStatus[] = ["SCHEDULED", "REQUESTED", "SEARCHING", "ACCEPTED", "DRIVER_ARRIVING", "DRIVER_ARRIVED"];

/** A ride that was never charged (cancelled free, expired) has no payment. */
export type RidePaymentStatus = PaymentStatus | "NOT_CHARGED";

export type CancellationReason =
  | "CUSTOMER_CHANGED_MIND"
  | "CUSTOMER_NO_SHOW"
  | "DRIVER_TOO_FAR"
  | "DRIVER_NO_SHOW"
  | "DRIVER_REQUESTED"
  | "VEHICLE_ISSUE"
  | "SAFETY_CONCERN"
  | "ADMIN_INTERVENTION";

/** All amounts in cents. `total` = sum of the lines + vat − discount. */
export type FareBreakdown = {
  base: Cents;
  distance: Cents;
  time: Cents;
  waiting: Cents;
  booking: Cents;
  /** Flat surcharge of a SURCHARGE zone (airport) at pickup or drop-off. */
  zone: Cents;
  surge: Cents;
  discount: Cents;
  /** VAT rate as a fraction (0.06 = 6%, the PT rate for passenger transport). */
  vatRate: number;
  vat: Cents;
  total: Cents;
};

export type Ride = {
  id: string;
  customerId: string;
  driverId?: string;
  vehicleId?: string;
  fleetManagerId?: string;
  pickup: Place;
  dropoff: Place;
  stops: Place[];
  bookedAt: ISODate;
  scheduledFor?: ISODate;
  startedAt?: ISODate;
  completedAt?: ISODate;
  rideType: RideCategory;
  /** Fare quoted at booking. */
  estimatedFareCents: Cents;
  /** Charged fare — only once completed (or the cancellation fee). */
  finalFareCents?: Cents;
  fareBreakdown: FareBreakdown;
  surgeMultiplier: number;
  promotionId?: string;
  payment: { method: PaymentMethod; status: RidePaymentStatus; paymentId?: string };
  status: RideStatus;
  timeline: StatusChange<RideStatus>[];
  cancellation?: {
    by: "CUSTOMER" | "DRIVER" | "ADMIN" | "SYSTEM";
    reason: CancellationReason;
    note?: string;
    feeCents: Cents;
    at: ISODate;
  };
  distanceKm: number;
  durationMin: number;
  /** Customer's rating of the driver, 1–5. */
  rating?: number;
  /** Driver's last reported position (active rides). */
  lastLocation?: GeoPoint & { at: ISODate };
  notes: AdminNote[];
};

/** A ride row with the names the table shows (joined like a backend would). */
export type RideListItem = Ride & {
  customerName: string;
  driverName?: string;
  fleetName?: string;
  vehiclePlate?: string;
};

export type RideListParams = ListParams &
  DateRange & {
    status?: RideStatus[];
    rideType?: RideCategory[];
    paymentStatus?: RidePaymentStatus[];
    customerId?: string;
    driverId?: string;
    fleetManagerId?: string;
    /**
     * Shortcut tabs (§9 "view scheduled and ongoing rides separately"):
     * scheduled (future), ongoing (active), completed, cancelled (cancelled
     * and expired), past (all finished).
     */
    tab?: "scheduled" | "ongoing" | "completed" | "cancelled" | "past";
  };

/** How many rides each tab holds for the current filters (the tab headers show them). */
export type RideTabCounts = { all: number; ongoing: number; scheduled: number; completed: number; cancelled: number };

/** Everything the ride detail page shows (§9 "Ride details"), joined in one call. */
export type RideDetail = RideListItem & {
  customer: { id: string; name: string; phone: string; email: string; status: string };
  driver?: { id: string; name: string; phone: string; photoUrl: string; rating: number };
  vehicle?: { id: string; plate: string; make: string; model: string; colour: string; category: RideCategory };
  paymentRecord?: Payment;
  invoice?: Invoice;
  commission?: RideCommission;
  /** Fee the customer would be charged if an admin cancels now and doesn't waive it (needs an assigned driver). */
  cancelFeeCents: Cents;
  /** The next four are left empty for roles that may not open the module they come from. */
  tickets: Ticket[];
  incidents: SafetyIncident[];
  auditTrail: AuditLog[];
};

/** A driver who could take over a ride (reassign picker). */
export type ReassignCandidate = { id: string; name: string; rating: number; distanceKm: number | null };
