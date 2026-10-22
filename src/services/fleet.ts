import type { Page } from "@/types/common";
import type {
  FleetListParams,
  FleetManager,
  FleetOnboardingCheck,
  FleetPerformance,
  FleetSuspensionCheck,
} from "@/types/fleet";
import type { DateRange } from "@/types/common";
import { maskEmail, maskPhone, maskTail } from "@/lib/format";
import { ServiceError } from "@/lib/service-error";
import { DAY, lisbonDay, now } from "@/mock/clock";
import {
  MANDATORY_FLEET_DOCS,
  commissionRateAt,
  documentRequirements,
  hasValidDocuments,
} from "@/mock/derive";
import { fareNet } from "@/mock/fare";
import { inRange, inSet, matchesQuery, paginate, sortRows } from "@/mock/query";
import { ACTIVE_RIDE_STATUSES } from "@/types/ride";
import {
  actor,
  assertState,
  audit,
  authorize,
  backend,
  clone,
  nowIso,
  requireReason,
  seesPersonalData,
  type Backend,
} from "./_shared";
import { documentsOf, toFleet } from "./_views";
import { rideTime } from "./dashboard";

/**
 * Fleet managers — requirements §7. The whole module is ❌ in the backend
 * (Appendix A). Permissions (P7): `fleet.view` to read, `approve` (onboarding),
 * `suspend` (also reactivate), `export`. Without `fleet.sensitive` e-mail,
 * phone and NIF come back masked and search matches only company, contact
 * name and ID. Access for the fleet manager's own staff is a backend matter.
 */

function present(f: FleetManager, unmasked: boolean): FleetManager {
  if (unmasked) return f;
  return { ...f, email: maskEmail(f.email), phone: maskPhone(f.phone), nif: maskTail(f.nif) };
}

/** Filter + sort shared by the list and the export. */
async function query(params: Omit<FleetListParams, "page" | "pageSize">) {
  const b = await backend();
  authorize("fleet", "view");
  const unmasked = seesPersonalData("fleet");
  const rows = b.db.fleets
    .all()
    .filter(
      (f) =>
        inSet(f.verification, params.verification) &&
        inSet(f.accountStatus, params.accountStatus) &&
        (unmasked
          ? matchesQuery(params.q, f.companyName, f.contactName, f.email, f.phone, f.nif, f.id)
          : matchesQuery(params.q, f.companyName, f.contactName, f.id)),
    )
    .map((f) => toFleet(b, f));
  const sorted = sortRows(
    rows,
    params.sort,
    {
      companyName: (f) => f.companyName,
      registeredAt: (f) => f.registeredAt,
      completedRides: (f) => f.completedRides,
      drivers: (f) => f.driverIds.length,
      vehicles: (f) => f.vehicleIds.length,
      settlementBalanceCents: (f) => f.settlementBalanceCents,
    },
    "registeredAt:desc",
  );
  return { unmasked, sorted };
}

/**
 * Sort fields: companyName, registeredAt, completedRides, drivers, vehicles, settlementBalanceCents.
 * // API: GET /admin/fleet-managers (❌)
 */
export async function listFleetManagers(params: FleetListParams): Promise<Page<FleetManager>> {
  const { unmasked, sorted } = await query(params);
  const page = paginate(sorted, params.page, params.pageSize);
  return { ...page, items: page.items.map((f) => present(f, unmasked)) };
}

/**
 * Every fleet matching the filters, for CSV/Excel. Exporting contact data is audited (§23).
 * // API: GET /admin/fleet-managers/export (❌)
 */
export async function exportFleetManagers(
  params: Omit<FleetListParams, "page" | "pageSize">,
): Promise<FleetManager[]> {
  authorize("fleet", "export");
  const b = await backend();
  const { unmasked, sorted } = await query(params);
  audit(b, {
    action: "fleet.export",
    resourceType: "fleet",
    resourceId: "list",
    after: { rows: sorted.length, filters: { ...params } },
  });
  return clone(sorted.map((f) => present(f, unmasked)));
}

/** // API: GET /admin/fleet-managers/:id (❌) */
export async function getFleetManager(id: string): Promise<FleetManager> {
  const b = await backend();
  authorize("fleet", "view");
  return clone(present(toFleet(b, b.db.fleets.require(id)), seesPersonalData("fleet")));
}

/**
 * The company documents required for onboarding and whether each is valid.
 * The "Approve onboarding" button lists the unmet ones (same idea as a
 * driver's eligibility, §6/§7).
 * // API: GET /admin/fleet-managers/:id/onboarding-check (❌)
 */
export async function getFleetOnboardingCheck(id: string): Promise<FleetOnboardingCheck> {
  const b = await backend();
  authorize("fleet", "view");
  b.db.fleets.require(id);
  const requirements = documentRequirements(documentsOf(b, id), MANDATORY_FLEET_DOCS, now());
  return { eligible: requirements.every((r) => r.state === "OK"), requirements };
}

const activeRidesOf = (b: Backend, id: string) =>
  b.db.ix.rides.byFleet
    .get(id)
    .filter((rideId) =>
      ACTIVE_RIDE_STATUSES.includes(b.db.rides.get(rideId)?.status ?? "COMPLETED"),
    ).length;

/** Policy (proposal): a fleet can't be suspended while its drivers are on rides. // API: GET /admin/fleet-managers/:id/suspension-check (❌) */
export async function getFleetSuspensionCheck(id: string): Promise<FleetSuspensionCheck> {
  const b = await backend();
  authorize("fleet", "suspend");
  b.db.fleets.require(id);
  return { activeRides: activeRidesOf(b, id) };
}

/**
 * Operational performance over a period: rides, fares and commission, the
 * state of its drivers and vehicles, and a daily series.
 * // API: GET /admin/fleet-managers/:id/performance?from&to (❌)
 */
export async function getFleetPerformance(id: string, range: DateRange): Promise<FleetPerformance> {
  const b = await backend();
  authorize("fleet", "view");
  b.db.fleets.require(id);
  const to = range.to ?? new Date(now() + 60_000).toISOString();
  const from = range.from ?? new Date(Date.parse(to) - 30 * DAY).toISOString();
  const nowMs = now();

  const daily = new Map<string, { grossCents: number; netCents: number; rides: number }>();
  let rides = 0;
  let completed = 0;
  let cancelled = 0;
  let gross = 0;
  let commission = 0;
  for (const rideId of b.db.ix.rides.byFleet.get(id)) {
    const ride = b.db.rides.get(rideId);
    if (!ride || ride.status === "SCHEDULED" || ACTIVE_RIDE_STATUSES.includes(ride.status))
      continue;
    const at = rideTime(ride);
    if (!inRange(at, from, to)) continue;
    rides++;
    const day = lisbonDay(Date.parse(at));
    const point = daily.get(day) ?? { grossCents: 0, netCents: 0, rides: 0 };
    point.rides++;
    if (ride.status === "COMPLETED" && ride.completedAt) {
      completed++;
      const net = fareNet(ride.fareBreakdown);
      const fee = Math.round(
        net *
          commissionRateAt(b.db.commissionRules.all(), ride.rideType, Date.parse(ride.completedAt)),
      );
      gross += net;
      commission += fee;
      point.grossCents += net;
      point.netCents += net - fee;
    } else if (ride.status === "CANCELLED" || ride.status === "EXPIRED") cancelled++;
    daily.set(day, point);
  }

  const drivers = [...b.db.ix.people.driversByFleet.get(id)]
    .map((driverId) => b.db.drivers.get(driverId))
    .filter((d) => d !== undefined);
  const vehicles = [...b.db.ix.people.vehiclesByFleet.get(id)]
    .map((vehicleId) => b.db.vehicles.get(vehicleId))
    .filter((v) => v !== undefined);
  const soon = nowMs + 30 * DAY;
  return {
    fleetManagerId: id,
    from,
    to,
    rides,
    completed,
    cancelled,
    grossCents: gross,
    commissionCents: commission,
    drivers: {
      total: drivers.length,
      online: drivers.filter((d) => d.online).length,
      approved: drivers.filter((d) => d.verification === "APPROVED" && d.accountStatus === "ACTIVE")
        .length,
      averageRating: drivers.length
        ? Math.round((drivers.reduce((sum, d) => sum + d.rating, 0) / drivers.length) * 10) / 10
        : 0,
    },
    vehicles: {
      total: vehicles.length,
      approved: vehicles.filter((v) => v.approval === "APPROVED").length,
      pendingReview: vehicles.filter((v) => v.approval === "PENDING_REVIEW").length,
      documentsExpiring: vehicles.filter(
        (v) =>
          Date.parse(v.insurance.expiresAt) < soon || Date.parse(v.inspection.expiresAt) < soon,
      ).length,
    },
    daily: [...daily.entries()]
      .sort(([a], [c]) => a.localeCompare(c))
      .map(([date, v]) => ({ date, ...v })),
  };
}

/** Approve onboarding — needs the company documents approved. // API: PATCH /admin/fleet-managers/:id/verification (❌) */
export async function approveFleetManager(id: string): Promise<FleetManager> {
  const b = await backend();
  authorize("fleet", "approve");
  const current = b.db.fleets.require(id);
  assertState(current.verification, ["PENDING", "REJECTED"], "approve");
  if (!hasValidDocuments(documentsOf(b, id), MANDATORY_FLEET_DOCS, now())) {
    throw new ServiceError("CONFLICT", "Company documents are not all approved", "eligibility");
  }
  const next = b.db.fleets.update(id, (f) => ({
    ...f,
    verification: "APPROVED",
    statusHistory: [...f.statusHistory, { status: "APPROVED", at: nowIso(), by: actor().id }],
  }));
  audit(b, {
    action: "fleet.approve",
    resourceType: "fleet",
    resourceId: id,
    before: { verification: current.verification },
    after: { verification: "APPROVED" },
  });
  return clone(present(toFleet(b, next), seesPersonalData("fleet")));
}

/** // API: PATCH /admin/fleet-managers/:id/verification (❌) */
export async function rejectFleetManager(id: string, reason: string): Promise<FleetManager> {
  const b = await backend();
  authorize("fleet", "approve");
  const text = requireReason(reason);
  const current = b.db.fleets.require(id);
  assertState(current.verification, ["PENDING"], "reject");
  const next = b.db.fleets.update(id, (f) => ({
    ...f,
    verification: "REJECTED",
    statusHistory: [
      ...f.statusHistory,
      { status: "REJECTED", at: nowIso(), by: actor().id, reason: text },
    ],
  }));
  audit(b, {
    action: "fleet.reject",
    resourceType: "fleet",
    resourceId: id,
    before: { verification: "PENDING" },
    after: { verification: "REJECTED" },
    reason: text,
  });
  return clone(present(toFleet(b, next), seesPersonalData("fleet")));
}

/**
 * Suspend or reactivate. Suspending is refused while a driver of the fleet is
 * on a ride (CONFLICT field `activeRides`, details `count`) and takes the
 * fleet's drivers offline.
 * // API: PATCH /admin/fleet-managers/:id/status (❌)
 */
export async function setFleetAccountStatus(
  id: string,
  status: "ACTIVE" | "SUSPENDED",
  reason: string,
): Promise<FleetManager> {
  const b = await backend();
  authorize("fleet", "suspend");
  const text = requireReason(reason);
  const current = b.db.fleets.require(id);
  if (current.accountStatus === status)
    throw new ServiceError("CONFLICT", `Fleet is already ${status}`);
  let driversOffline = 0;
  if (status === "SUSPENDED") {
    const count = activeRidesOf(b, id);
    if (count > 0)
      throw new ServiceError("CONFLICT", "A driver of this fleet is on a ride", "activeRides", {
        count,
      });
    for (const driverId of b.db.ix.people.driversByFleet.get(id)) {
      if (b.db.drivers.get(driverId)?.online) {
        b.db.drivers.update(driverId, { online: false, location: undefined });
        driversOffline++;
      }
    }
  }
  const next = b.db.fleets.update(id, (f) => ({
    ...f,
    accountStatus: status,
    statusHistory: [...f.statusHistory, { status, at: nowIso(), by: actor().id, reason: text }],
  }));
  audit(b, {
    action: status === "SUSPENDED" ? "fleet.suspend" : "fleet.reactivate",
    resourceType: "fleet",
    resourceId: id,
    before: { accountStatus: current.accountStatus },
    after: {
      accountStatus: status,
      ...(status === "SUSPENDED" && { driversTakenOffline: driversOffline }),
    },
    reason: text,
  });
  return clone(present(toFleet(b, next), seesPersonalData("fleet")));
}
