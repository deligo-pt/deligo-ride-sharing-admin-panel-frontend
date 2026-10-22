import type { AdminNote, Page } from "@/types/common";
import type {
  ReassignCandidate,
  Ride,
  RideDetail,
  RideListItem,
  RideListParams,
  RideStatus,
  RideTabCounts,
} from "@/types/ride";
import { ACTIVE_RIDE_STATUSES, INTERVENABLE_RIDE_STATUSES } from "@/types/ride";
import { ServiceError } from "@/lib/service-error";
import { maskEmail, maskPhone } from "@/lib/format";
import { commissionRateAt } from "@/mock/derive";
import { fareNet } from "@/mock/fare";
import { inRange, inSet, matchesQuery, paginate, sortRows } from "@/mock/query";
import {
  actor,
  audit,
  authorize,
  backend,
  canView,
  clone,
  makeNote,
  nowIso,
  requireReason,
  seesPersonalData,
  type Backend,
} from "./_shared";

/** Rides — requirements §9. */

const FINISHED: readonly RideStatus[] = ["COMPLETED", "CANCELLED", "EXPIRED"];
const INTERVENABLE = INTERVENABLE_RIDE_STATUSES;

function toListItem({ db }: Backend, ride: Ride): RideListItem {
  return {
    ...ride,
    customerName: db.customers.get(ride.customerId)?.name ?? ride.customerId,
    driverName: ride.driverId ? db.drivers.get(ride.driverId)?.name : undefined,
    fleetName: ride.fleetManagerId ? db.fleets.get(ride.fleetManagerId)?.companyName : undefined,
    vehiclePlate: ride.vehicleId ? db.vehicles.get(ride.vehicleId)?.plate : undefined,
  };
}

function inTab(ride: Ride, tab: RideListParams["tab"]) {
  if (!tab) return true;
  if (tab === "scheduled") return ride.status === "SCHEDULED";
  if (tab === "ongoing") return ACTIVE_RIDE_STATUSES.includes(ride.status);
  if (tab === "completed") return ride.status === "COMPLETED";
  if (tab === "cancelled") return ride.status === "CANCELLED" || ride.status === "EXPIRED";
  return FINISHED.includes(ride.status);
}

/** Rides matching everything except the tab — shared by the list, the counts and the export. */
function filtered(b: Backend, params: Omit<RideListParams, "page" | "pageSize" | "tab">): Ride[] {
  const { db } = b;
  // Narrow by person first through the index — like a backend using a foreign key.
  const source: readonly Ride[] = params.customerId
    ? db.ix.rides.byCustomer.get(params.customerId).map((id) => db.rides.get(id)!)
    : params.driverId
      ? db.ix.rides.byDriver.get(params.driverId).map((id) => db.rides.get(id)!)
      : params.fleetManagerId
        ? db.ix.rides.byFleet.get(params.fleetManagerId).map((id) => db.rides.get(id)!)
        : db.rides.all();
  const q = params.q?.trim();
  return source.filter(
    (r) =>
      (!params.driverId || r.driverId === params.driverId) &&
      (!params.customerId || r.customerId === params.customerId) &&
      (!params.fleetManagerId || r.fleetManagerId === params.fleetManagerId) &&
      inSet(r.status, params.status) &&
      inSet(r.rideType, params.rideType) &&
      inSet(r.payment.status, params.paymentStatus) &&
      inRange(
        r.scheduledFor && r.status === "SCHEDULED" ? r.scheduledFor : r.bookedAt,
        params.from,
        params.to,
      ) &&
      (!q ||
        matchesQuery(
          q,
          r.id,
          r.pickup.address,
          r.dropoff.address,
          db.customers.get(r.customerId)?.name,
          r.driverId ? db.drivers.get(r.driverId)?.name : undefined,
          r.vehicleId ? db.vehicles.get(r.vehicleId)?.plate : undefined,
        )),
  );
}

function sortedRides(rows: Ride[], params: Pick<RideListParams, "sort" | "tab">) {
  return sortRows(
    rows,
    params.sort,
    {
      bookedAt: (r) => r.bookedAt,
      scheduledFor: (r) => r.scheduledFor,
      estimatedFareCents: (r) => r.estimatedFareCents,
      finalFareCents: (r) => r.finalFareCents,
      distanceKm: (r) => r.distanceKm,
    },
    params.tab === "scheduled" ? "scheduledFor:asc" : "bookedAt:desc",
  );
}

/**
 * Filtering uses booking time for `from`/`to` (scheduled time for scheduled rides).
 * Sort fields: bookedAt, scheduledFor, estimatedFareCents, finalFareCents, distanceKm.
 * // API: GET /admin/rides
 */
export async function listRides(params: RideListParams): Promise<Page<RideListItem>> {
  const b = await backend();
  authorize("rides", "view");
  const rows = filtered(b, params).filter((r) => inTab(r, params.tab));
  const page = paginate(sortedRides(rows, params), params.page, params.pageSize);
  return { ...page, items: page.items.map((r) => toListItem(b, r)) };
}

/** The count behind each tab header, for the current filters (the status filter is ignored: tabs are the status split). // API: GET /admin/rides/counts (❌) */
export async function getRideTabCounts(
  params: Omit<RideListParams, "page" | "pageSize" | "tab" | "status" | "sort">,
): Promise<RideTabCounts> {
  const b = await backend();
  authorize("rides", "view");
  const rows = filtered(b, params);
  const counts: RideTabCounts = {
    all: rows.length,
    ongoing: 0,
    scheduled: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const r of rows) {
    if (inTab(r, "ongoing")) counts.ongoing++;
    else if (inTab(r, "scheduled")) counts.scheduled++;
    else if (inTab(r, "completed")) counts.completed++;
    else if (inTab(r, "cancelled")) counts.cancelled++;
  }
  return counts;
}

/** Every ride matching the filters, for CSV/Excel. Exporting rides (names, addresses) is audited (§23). // API: GET /admin/rides/export (❌) */
export async function exportRides(
  params: Omit<RideListParams, "page" | "pageSize">,
): Promise<RideListItem[]> {
  authorize("rides", "export");
  const b = await backend();
  const rows = sortedRides(
    filtered(b, params).filter((r) => inTab(r, params.tab)),
    params,
  );
  audit(b, {
    action: "ride.export",
    resourceType: "ride",
    resourceId: "list",
    after: { rows: rows.length, filters: { ...params } },
  });
  return clone(rows.map((r) => toListItem(b, r)));
}

/**
 * The whole ride in one call (§9). Parts that come from other modules are
 * left out for roles that may not open them (tickets and incidents →
 * `support`, payment → `payments`, invoice → `invoices`, commission →
 * `commission`, audit trail → `audit`); contact details are masked without
 * `rides.sensitive`.
 * // API: GET /admin/rides/:id (❌ detail with timeline)
 */
export async function getRide(id: string): Promise<RideDetail> {
  const b = await backend();
  authorize("rides", "view");
  const { db } = b;
  const ride = db.rides.require(id);
  const customer = db.customers.require(ride.customerId);
  const driver = ride.driverId ? db.drivers.get(ride.driverId) : undefined;
  const vehicle = ride.vehicleId ? db.vehicles.get(ride.vehicleId) : undefined;
  const invoiceId = db.ix.rides.invoiceByRide.get(id);
  const unmasked = seesPersonalData("rides");
  let commission: RideDetail["commission"];
  if (canView("commission") && ride.status === "COMPLETED" && ride.completedAt) {
    const net = fareNet(ride.fareBreakdown);
    const rate = commissionRateAt(
      db.commissionRules.all(),
      ride.rideType,
      Date.parse(ride.completedAt),
    );
    const commissionCents = Math.round(net * rate);
    commission = {
      rideId: id,
      fareNetCents: net,
      rate,
      commissionCents,
      driverEarningsCents: net - commissionCents,
    };
  }
  const feeRule = db.pricingRules
    .all()
    .find((r) => r.status === "ACTIVE" && r.category === ride.rideType && !r.zoneId);
  const detail: RideDetail = {
    ...toListItem(b, ride),
    customer: {
      id: customer.id,
      name: customer.name,
      phone: unmasked ? customer.phone : maskPhone(customer.phone),
      email: unmasked ? customer.email : maskEmail(customer.email),
      status: customer.status,
    },
    driver: driver && {
      id: driver.id,
      name: driver.name,
      phone: unmasked ? driver.phone : maskPhone(driver.phone),
      photoUrl: driver.photoUrl,
      rating: driver.rating,
    },
    vehicle: vehicle && {
      id: vehicle.id,
      plate: vehicle.plate,
      make: vehicle.make,
      model: vehicle.model,
      colour: vehicle.colour,
      category: vehicle.category,
    },
    paymentRecord:
      canView("payments") && ride.payment.paymentId
        ? db.payments.get(ride.payment.paymentId)
        : undefined,
    invoice: canView("invoices") && invoiceId ? db.invoices.get(invoiceId) : undefined,
    commission,
    cancelFeeCents:
      ride.driverId && ["ACCEPTED", "DRIVER_ARRIVING", "DRIVER_ARRIVED"].includes(ride.status)
        ? (feeRule?.cancellationFee ?? 0)
        : 0,
    tickets: canView("support")
      ? db.ix.support.ticketsByRide.get(id).map((t) => db.tickets.get(t)!)
      : [],
    incidents: canView("support")
      ? db.ix.support.incidentsByRide.get(id).map((i) => db.incidents.get(i)!)
      : [],
    auditTrail: canView("audit")
      ? db.audit.all().filter((a) => a.resourceType === "ride" && a.resourceId === id)
      : [],
  };
  return clone(detail);
}

/**
 * Admin cancellation — only before the trip starts; completed rides are never
 * changed (§9). `chargeFee` = the customer pays the cancellation fee of the
 * active tariff (only once a driver is on the way; otherwise there is none).
 * The ride keeps its history: the cancellation and its reason go on the
 * timeline and in the audit log.
 * // API: POST /admin/rides/:id/cancel
 */
export async function cancelRide(
  id: string,
  reason: string,
  chargeFee = false,
): Promise<RideListItem> {
  const b = await backend();
  authorize("rides", "edit");
  const text = requireReason(reason);
  const current = b.db.rides.require(id);
  if (!INTERVENABLE.includes(current.status)) {
    throw new ServiceError("CONFLICT", `Cannot cancel a ride that is ${current.status}`);
  }
  const rule = b.db.pricingRules
    .all()
    .find((r) => r.status === "ACTIVE" && r.category === current.rideType && !r.zoneId);
  const feeCents =
    chargeFee && current.driverId && current.status !== "SCHEDULED"
      ? (rule?.cancellationFee ?? 0)
      : 0;
  const at = nowIso();
  const who = actor();
  const next = b.db.rides.update(id, (r) => ({
    ...r,
    status: "CANCELLED",
    cancellation: { by: "ADMIN", reason: "ADMIN_INTERVENTION", note: text, feeCents, at },
    finalFareCents: feeCents || undefined,
    payment: {
      ...r.payment,
      status: feeCents > 0 ? "PENDING" : r.payment.paymentId ? r.payment.status : "NOT_CHARGED",
    },
    lastLocation: undefined,
    timeline: [...r.timeline, { status: "CANCELLED", at, by: who.id, reason: text }],
  }));
  audit(b, {
    action: "ride.cancel",
    resourceType: "ride",
    resourceId: id,
    before: { status: current.status },
    after: { status: "CANCELLED", feeCents },
    reason: text,
  });
  return clone(toListItem(b, next));
}

/**
 * Give the ride to another driver — before pickup only. The new driver must
 * be approved, active, online, free, and drive a vehicle of the ride's category.
 * // API: POST /admin/rides/:id/reassign (❌)
 */
export async function reassignRide(
  id: string,
  driverId: string,
  reason: string,
): Promise<RideListItem> {
  const b = await backend();
  authorize("rides", "edit");
  const { db } = b;
  const text = requireReason(reason);
  const current = db.rides.require(id);
  if (!INTERVENABLE.includes(current.status))
    throw new ServiceError("CONFLICT", `Cannot reassign a ride that is ${current.status}`);
  if (current.driverId === driverId)
    throw new ServiceError("VALIDATION", "Ride already has this driver", "driverId");
  const driver = db.drivers.require(driverId);
  const vehicle = driver.vehicleId ? db.vehicles.get(driver.vehicleId) : undefined;
  if (driver.verification !== "APPROVED" || driver.accountStatus !== "ACTIVE" || !driver.online) {
    throw new ServiceError("CONFLICT", "Driver is not available", "driverId");
  }
  if (!vehicle || vehicle.operational !== "ACTIVE" || vehicle.category !== current.rideType) {
    throw new ServiceError("CONFLICT", "Driver's vehicle cannot serve this ride type", "driverId");
  }
  const busy = db.ix.rides.byDriver
    .get(driverId)
    .some((r) => ACTIVE_RIDE_STATUSES.includes(db.rides.get(r)?.status ?? "COMPLETED"));
  if (busy) throw new ServiceError("CONFLICT", "Driver is on another ride", "driverId");

  const at = nowIso();
  const who = actor();
  const status: RideStatus = current.status === "SCHEDULED" ? "SCHEDULED" : "ACCEPTED";
  db.ix.rides.byDriver.remove(current.driverId, id);
  db.ix.rides.byDriver.add(driverId, id);
  db.ix.rides.byFleet.remove(current.fleetManagerId, id);
  db.ix.rides.byFleet.add(driver.fleetManagerId, id);
  const next = db.rides.update(id, (r) => ({
    ...r,
    driverId,
    vehicleId: vehicle.id,
    fleetManagerId: driver.fleetManagerId,
    status,
    lastLocation: driver.location,
    timeline: [
      ...r.timeline,
      { status, at, by: who.id, reason: `Reassigned to ${driverId}: ${text}` },
    ],
  }));
  audit(b, {
    action: "ride.reassign",
    resourceType: "ride",
    resourceId: id,
    before: { driverId: current.driverId ?? null },
    after: { driverId },
    reason: text,
  });
  return clone(toListItem(b, next));
}

/** // API: POST /admin/rides/:id/notes (❌) */
export async function addRideNote(id: string, text: string): Promise<AdminNote> {
  const b = await backend();
  authorize("rides", "edit");
  const note = makeNote(b, text);
  b.db.rides.update(id, (r) => ({ ...r, notes: [note, ...r.notes] }));
  audit(b, { action: "ride.add_note", resourceType: "ride", resourceId: id });
  return clone(note);
}

/**
 * Drivers who could take a ride (for the reassign picker): approved, online,
 * free, same category, nearest first.
 * // API: GET /admin/rides/:id/candidates (❌)
 */
export async function listReassignCandidates(id: string): Promise<ReassignCandidate[]> {
  const b = await backend();
  authorize("rides", "edit");
  const { db } = b;
  const ride = db.rides.require(id);
  return db.drivers
    .all()
    .filter((d) => {
      if (
        d.id === ride.driverId ||
        !d.online ||
        d.accountStatus !== "ACTIVE" ||
        d.verification !== "APPROVED"
      )
        return false;
      const v = d.vehicleId ? db.vehicles.get(d.vehicleId) : undefined;
      if (
        !v ||
        v.operational !== "ACTIVE" ||
        v.category !== ride.rideType ||
        d.city !== ride.pickup.city
      )
        return false;
      return !db.ix.rides.byDriver
        .get(d.id)
        .some((r) => ACTIVE_RIDE_STATUSES.includes(db.rides.get(r)?.status ?? "COMPLETED"));
    })
    .map((d) => ({
      id: d.id,
      name: d.name,
      rating: d.rating,
      distanceKm: d.location
        ? Math.round(
            Math.hypot(
              (d.location.lat - ride.pickup.lat) * 111,
              (d.location.lng - ride.pickup.lng) * 85,
            ) * 10,
          ) / 10
        : null,
    }))
    .sort((a, b2) => (a.distanceKm ?? 99) - (b2.distanceKm ?? 99))
    .slice(0, 20);
}
