import type {
  CategoryPoint,
  DashboardAlert,
  DashboardStats,
  RecentRegistration,
  TrendPoint,
} from "@/types/analytics";
import type { DateRange } from "@/types/common";
import type { Ride, RideListItem } from "@/types/ride";
import type { RideCategory } from "@/types/vehicle";
import type { ModuleKey } from "@/config/nav";
import { ACTIVE_RIDE_STATUSES } from "@/types/ride";
import { DAY, lisbonDay, lisbonParts, now } from "@/mock/clock";
import { commissionRateAt, effectiveDocumentStatus } from "@/mock/derive";
import { fareNet } from "@/mock/fare";
import { inRange } from "@/mock/query";
import { audit, authorize, backend, canView, clone, type Backend } from "./_shared";

/** Dashboard — requirements §4. Every number is computed from the same rows the module pages show. */

/** The module each alert links to; the role needs its `view` to see the alert. */
const ALERT_MODULE: Record<DashboardAlert["kind"], ModuleKey> = {
  SOS_ACTIVE: "support",
  STALE_LOCATIONS: "live",
  PAYOUTS_FAILED: "payouts",
  DOCUMENTS_PENDING: "documents",
  DOCUMENTS_EXPIRING: "documents",
  FLEET_PENDING: "fleet",
  VEHICLES_PENDING: "vehicles",
  INVOICES_FAILED: "invoices",
};

/** Default period: the last 30 days. */
export function resolveRange(range: DateRange) {
  const to = range.to ?? new Date(now() + 60_000).toISOString();
  const from = range.from ?? new Date(Date.parse(to) - 30 * DAY).toISOString();
  return { from, to };
}

/** When a ride counts for a period: its completion/cancellation time, else booking. */
export const rideTime = (r: Ride) => r.completedAt ?? r.cancellation?.at ?? r.bookedAt;

function ridesIn(b: Backend, from: string, to: string) {
  return b.db.rides.all().filter((r) => r.status !== "SCHEDULED" && !ACTIVE_RIDE_STATUSES.includes(r.status) && inRange(rideTime(r), from, to));
}

function money(b: Backend, rides: readonly Ride[]) {
  let revenue = 0;
  let commission = 0;
  for (const r of rides) {
    if (r.status !== "COMPLETED" || !r.completedAt) continue;
    revenue += r.fareBreakdown.total;
    commission += Math.round(fareNet(r.fareBreakdown) * commissionRateAt(b.db.commissionRules.all(), r.rideType, Date.parse(r.completedAt)));
  }
  return { revenue, commission };
}

/** // API: GET /admin/analytics/dashboard?from&to (✅) */
export async function getDashboardStats(range: DateRange): Promise<DashboardStats> {
  const b = await backend();
  authorize("dashboard", "view");
  const { db } = b;
  const { from, to } = resolveRange(range);
  const length = Date.parse(to) - Date.parse(from);
  const prevFrom = new Date(Date.parse(from) - length).toISOString();

  const rides = ridesIn(b, from, to);
  const prevRides = ridesIn(b, prevFrom, from);
  const { revenue, commission } = money(b, rides);
  const prevMoney = money(b, prevRides);
  const drivers = db.drivers.all();
  const active = drivers.filter((d) => d.accountStatus === "ACTIVE" && d.verification === "APPROVED").length;
  const pendingSettlements = db.settlements.all().filter((s) => s.status === "PENDING");
  const pendingPayouts = db.payouts.all().filter((p) => p.status === "PENDING" || p.status === "PROCESSING");
  const count = (list: readonly Ride[], status: Ride["status"]) => list.filter((r) => r.status === status).length;

  return {
    from,
    to,
    customers: { total: db.customers.size, newInPeriod: db.customers.all().filter((c) => inRange(c.registeredAt, from, to)).length },
    drivers: {
      total: drivers.length,
      active,
      inactive: drivers.length - active,
      online: drivers.filter((d) => d.online).length,
      pendingVerification: drivers.filter((d) => d.verification === "UNDER_REVIEW" || d.verification === "PENDING_DOCS").length,
    },
    fleetManagers: { total: db.fleets.size, pendingOnboarding: db.fleets.all().filter((f) => f.verification === "PENDING").length },
    rides: {
      total: rides.length,
      ongoing: db.rides.all().filter((r) => ACTIVE_RIDE_STATUSES.includes(r.status)).length,
      scheduled: db.rides.all().filter((r) => r.status === "SCHEDULED").length,
      completed: count(rides, "COMPLETED"),
      cancelled: count(rides, "CANCELLED"),
      expired: count(rides, "EXPIRED"),
    },
    revenueCents: revenue,
    commissionCents: commission,
    pendingSettlements: { count: pendingSettlements.length, amountCents: pendingSettlements.reduce((s, x) => s + Math.max(0, x.netCents), 0) },
    pendingPayouts: { count: pendingPayouts.length, amountCents: pendingPayouts.reduce((s, x) => s + x.amountCents, 0) },
    openComplaints: db.tickets.all().filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS" || t.status === "ESCALATED").length,
    activeIncidents: db.incidents.all().filter((i) => i.status === "ACTIVE").length,
    previous: {
      rides: prevRides.length,
      revenueCents: prevMoney.revenue,
      completed: count(prevRides, "COMPLETED"),
      newCustomers: db.customers.all().filter((c) => inRange(c.registeredAt, prevFrom, from)).length,
    },
  };
}

/**
 * Daily points, or hourly when the period is two days or less ("today").
 * // API: GET /admin/analytics/trends?from&to (✅)
 */
export async function getTrends(range: DateRange): Promise<TrendPoint[]> {
  const b = await backend();
  authorize("dashboard", "view");
  const { from, to } = resolveRange(range);
  const hourly = Date.parse(to) - Date.parse(from) <= 2 * DAY;
  const bucketOf = (iso: string) => {
    const ms = Date.parse(iso);
    return hourly ? `${lisbonDay(ms)}T${String(lisbonParts(ms).hour).padStart(2, "0")}` : lisbonDay(ms);
  };
  const points = new Map<string, TrendPoint>();
  // Pre-fill so days without rides still show.
  const step = hourly ? 3_600_000 : DAY;
  for (let t = Date.parse(from); t <= Date.parse(to); t += step) {
    const key = bucketOf(new Date(t).toISOString());
    points.set(key, { bucket: key, rides: 0, completed: 0, cancelled: 0, revenueCents: 0, commissionCents: 0 });
  }
  for (const r of ridesIn(b, from, to)) {
    const p = points.get(bucketOf(rideTime(r)));
    if (!p) continue;
    p.rides++;
    if (r.status === "CANCELLED" || r.status === "EXPIRED") p.cancelled++;
    if (r.status === "COMPLETED" && r.completedAt) {
      p.completed++;
      p.revenueCents += r.fareBreakdown.total;
      p.commissionCents += Math.round(fareNet(r.fareBreakdown) * commissionRateAt(b.db.commissionRules.all(), r.rideType, Date.parse(r.completedAt)));
    }
  }
  return [...points.values()].sort((a, b2) => a.bucket.localeCompare(b2.bucket));
}

/** Latest rides (live and finished). // API: GET /admin/rides?limit=10 */
export async function getRecentRides(limit = 10): Promise<RideListItem[]> {
  const { db } = await backend();
  authorize("dashboard", "view");
  authorize("rides", "view");
  const rows = db.rides
    .all()
    .filter((r) => r.status !== "SCHEDULED")
    .slice()
    .sort((a, b) => b.bookedAt.localeCompare(a.bookedAt))
    .slice(0, limit)
    .map((r) => ({
      ...r,
      customerName: db.customers.get(r.customerId)?.name ?? r.customerId,
      driverName: r.driverId ? db.drivers.get(r.driverId)?.name : undefined,
      fleetName: r.fleetManagerId ? db.fleets.get(r.fleetManagerId)?.companyName : undefined,
      vehiclePlate: r.vehicleId ? db.vehicles.get(r.vehicleId)?.plate : undefined,
    }));
  return clone(rows);
}

/** Newest customers, drivers and fleets together. // API: GET /admin/analytics/registrations (❌) */
export async function getRecentRegistrations(limit = 8): Promise<RecentRegistration[]> {
  const { db } = await backend();
  authorize("dashboard", "view");
  // Only the kinds of people the role may open.
  const all: RecentRegistration[] = [
    ...(canView("customers") ? db.customers.all().map((c) => ({ kind: "CUSTOMER" as const, id: c.id, name: c.name, at: c.registeredAt, status: c.status })) : []),
    ...(canView("drivers") ? db.drivers.all().map((d) => ({ kind: "DRIVER" as const, id: d.id, name: d.name, at: d.joinedAt, status: d.verification })) : []),
    ...(canView("fleet") ? db.fleets.all().map((f) => ({ kind: "FLEET" as const, id: f.id, name: f.companyName, at: f.registeredAt, status: f.verification })) : []),
  ];
  return all.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** Pending approvals and operational alerts, most urgent first. // API: GET /admin/analytics/alerts (❌) */
export async function getDashboardAlerts(): Promise<DashboardAlert[]> {
  const { db } = await backend();
  authorize("dashboard", "view");
  const nowMs = now();
  const alerts: DashboardAlert[] = [];
  const sos = db.incidents.all().filter((i) => i.status === "ACTIVE");
  if (sos.length) alerts.push({ kind: "SOS_ACTIVE", severity: "critical", count: sos.length, href: "/support?tab=incidents", ref: sos[0]!.rideId });

  const stale = db.rides.all().filter((r) => ACTIVE_RIDE_STATUSES.includes(r.status) && r.driverId && (!r.lastLocation || nowMs - Date.parse(r.lastLocation.at) > 2 * 60_000)).length;
  if (stale) alerts.push({ kind: "STALE_LOCATIONS", severity: "warning", count: stale, href: "/live" });

  const failedPayouts = db.payouts.all().filter((p) => p.status === "FAILED").length;
  if (failedPayouts) alerts.push({ kind: "PAYOUTS_FAILED", severity: "warning", count: failedPayouts, href: "/payouts?status=FAILED" });

  let pendingDocs = 0;
  let expiring = 0;
  for (const d of db.documents.all()) {
    const status = effectiveDocumentStatus(d.status, d.expiresAt, nowMs);
    if (status === "PENDING") pendingDocs++;
    if (status === "APPROVED" && d.expiresAt && Date.parse(d.expiresAt) - nowMs < 30 * DAY) expiring++;
  }
  if (pendingDocs) alerts.push({ kind: "DOCUMENTS_PENDING", severity: "info", count: pendingDocs, href: "/documents?status=PENDING" });
  if (expiring) alerts.push({ kind: "DOCUMENTS_EXPIRING", severity: "warning", count: expiring, href: "/documents?expiring=30" });

  const fleets = db.fleets.all().filter((f) => f.verification === "PENDING").length;
  if (fleets) alerts.push({ kind: "FLEET_PENDING", severity: "info", count: fleets, href: "/fleet-managers?verification=PENDING" });
  const vehicles = db.vehicles.all().filter((v) => v.approval === "PENDING_REVIEW").length;
  if (vehicles) alerts.push({ kind: "VEHICLES_PENDING", severity: "info", count: vehicles, href: "/vehicles?approval=PENDING_REVIEW" });
  const invoices = db.invoices.all().filter((i) => i.status === "FAILED").length;
  if (invoices) alerts.push({ kind: "INVOICES_FAILED", severity: "warning", count: invoices, href: "/invoices?status=FAILED" });

  // An alert links to another module, so the role must be able to open it.
  const rank = { critical: 0, warning: 1, info: 2 };
  return alerts.filter((a) => canView(ALERT_MODULE[a.kind])).sort((a, b) => rank[a.severity] - rank[b.severity]);
}

/** Rides and revenue per ride category for the period. // API: GET /admin/analytics/categories?from&to (❌) */
export async function getRidesByCategory(range: DateRange): Promise<CategoryPoint[]> {
  const b = await backend();
  authorize("dashboard", "view");
  const { from, to } = resolveRange(range);
  const points = new Map<RideCategory, CategoryPoint>(
    (["ECONOMY", "COMFORT", "PREMIUM"] as const).map((category) => [category, { category, rides: 0, completed: 0, revenueCents: 0 }]),
  );
  for (const r of ridesIn(b, from, to)) {
    const p = points.get(r.rideType);
    if (!p) continue;
    p.rides++;
    if (r.status === "COMPLETED") {
      p.completed++;
      p.revenueCents += r.fareBreakdown.total;
    }
  }
  return [...points.values()];
}

/**
 * Daily series of the period (what the charts show) for CSV/XLSX. Audited.
 * // API: GET /admin/analytics/dashboard/export?from&to (❌)
 */
export async function exportDashboard(range: DateRange): Promise<TrendPoint[]> {
  const b = await backend();
  authorize("dashboard", "export");
  const points = await getTrends(range);
  audit(b, { action: "report.export_dashboard", resourceType: "report", resourceId: "dashboard", after: { rows: points.length, range: { ...range } } });
  return clone(points);
}
