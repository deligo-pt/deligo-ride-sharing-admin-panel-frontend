import type { Customer } from "@/types/customer";
import type { Driver } from "@/types/driver";
import type { FleetManager } from "@/types/fleet";
import type { Promotion, PromotionState } from "@/types/promotion";
import type { Vehicle } from "@/types/vehicle";
import type { CustomerRecord, DriverRecord, FleetRecord, PromotionRecord, VehicleRecord } from "@/mock/records";
import { ACTIVE_RIDE_STATUSES } from "@/types/ride";
import { now } from "@/mock/clock";
import {
  MANDATORY_DRIVER_DOCS,
  credentialStatus,
  effectiveDocumentStatus,
  hasValidDocuments,
} from "@/mock/derive";
import type { Backend } from "./_shared";

/**
 * Record → API shape. Counts and statuses a backend computes with a query
 * (total rides, eligibility, credential status) are worked out here from the
 * current rows, so they never drift after a mutation.
 */

const CHARGED = new Set(["SUCCESSFUL", "REFUNDED", "PARTIALLY_REFUNDED"]);

export function toCustomer({ db }: Backend, rec: CustomerRecord): Customer {
  let totalRides = 0;
  let lastRideAt: string | undefined;
  for (const id of db.ix.rides.byCustomer.get(rec.id)) {
    const ride = db.rides.get(id);
    if (!ride) continue;
    if (ride.status === "COMPLETED") totalRides++;
    if (!lastRideAt || ride.bookedAt > lastRideAt) lastRideAt = ride.bookedAt;
  }
  let totalSpentCents = 0;
  let unpaidCents = 0;
  for (const id of db.ix.rides.paymentsByCustomer.get(rec.id)) {
    const p = db.payments.get(id);
    if (!p) continue;
    if (CHARGED.has(p.status)) totalSpentCents += p.amountCents - p.refundedCents;
    if (p.status === "FAILED") unpaidCents += p.amountCents;
  }
  return { ...rec, totalRides, totalSpentCents, unpaidCents, lastRideAt };
}

export function documentsOf({ db }: Backend, ownerId: string) {
  const nowMs = now();
  return db.ix.documents
    .get(ownerId)
    .map((id) => db.documents.get(id))
    .filter((d) => d !== undefined)
    .map((d) => ({
      id: d.id,
      type: d.type,
      status: effectiveDocumentStatus(d.status, d.expiresAt, nowMs),
      expiresAt: d.expiresAt,
    }));
}

export function toDriver(b: Backend, rec: DriverRecord): Driver {
  const { db } = b;
  const nowMs = now();
  let completedRides = 0;
  let cancelledRides = 0;
  let currentRideStatus: Driver["currentRideStatus"];
  for (const id of db.ix.rides.byDriver.get(rec.id)) {
    const ride = db.rides.get(id);
    if (!ride) continue;
    if (ride.status === "COMPLETED") completedRides++;
    else if (ride.status === "CANCELLED") cancelledRides++;
    else if (ACTIVE_RIDE_STATUSES.includes(ride.status)) currentRideStatus = ride.status;
  }
  const documents = documentsOf(b, rec.id);
  const { city: _city, iban: _iban, ...rest } = rec;
  return {
    ...rest,
    licence: { ...rec.licence, status: credentialStatus(rec.licence.expiresAt, nowMs) },
    tvde: { ...rec.tvde, status: credentialStatus(rec.tvde.expiresAt, nowMs) },
    completedRides,
    cancelledRides,
    currentRideStatus,
    documents,
    eligible:
      rec.verification === "APPROVED" &&
      rec.accountStatus === "ACTIVE" &&
      hasValidDocuments(documents, MANDATORY_DRIVER_DOCS, nowMs),
  };
}

export function toFleet(b: Backend, rec: FleetRecord): FleetManager {
  const { db } = b;
  let completedRides = 0;
  for (const id of db.ix.rides.byFleet.get(rec.id)) if (db.rides.get(id)?.status === "COMPLETED") completedRides++;
  let settlementBalanceCents = 0;
  for (const id of db.ix.finance.settlementsByPayee.get(rec.id)) {
    const s = db.settlements.get(id);
    if (s && s.status !== "COMPLETED") settlementBalanceCents += s.netCents;
  }
  const { iban: _iban, ...rest } = rec;
  return {
    ...rest,
    driverIds: [...db.ix.people.driversByFleet.get(rec.id)],
    vehicleIds: [...db.ix.people.vehiclesByFleet.get(rec.id)],
    completedRides,
    settlementBalanceCents,
    documents: documentsOf(b, rec.id),
  };
}

export function toVehicle(b: Backend, rec: VehicleRecord): Vehicle {
  const nowMs = now();
  return {
    ...rec,
    insurance: { ...rec.insurance, status: credentialStatus(rec.insurance.expiresAt, nowMs) },
    inspection: { ...rec.inspection, status: credentialStatus(rec.inspection.expiresAt, nowMs) },
    documents: documentsOf(b, rec.id),
  };
}

export function promotionState(rec: PromotionRecord, redemptions: number, nowMs = Date.now()): PromotionState {
  if (!rec.enabled) return "DISABLED";
  if (Date.parse(rec.endsAt) < nowMs) return "EXPIRED";
  if (Date.parse(rec.startsAt) > nowMs) return "SCHEDULED";
  if (rec.usageLimit !== undefined && redemptions >= rec.usageLimit) return "EXHAUSTED";
  return "ACTIVE";
}

export function toPromotion({ db }: Backend, rec: PromotionRecord): Promotion {
  let redemptions = 0;
  let revenueImpactCents = 0;
  for (const id of db.ix.rides.byPromotion.get(rec.id)) {
    const ride = db.rides.get(id);
    if (!ride) continue;
    redemptions++;
    revenueImpactCents += ride.fareBreakdown.discount;
  }
  return { ...rec, redemptions, revenueImpactCents, state: promotionState(rec, redemptions) };
}

/** Display names for joins (ride rows, tickets, payments). */
export const customerName = ({ db }: Backend, id?: string) => (id ? db.customers.get(id)?.name : undefined);
export const driverName = ({ db }: Backend, id?: string) => (id ? db.drivers.get(id)?.name : undefined);
export const fleetName = ({ db }: Backend, id?: string) => (id ? db.fleets.get(id)?.companyName : undefined);
