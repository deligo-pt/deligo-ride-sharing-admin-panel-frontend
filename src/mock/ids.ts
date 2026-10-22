/**
 * Readable, prefixed IDs (ride_plan.md §D.8) and the sizes of each table.
 * Relationships between generated tables are worked out from the index
 * (`fleetIndexOfDriver`, `vehicleOfDriver`) so a generator never needs another
 * module's data — that keeps generation lazy and order-independent.
 */
export const COUNTS = {
  customers: 2500,
  drivers: 600,
  fleets: 40,
  /** One per driver plus 100 spare fleet cars. */
  vehicles: 700,
  /** Ride slots over the last 90 days; those ending after "now" are dropped (plus ~30 live and ~80 scheduled). */
  rides: 20000,
  promotions: 30,
  tickets: 400,
  incidents: 25,
  notifications: 60,
  admins: 15,
  audit: 3000,
  gdpr: 30,
} as const;

/** Fleets FLT-336…339 are new applicants (pending/rejected) with no drivers yet. */
export const APPROVED_FLEET_SLOTS = 36;

export const customerId = (i: number) => `CUS-${10000 + i}`;
export const driverId = (i: number) => `DRV-${20000 + i}`;
export const fleetId = (i: number) => `FLT-${300 + i}`;
export const vehicleId = (i: number) => `VEH-${5000 + i}`;
export const rideId = (i: number) => `RIDE-${860000 + i}`;
export const paymentId = (i: number) => `PAY-${410000 + i}`;
export const refundId = (i: number) => `RFD-${7000 + i}`;
export const settlementId = (i: number) => `SET-${30000 + i}`;
export const payoutId = (i: number) => `PO-${60000 + i}`;
export const promotionId = (i: number) => `PRM-${100 + i}`;
export const ticketId = (i: number) => `TCK-${5000 + i}`;
export const incidentId = (i: number) => `INC-${100 + i}`;
export const notificationId = (i: number) => `NTF-${200 + i}`;
export const documentId = (i: number) => `DOC-${70000 + i}`;
export const invoiceNumber = (year: number, seq: number) => `FR ${year}/${String(seq).padStart(6, "0")}`;
export const invoiceId = (i: number) => `INV-${100000 + i}`;
export const adminId = (i: number) => `ADM-${String(i + 1).padStart(3, "0")}`;
export const auditId = (i: number) => `AUD-${500000 + i}`;
export const pricingId = (i: number) => `PRC-${10 + i}`;
export const zoneId = (i: number) => `ZON-${10 + i}`;
export const commissionRuleId = (i: number) => `COM-${10 + i}`;
export const gdprId = (i: number) => `GDPR-${300 + i}`;
export const noteId = (i: number) => `NOTE-${90000 + i}`;

/** 40% of drivers drive for a fleet, spread over the 36 approved fleets. */
export function fleetIndexOfDriver(driverIndex: number): number | undefined {
  return driverIndex % 5 < 2 ? driverIndex % APPROVED_FLEET_SLOTS : undefined;
}

/** Driver i drives vehicle i; vehicles 600–699 are spare fleet cars. */
export const vehicleOfDriver = (driverIndex: number) => vehicleId(driverIndex);

export function fleetIndexOfVehicle(vehicleIndex: number): number | undefined {
  if (vehicleIndex < COUNTS.drivers) return fleetIndexOfDriver(vehicleIndex);
  return vehicleIndex % APPROVED_FLEET_SLOTS;
}

/** Index from an ID — "DRV-20017" → 17. */
export const indexOf = (id: string, base: number) => Number(id.split("-")[1]) - base;
