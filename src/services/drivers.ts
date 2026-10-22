import type { AdminNote, Page } from "@/types/common";
import type { DocumentType } from "@/types/document";
import type { Driver, DriverEligibility, DriverListItem, DriverListParams, DriverSuspensionCheck } from "@/types/driver";
import { maskEmail, maskPhone, maskTail } from "@/lib/format";
import { ServiceError } from "@/lib/service-error";
import { now } from "@/mock/clock";
import { MANDATORY_DRIVER_DOCS, documentRequirements, hasValidDocuments } from "@/mock/derive";
import { inSet, matchesQuery, paginate, sortRows } from "@/mock/query";
import { ACTIVE_RIDE_STATUSES } from "@/types/ride";
import { actor, assertState, audit, authorize, backend, clone, makeNote, nowIso, requireReason, seesPersonalData, type Backend } from "./_shared";
import { documentsOf, toDriver } from "./_views";

/**
 * Drivers — requirements §6. Permissions (P7): `drivers.view` to read, `edit`
 * (fleet association, notes), `approve` (verification and its documents),
 * `suspend` (also reactivate), `export`. Without `drivers.sensitive` e-mail,
 * phone, NIF and licence/TVDE numbers come back masked and search only
 * matches name and ID.
 */

const expiringSoon = (d: Driver) =>
  d.licence.status === "EXPIRING_SOON" ||
  d.licence.status === "EXPIRED" ||
  d.tvde.status === "EXPIRING_SOON" ||
  d.tvde.status === "EXPIRED";

/** The driver with the names of their fleet and vehicle, masked when the role may not see personal data. */
function present(b: Backend, d: Driver, unmasked: boolean): DriverListItem {
  const vehicle = d.vehicleId ? b.db.vehicles.get(d.vehicleId) : undefined;
  const base: DriverListItem = {
    ...d,
    fleetName: d.fleetManagerId ? b.db.fleets.get(d.fleetManagerId)?.companyName : undefined,
    vehiclePlate: vehicle?.plate,
    vehicleLabel: vehicle ? `${vehicle.make} ${vehicle.model}` : undefined,
  };
  if (unmasked) return base;
  return {
    ...base,
    email: maskEmail(d.email),
    phone: maskPhone(d.phone),
    nif: maskTail(d.nif),
    licence: { ...d.licence, number: maskTail(d.licence.number) },
    tvde: { ...d.tvde, number: maskTail(d.tvde.number) },
  };
}

/** Filter + sort shared by the list and the export. */
async function query(params: Omit<DriverListParams, "page" | "pageSize">) {
  const b = await backend();
  authorize("drivers", "view");
  const unmasked = seesPersonalData("drivers");
  const rows = b.db.drivers
    .all()
    .filter(
      (d) =>
        inSet(d.verification, params.verification) &&
        inSet(d.accountStatus, params.accountStatus) &&
        (params.online === undefined || d.online === params.online) &&
        (!params.fleetManagerId || d.fleetManagerId === params.fleetManagerId) &&
        (unmasked
          ? matchesQuery(params.q, d.name, d.email, d.phone, d.id, d.licence.number, d.tvde.number)
          : matchesQuery(params.q, d.name, d.id)),
    )
    .map((d) => toDriver(b, d))
    .filter((d) => !params.expiring || expiringSoon(d));
  const sorted = sortRows(
    rows,
    params.sort,
    {
      name: (d) => d.name,
      joinedAt: (d) => d.joinedAt,
      rating: (d) => d.rating,
      completedRides: (d) => d.completedRides,
      cancelledRides: (d) => d.cancelledRides,
      tvdeExpiresAt: (d) => d.tvde.expiresAt,
      licenceExpiresAt: (d) => d.licence.expiresAt,
    },
    "joinedAt:desc",
  );
  return { b, unmasked, sorted };
}

/**
 * Sort fields: name, joinedAt, rating, completedRides, cancelledRides, tvdeExpiresAt, licenceExpiresAt.
 * // API: GET /admin/users?role=DRIVER
 */
export async function listDrivers(params: DriverListParams): Promise<Page<DriverListItem>> {
  const { b, unmasked, sorted } = await query(params);
  const page = paginate(sorted, params.page, params.pageSize);
  return { ...page, items: page.items.map((d) => present(b, d, unmasked)) };
}

/**
 * Every driver matching the filters, for CSV/Excel. Exporting personal data is audited (§23).
 * // API: GET /admin/users/export?role=DRIVER (❌)
 */
export async function exportDrivers(params: Omit<DriverListParams, "page" | "pageSize">): Promise<DriverListItem[]> {
  authorize("drivers", "export");
  const { b, unmasked, sorted } = await query(params);
  audit(b, { action: "driver.export", resourceType: "driver", resourceId: "list", after: { rows: sorted.length, filters: { ...params } } });
  return clone(sorted.map((d) => present(b, d, unmasked)));
}

/** // API: GET /admin/users/:id (driver profile) */
export async function getDriver(id: string): Promise<DriverListItem> {
  const b = await backend();
  authorize("drivers", "view");
  return clone(present(b, toDriver(b, b.db.drivers.require(id)), seesPersonalData("drivers")));
}

/**
 * The mandatory documents and whether each is satisfied — what the "Mark
 * eligible" button lists when it is disabled (§6). Eligibility rules are a
 * proposal until compliance confirms them (`MANDATORY_DRIVER_DOCS`).
 * // API: GET /admin/kyc/:driverProfileId/eligibility (❌)
 */
export async function getDriverEligibility(id: string): Promise<DriverEligibility> {
  const b = await backend();
  authorize("drivers", "view");
  b.db.drivers.require(id);
  const requirements = documentRequirements(documentsOf(b, id), MANDATORY_DRIVER_DOCS, now());
  return { eligible: requirements.every((r) => r.state === "OK"), requirements };
}

function activeRideOf(b: Backend, id: string) {
  return b.db.ix.rides.byDriver.get(id).find((rideId) => ACTIVE_RIDE_STATUSES.includes(b.db.rides.get(rideId)?.status ?? "COMPLETED"));
}

/** What stops a suspension, so the dialog can say so first. // API: GET /admin/users/:id/suspension-check (❌) */
export async function getDriverSuspensionCheck(id: string): Promise<DriverSuspensionCheck> {
  const b = await backend();
  authorize("drivers", "suspend");
  b.db.drivers.require(id);
  return { activeRideId: activeRideOf(b, id) };
}

/**
 * Approve verification — refused while a mandatory document is missing,
 * rejected or expired (§6: never mark ineligible drivers eligible).
 * // API: PATCH /admin/kyc/:driverProfileId
 */
export async function approveDriver(id: string): Promise<DriverListItem> {
  const b = await backend();
  authorize("drivers", "approve");
  const current = b.db.drivers.require(id);
  assertState(current.verification, ["UNDER_REVIEW", "PENDING_DOCS", "REJECTED"], "approve");
  if (!hasValidDocuments(documentsOf(b, id), MANDATORY_DRIVER_DOCS, now())) {
    throw new ServiceError("CONFLICT", "Mandatory documents are missing, pending, rejected or expired", "eligibility");
  }
  const who = actor();
  const next = b.db.drivers.update(id, (d) => ({
    ...d,
    verification: "APPROVED",
    statusHistory: [...d.statusHistory, { status: "APPROVED", at: nowIso(), by: who.id }],
  }));
  audit(b, { action: "driver.approve", resourceType: "driver", resourceId: id, before: { verification: current.verification }, after: { verification: "APPROVED" } });
  return clone(present(b, toDriver(b, next), seesPersonalData("drivers")));
}

/** // API: PATCH /admin/kyc/:driverProfileId */
export async function rejectDriver(id: string, reason: string): Promise<DriverListItem> {
  const b = await backend();
  authorize("drivers", "approve");
  const text = requireReason(reason);
  const current = b.db.drivers.require(id);
  assertState(current.verification, ["UNDER_REVIEW", "PENDING_DOCS"], "reject");
  const next = b.db.drivers.update(id, (d) => ({
    ...d,
    verification: "REJECTED",
    statusHistory: [...d.statusHistory, { status: "REJECTED", at: nowIso(), by: actor().id, reason: text }],
  }));
  audit(b, { action: "driver.reject", resourceType: "driver", resourceId: id, before: { verification: current.verification }, after: { verification: "REJECTED" }, reason: text });
  return clone(present(b, toDriver(b, next), seesPersonalData("drivers")));
}

/**
 * Ask the driver to send documents again — marks those documents rejected
 * with the reason and moves the driver back to PENDING_DOCS.
 * // API: POST /admin/kyc/:driverProfileId/resubmission (❌)
 */
export async function requestDocumentResubmission(id: string, types: DocumentType[], reason: string): Promise<DriverListItem> {
  const b = await backend();
  authorize("drivers", "approve");
  const text = requireReason(reason);
  if (!types.length) throw new ServiceError("VALIDATION", "Pick at least one document", "types");
  const current = b.db.drivers.require(id);
  const who = actor();
  for (const docId of b.db.ix.documents.get(id)) {
    const doc = b.db.documents.get(docId);
    if (!doc || !types.includes(doc.type)) continue;
    b.db.documents.update(docId, (d) => ({
      ...d,
      status: "REJECTED",
      rejectionReason: text,
      reviewHistory: [...d.reviewHistory, { status: "RESUBMISSION_REQUESTED", at: nowIso(), by: who.id, reason: text }],
    }));
  }
  const next = b.db.drivers.update(id, (d) => ({
    ...d,
    verification: d.verification === "NOT_SUBMITTED" ? d.verification : "PENDING_DOCS",
    statusHistory: [...d.statusHistory, { status: "PENDING_DOCS", at: nowIso(), by: who.id, reason: text }],
  }));
  audit(b, { action: "driver.request_resubmission", resourceType: "driver", resourceId: id, before: { verification: current.verification }, after: { verification: next.verification, documents: types }, reason: text });
  return clone(present(b, toDriver(b, next), seesPersonalData("drivers")));
}

/** Suspend — blocked during an active ride. // API: PATCH /admin/users/:id/status */
export async function suspendDriver(id: string, reason: string): Promise<DriverListItem> {
  const b = await backend();
  authorize("drivers", "suspend");
  const text = requireReason(reason);
  const current = b.db.drivers.require(id);
  assertState(current.accountStatus, ["ACTIVE"], "suspend");
  const rideId = activeRideOf(b, id);
  if (rideId) throw new ServiceError("CONFLICT", "Driver is on an active ride", "activeRide", { ride: rideId });
  const next = b.db.drivers.update(id, (d) => ({
    ...d,
    accountStatus: "SUSPENDED",
    online: false,
    location: undefined,
    statusHistory: [...d.statusHistory, { status: "SUSPENDED", at: nowIso(), by: actor().id, reason: text }],
  }));
  audit(b, { action: "driver.suspend", resourceType: "driver", resourceId: id, before: { accountStatus: "ACTIVE" }, after: { accountStatus: "SUSPENDED" }, reason: text });
  return clone(present(b, toDriver(b, next), seesPersonalData("drivers")));
}

/** // API: PATCH /admin/users/:id/status */
export async function reactivateDriver(id: string, reason: string): Promise<DriverListItem> {
  const b = await backend();
  authorize("drivers", "suspend");
  const text = requireReason(reason);
  const current = b.db.drivers.require(id);
  assertState(current.accountStatus, ["SUSPENDED", "DEACTIVATED"], "reactivate");
  const next = b.db.drivers.update(id, (d) => ({
    ...d,
    accountStatus: "ACTIVE",
    verification: d.verification === "SUSPENDED" ? "APPROVED" : d.verification,
    statusHistory: [...d.statusHistory, { status: "ACTIVE", at: nowIso(), by: actor().id, reason: text }],
  }));
  audit(b, { action: "driver.reactivate", resourceType: "driver", resourceId: id, before: { accountStatus: current.accountStatus }, after: { accountStatus: "ACTIVE" }, reason: text });
  return clone(present(b, toDriver(b, next), seesPersonalData("drivers")));
}

/**
 * Link the driver to a fleet (or make them independent with `null`). The
 * driver's vehicle follows.
 * // API: PATCH /admin/drivers/:id/fleet (❌)
 */
export async function assignDriverFleet(id: string, fleetManagerId: string | null, reason: string): Promise<DriverListItem> {
  const b = await backend();
  authorize("drivers", "edit");
  const text = requireReason(reason);
  const current = b.db.drivers.require(id);
  if (fleetManagerId) {
    const fleet = b.db.fleets.require(fleetManagerId);
    if (fleet.verification !== "APPROVED" || fleet.accountStatus !== "ACTIVE") {
      throw new ServiceError("CONFLICT", "Fleet is not approved and active", "fleetManagerId");
    }
  }
  const people = b.db.ix.people;
  people.driversByFleet.remove(current.fleetManagerId, id);
  people.driversByFleet.add(fleetManagerId ?? undefined, id);
  if (current.vehicleId) {
    const vehicle = b.db.vehicles.get(current.vehicleId);
    if (vehicle) {
      people.vehiclesByFleet.remove(vehicle.fleetManagerId, vehicle.id);
      people.vehiclesByFleet.add(fleetManagerId ?? undefined, vehicle.id);
      b.db.vehicles.update(vehicle.id, { fleetManagerId: fleetManagerId ?? undefined });
    }
  }
  const next = b.db.drivers.update(id, { fleetManagerId: fleetManagerId ?? undefined });
  audit(b, { action: "driver.assign_fleet", resourceType: "driver", resourceId: id, before: { fleetManagerId: current.fleetManagerId ?? null }, after: { fleetManagerId }, reason: text });
  return clone(present(b, toDriver(b, next), seesPersonalData("drivers")));
}

/** // API: POST /admin/drivers/:id/notes (❌) */
export async function addDriverNote(id: string, text: string): Promise<AdminNote> {
  const b = await backend();
  authorize("drivers", "edit");
  const note = makeNote(b, text);
  b.db.drivers.update(id, (d) => ({ ...d, notes: [note, ...d.notes] }));
  audit(b, { action: "driver.add_note", resourceType: "driver", resourceId: id });
  return clone(note);
}
