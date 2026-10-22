import type { Page } from "@/types/common";
import type {
  AssignableDriver,
  Vehicle,
  VehicleApprovalCheck,
  VehicleDriverUse,
  VehicleInput,
  VehicleListItem,
  VehicleListParams,
  VehicleOperational,
  VehicleStatusCheck,
} from "@/types/vehicle";
import { ServiceError } from "@/lib/service-error";
import { DAY, now } from "@/mock/clock";
import {
  MANDATORY_VEHICLE_DOCS,
  credentialStatus,
  documentRequirements,
  hasValidDocuments,
} from "@/mock/derive";
import { inSet, matchesQuery, normalize, paginate, sortRows } from "@/mock/query";
import { ACTIVE_RIDE_STATUSES } from "@/types/ride";
import {
  actor,
  assertState,
  audit,
  authorize,
  backend,
  clone,
  diff,
  nowIso,
  requireReason,
  type Backend,
} from "./_shared";
import { documentsOf, toVehicle } from "./_views";

/**
 * Vehicles — requirements §8. Permissions (P7): `vehicles.view` to read,
 * `create`, `edit` (permitted fields + driver assignment), `approve` (also
 * reject), `suspend` (active / inactive / suspended), `export`.
 */

const PLATE =
  /^([A-Z]{2}-\d{2}-[A-Z]{2}|\d{2}-[A-Z]{2}-\d{2}|\d{2}-\d{2}-[A-Z]{2}|[A-Z]{2}-\d{2}-\d{2})$/;

/** Days until the nearer of insurance and inspection ends (negative once ended). */
const daysToExpiry = (v: Vehicle) =>
  Math.floor(
    (Math.min(Date.parse(v.insurance.expiresAt), Date.parse(v.inspection.expiresAt)) - now()) / DAY,
  );

const expiring = (v: Vehicle) =>
  v.insurance.status === "EXPIRING_SOON" ||
  v.insurance.status === "EXPIRED" ||
  v.inspection.status === "EXPIRING_SOON" ||
  v.inspection.status === "EXPIRED";

function item(b: Backend, v: Vehicle): VehicleListItem {
  return {
    ...v,
    driverName: v.driverId ? b.db.drivers.get(v.driverId)?.name : undefined,
    fleetName: v.fleetManagerId ? b.db.fleets.get(v.fleetManagerId)?.companyName : undefined,
    daysToExpiry: daysToExpiry(v),
  };
}

/** Filter + sort shared by the list and the export. */
async function query(params: Omit<VehicleListParams, "page" | "pageSize">) {
  const b = await backend();
  authorize("vehicles", "view");
  const rows = b.db.vehicles
    .all()
    .filter(
      (v) =>
        inSet(v.category, params.category) &&
        inSet(v.approval, params.approval) &&
        inSet(v.operational, params.operational) &&
        (!params.fleetManagerId || v.fleetManagerId === params.fleetManagerId) &&
        (!params.driverId || v.driverId === params.driverId) &&
        matchesQuery(params.q, v.plate, v.make, v.model, v.id, v.insurance.policyNo),
    )
    .map((v) => toVehicle(b, v))
    .filter(
      (v) =>
        (!params.expiring || expiring(v)) &&
        (params.expiringWithinDays === undefined || daysToExpiry(v) < params.expiringWithinDays),
    );
  const sorted = sortRows(
    rows,
    params.sort,
    {
      plate: (v) => v.plate,
      make: (v) => `${v.make} ${v.model}`,
      year: (v) => v.year,
      registeredAt: (v) => v.registeredAt,
      insuranceExpiresAt: (v) => v.insurance.expiresAt,
      inspectionExpiresAt: (v) => v.inspection.expiresAt,
      nextExpiry: (v) => daysToExpiry(v),
    },
    "registeredAt:desc",
  );
  return { b, sorted };
}

/**
 * Sort fields: plate, make, year, registeredAt, insuranceExpiresAt, inspectionExpiresAt, nextExpiry.
 * // API: GET /vehicles
 */
export async function listVehicles(params: VehicleListParams): Promise<Page<VehicleListItem>> {
  const { b, sorted } = await query(params);
  const page = paginate(sorted, params.page, params.pageSize);
  return { ...page, items: page.items.map((v) => item(b, v)) };
}

/** Every vehicle matching the filters, for CSV/Excel. Audited. // API: GET /admin/vehicles/export (❌) */
export async function exportVehicles(
  params: Omit<VehicleListParams, "page" | "pageSize">,
): Promise<VehicleListItem[]> {
  authorize("vehicles", "export");
  const { b, sorted } = await query(params);
  audit(b, {
    action: "vehicle.export",
    resourceType: "vehicle",
    resourceId: "list",
    after: { rows: sorted.length, filters: { ...params } },
  });
  return clone(sorted.map((v) => item(b, v)));
}

/** // API: GET /vehicles/:id */
export async function getVehicle(id: string): Promise<VehicleListItem> {
  const b = await backend();
  authorize("vehicles", "view");
  return clone(item(b, toVehicle(b, b.db.vehicles.require(id))));
}

/**
 * The documents a vehicle needs before approval (insurance, inspection,
 * registration) and whether each is valid. The "Approve" button lists the
 * unmet ones.
 * // API: GET /admin/vehicles/:id/approval-check (❌)
 */
export async function getVehicleApprovalCheck(id: string): Promise<VehicleApprovalCheck> {
  const b = await backend();
  authorize("vehicles", "view");
  b.db.vehicles.require(id);
  const requirements = documentRequirements(documentsOf(b, id), MANDATORY_VEHICLE_DOCS, now());
  return { eligible: requirements.every((r) => r.state === "OK"), requirements };
}

const activeRideOf = (b: Backend, vehicleId: string) =>
  b.db.rides.all().find((r) => r.vehicleId === vehicleId && ACTIVE_RIDE_STATUSES.includes(r.status))
    ?.id;

/** What stops the vehicle from going inactive or suspended: a ride in progress. // API: GET /admin/vehicles/:id/status-check (❌) */
export async function getVehicleStatusCheck(id: string): Promise<VehicleStatusCheck> {
  const b = await backend();
  authorize("vehicles", "suspend");
  b.db.vehicles.require(id);
  return { activeRideId: activeRideOf(b, id) };
}

/**
 * Drivers who have driven this vehicle, from the rides done with it —
 * the assignment history (§8). The assigned driver comes first.
 * // API: GET /admin/vehicles/:id/drivers (❌)
 */
export async function getVehicleDrivers(id: string): Promise<VehicleDriverUse[]> {
  const b = await backend();
  authorize("vehicles", "view");
  const vehicle = b.db.vehicles.require(id);
  const uses = new Map<string, VehicleDriverUse>();
  for (const ride of b.db.rides.all()) {
    if (ride.vehicleId !== id || !ride.driverId) continue;
    const at = ride.completedAt ?? ride.bookedAt;
    const use = uses.get(ride.driverId) ?? {
      driverId: ride.driverId,
      driverName: b.db.drivers.get(ride.driverId)?.name ?? ride.driverId,
      rides: 0,
      firstRideAt: at,
      lastRideAt: at,
      current: ride.driverId === vehicle.driverId,
    };
    use.rides++;
    if (at < use.firstRideAt) use.firstRideAt = at;
    if (at > use.lastRideAt) use.lastRideAt = at;
    uses.set(ride.driverId, use);
  }
  return clone(
    [...uses.values()].sort(
      (a, c) => Number(c.current) - Number(a.current) || c.lastRideAt.localeCompare(a.lastRideAt),
    ),
  );
}

function validate(input: VehicleInput, b: Awaited<ReturnType<typeof backend>>, selfId?: string) {
  const plate = input.plate.trim().toUpperCase();
  if (!PLATE.test(plate))
    throw new ServiceError("VALIDATION", "Plate must look like AA-12-BB", "plate");
  const year = new Date().getFullYear();
  // TVDE: vehicles at most 7 years old.
  if (input.year < year - 7 || input.year > year + 1)
    throw new ServiceError("VALIDATION", "Vehicle must be at most 7 years old", "year");
  const taken = b.db.vehicles
    .all()
    .some((v) => v.id !== selfId && normalize(v.plate) === normalize(plate));
  if (taken) throw new ServiceError("CONFLICT", "Another vehicle has this plate", "plate");
  if (input.driverId) b.db.drivers.require(input.driverId);
  if (input.fleetManagerId) b.db.fleets.require(input.fleetManagerId);
  return plate;
}

/** New vehicles start PENDING_REVIEW / INACTIVE until their documents are approved. // API: POST /admin/vehicles (❌) */
export async function createVehicle(input: VehicleInput): Promise<VehicleListItem> {
  const b = await backend();
  authorize("vehicles", "create");
  const plate = validate(input, b);
  const nowMs = now();
  const id = `VEH-${b.seq.vehicle.take()}`;
  const vehicle = b.db.vehicles.insert({
    ...input,
    // A new vehicle is pending and inactive, so it can't have a driver yet (assign after approval).
    driverId: undefined,
    id,
    plate,
    insurance: { ...input.insurance, status: credentialStatus(input.insurance.expiresAt, nowMs) },
    inspection: {
      ...input.inspection,
      status: credentialStatus(input.inspection.expiresAt, nowMs),
    },
    approval: "PENDING_REVIEW",
    operational: "INACTIVE",
    registeredAt: nowIso(),
    statusHistory: [{ status: "PENDING_REVIEW", at: nowIso(), by: actor().id }],
  });
  b.db.ix.people.vehiclesByFleet.add(vehicle.fleetManagerId, id);
  audit(b, {
    action: "vehicle.create",
    resourceType: "vehicle",
    resourceId: id,
    after: { plate, make: input.make, model: input.model },
  });
  return clone(item(b, toVehicle(b, vehicle)));
}

/** // API: PATCH /admin/vehicles/:id (❌) */
export async function updateVehicle(id: string, input: VehicleInput): Promise<VehicleListItem> {
  const b = await backend();
  authorize("vehicles", "edit");
  const current = b.db.vehicles.require(id);
  const plate = validate(input, b, id);
  const nowMs = now();
  // Driver and fleet are not editable here: the driver is assigned with
  // `assignVehicleDriver`, and the fleet follows the driver's fleet change (P10).
  const { driverId: _driver, fleetManagerId: _fleet, ...editable } = input;
  const next = b.db.vehicles.update(id, (v) => ({
    ...v,
    ...editable,
    plate,
    insurance: { ...input.insurance, status: credentialStatus(input.insurance.expiresAt, nowMs) },
    inspection: {
      ...input.inspection,
      status: credentialStatus(input.inspection.expiresAt, nowMs),
    },
  }));
  const changes = diff(current, next);
  audit(b, { action: "vehicle.update", resourceType: "vehicle", resourceId: id, ...changes });
  return clone(item(b, toVehicle(b, next)));
}

/** Approve — needs insurance, inspection and registration approved and valid. // API: PATCH /vehicles/:id/review */
export async function approveVehicle(id: string): Promise<VehicleListItem> {
  const b = await backend();
  authorize("vehicles", "approve");
  const current = b.db.vehicles.require(id);
  assertState(current.approval, ["PENDING_REVIEW", "REJECTED"], "approve");
  if (!hasValidDocuments(documentsOf(b, id), MANDATORY_VEHICLE_DOCS, now())) {
    throw new ServiceError(
      "CONFLICT",
      "Vehicle documents are missing, pending or expired",
      "eligibility",
    );
  }
  const next = b.db.vehicles.update(id, (v) => ({
    ...v,
    approval: "APPROVED",
    operational: "ACTIVE",
    statusHistory: [...v.statusHistory, { status: "APPROVED", at: nowIso(), by: actor().id }],
  }));
  audit(b, {
    action: "vehicle.approve",
    resourceType: "vehicle",
    resourceId: id,
    before: { approval: current.approval },
    after: { approval: "APPROVED" },
  });
  return clone(item(b, toVehicle(b, next)));
}

/** // API: PATCH /vehicles/:id/review */
export async function rejectVehicle(id: string, reason: string): Promise<VehicleListItem> {
  const b = await backend();
  authorize("vehicles", "approve");
  const text = requireReason(reason);
  const current = b.db.vehicles.require(id);
  assertState(current.approval, ["PENDING_REVIEW"], "reject");
  const next = b.db.vehicles.update(id, (v) => ({
    ...v,
    approval: "REJECTED",
    operational: "INACTIVE",
    statusHistory: [
      ...v.statusHistory,
      { status: "REJECTED", at: nowIso(), by: actor().id, reason: text },
    ],
  }));
  audit(b, {
    action: "vehicle.reject",
    resourceType: "vehicle",
    resourceId: id,
    before: { approval: "PENDING_REVIEW" },
    after: { approval: "REJECTED" },
    reason: text,
  });
  return clone(item(b, toVehicle(b, next)));
}

/**
 * Active / inactive / suspended. Only approved vehicles can be ACTIVE (§8:
 * only eligible vehicles get rides).
 * // API: PATCH /admin/vehicles/:id/status (❌)
 */
export async function setVehicleOperational(
  id: string,
  operational: VehicleOperational,
  reason: string,
): Promise<VehicleListItem> {
  const b = await backend();
  authorize("vehicles", "suspend");
  const text = requireReason(reason);
  const current = b.db.vehicles.require(id);
  if (current.operational === operational)
    throw new ServiceError("CONFLICT", `Vehicle is already ${operational}`);
  if (operational === "ACTIVE") {
    assertState(current.approval, ["APPROVED"], "activate");
    if (credentialStatus(current.insurance.expiresAt, now()) === "EXPIRED")
      throw new ServiceError("CONFLICT", "Insurance has expired", "insuranceExpired");
  } else {
    const rideId = activeRideOf(b, id);
    if (rideId)
      throw new ServiceError("CONFLICT", "The vehicle is on a ride", "activeRide", {
        ride: rideId,
      });
  }
  const next = b.db.vehicles.update(id, (v) => ({
    ...v,
    operational,
    statusHistory: [
      ...v.statusHistory,
      { status: operational, at: nowIso(), by: actor().id, reason: text },
    ],
  }));
  audit(b, {
    action: "vehicle.set_status",
    resourceType: "vehicle",
    resourceId: id,
    before: { operational: current.operational },
    after: { operational },
    reason: text,
  });
  return clone(item(b, toVehicle(b, next)));
}

/** Approved, active drivers without a vehicle who can take this one (same fleet, or both independent). // API: GET /admin/vehicles/:id/assignable-drivers (❌) */
export async function listAssignableDrivers(id: string): Promise<AssignableDriver[]> {
  const b = await backend();
  authorize("vehicles", "edit");
  const vehicle = b.db.vehicles.require(id);
  return clone(
    b.db.drivers
      .all()
      .filter(
        (d) =>
          !d.vehicleId &&
          d.verification === "APPROVED" &&
          d.accountStatus === "ACTIVE" &&
          d.fleetManagerId === vehicle.fleetManagerId,
      )
      .slice(0, 200)
      .map((d) => ({
        id: d.id,
        name: d.name,
        fleetName: d.fleetManagerId ? b.db.fleets.get(d.fleetManagerId)?.companyName : undefined,
      }))
      .sort((a, c) => a.name.localeCompare(c.name)),
  );
}

/**
 * Assign a driver to the vehicle, or free it with `null`. Only approved,
 * active vehicles can be assigned (§8); the driver must be approved, active,
 * without a vehicle, and in the vehicle's fleet. Freeing a vehicle is
 * refused during a ride. Both records are updated.
 * // API: PATCH /admin/vehicles/:id/driver (❌)
 */
export async function assignVehicleDriver(
  id: string,
  driverId: string | null,
  reason: string,
): Promise<VehicleListItem> {
  const b = await backend();
  authorize("vehicles", "edit");
  const text = requireReason(reason);
  const current = b.db.vehicles.require(id);
  if (driverId === null) {
    if (!current.driverId) throw new ServiceError("CONFLICT", "The vehicle has no driver");
    const rideId = activeRideOf(b, id);
    if (rideId)
      throw new ServiceError("CONFLICT", "The vehicle is on a ride", "activeRide", {
        ride: rideId,
      });
    b.db.drivers.update(current.driverId, { vehicleId: undefined });
  } else {
    assertState(current.approval, ["APPROVED"], "assign a driver to");
    if (current.operational !== "ACTIVE")
      throw new ServiceError("CONFLICT", "Only active vehicles can be assigned", "notActive");
    if (current.driverId)
      throw new ServiceError(
        "CONFLICT",
        "The vehicle already has a driver — free it first",
        "driverId",
      );
    const driver = b.db.drivers.require(driverId);
    if (driver.verification !== "APPROVED" || driver.accountStatus !== "ACTIVE")
      throw new ServiceError("CONFLICT", "The driver is not approved and active", "driverId");
    if (driver.vehicleId)
      throw new ServiceError("CONFLICT", "The driver already has a vehicle", "driverId");
    if (driver.fleetManagerId !== current.fleetManagerId)
      throw new ServiceError(
        "CONFLICT",
        "Driver and vehicle belong to different fleets",
        "driverId",
      );
    b.db.drivers.update(driverId, { vehicleId: id });
  }
  const next = b.db.vehicles.update(id, { driverId: driverId ?? undefined });
  audit(b, {
    action: "vehicle.assign_driver",
    resourceType: "vehicle",
    resourceId: id,
    before: { driverId: current.driverId ?? null },
    after: { driverId },
    reason: text,
  });
  return clone(item(b, toVehicle(b, next)));
}
