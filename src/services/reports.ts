import type { Report, ReportMetric, ReportRow, ReportType } from "@/types/analytics";
import type { DateRange } from "@/types/common";
import type { Ride } from "@/types/ride";
import { DAY, lisbonDay } from "@/mock/clock";
import { commissionRateAt } from "@/mock/derive";
import { fareNet } from "@/mock/fare";
import { inRange } from "@/mock/query";
import { backend, clone, type Backend } from "./_shared";
import { resolveRange, rideTime } from "./dashboard";

/**
 * Reports & analytics — requirements §17. One generic shape per report
 * (metrics, daily series, paginated rows); the export (P5) uses the same rows
 * so exported values always match the screen.
 */

export type ReportParams = DateRange & { page: number; pageSize: number };

type Built = Omit<Report, "type" | "from" | "to" | "page" | "pageSize" | "total" | "rows"> & { rows: ReportRow[] };

const rate = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 1000 : 0);

function days(from: string, to: string) {
  const out: string[] = [];
  for (let t = Date.parse(from); t <= Date.parse(to); t += DAY) out.push(lisbonDay(t));
  return [...new Set(out)];
}

function finishedRides(b: Backend, from: string, to: string) {
  return b.db.rides.all().filter((r) => (r.status === "COMPLETED" || r.status === "CANCELLED" || r.status === "EXPIRED") && inRange(rideTime(r), from, to));
}

function commissionOf(b: Backend, r: Ride) {
  return r.status === "COMPLETED" && r.completedAt
    ? Math.round(fareNet(r.fareBreakdown) * commissionRateAt(b.db.commissionRules.all(), r.rideType, Date.parse(r.completedAt)))
    : 0;
}

function byDay<T>(items: readonly T[], dayOf: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = dayOf(item);
    map.set(key, [...(map.get(key) ?? []), item]);
  }
  return map;
}

const builders: Record<ReportType, (b: Backend, from: string, to: string) => Built> = {
  rides(b, from, to) {
    const rides = finishedRides(b, from, to);
    const done = rides.filter((r) => r.status === "COMPLETED");
    const grouped = byDay(rides, (r) => lisbonDay(rideTime(r)));
    const rows = days(from, to).map((date) => {
      const list = grouped.get(date) ?? [];
      const completed = list.filter((r) => r.status === "COMPLETED").length;
      return { date, rides: list.length, completed, cancelled: list.filter((r) => r.status === "CANCELLED").length, expired: list.filter((r) => r.status === "EXPIRED").length, completionRate: rate(completed, list.length) };
    });
    return {
      metrics: [
        { key: "rides", value: rides.length, format: "number" },
        { key: "completed", value: done.length, format: "number" },
        { key: "completionRate", value: rate(done.length, rides.length), format: "percent" },
        { key: "avgDistanceKm", value: done.length ? Math.round((done.reduce((s, r) => s + r.distanceKm, 0) / done.length) * 10) / 10 : 0, format: "number" },
        { key: "avgDurationMin", value: done.length ? Math.round(done.reduce((s, r) => s + r.durationMin, 0) / done.length) : 0, format: "minutes" },
      ],
      series: rows.map((r) => ({ bucket: r.date, values: { rides: r.rides, completed: r.completed } })),
      columns: [
        { key: "date", format: "date" },
        { key: "rides", format: "number" },
        { key: "completed", format: "number" },
        { key: "cancelled", format: "number" },
        { key: "expired", format: "number" },
        { key: "completionRate", format: "percent" },
      ],
      rows: rows.reverse(),
    };
  },

  cancellations(b, from, to) {
    const rides = finishedRides(b, from, to);
    const cancelled = rides.filter((r) => r.status === "CANCELLED");
    const expired = rides.filter((r) => r.status === "EXPIRED");
    const groups = new Map<string, { reason: string; by: string; count: number; feesCents: number }>();
    for (const r of cancelled) {
      const key = `${r.cancellation?.by}|${r.cancellation?.reason}`;
      const g = groups.get(key) ?? { reason: r.cancellation?.reason ?? "", by: r.cancellation?.by ?? "", count: 0, feesCents: 0 };
      g.count++;
      g.feesCents += r.cancellation?.feeCents ?? 0;
      groups.set(key, g);
    }
    groups.set("SYSTEM|NO_DRIVER", { reason: "NO_DRIVER_FOUND", by: "SYSTEM", count: expired.length, feesCents: 0 });
    const grouped = byDay(rides, (r) => lisbonDay(rideTime(r)));
    return {
      metrics: [
        { key: "cancelled", value: cancelled.length, format: "number" },
        { key: "cancellationRate", value: rate(cancelled.length, rides.length), format: "percent" },
        { key: "expired", value: expired.length, format: "number" },
        { key: "failureRate", value: rate(expired.length, rides.length), format: "percent" },
        { key: "feesCents", value: cancelled.reduce((s, r) => s + (r.cancellation?.feeCents ?? 0), 0), format: "cents" },
      ],
      series: days(from, to).map((date) => {
        const list = grouped.get(date) ?? [];
        return { bucket: date, values: { cancelled: list.filter((r) => r.status === "CANCELLED").length, expired: list.filter((r) => r.status === "EXPIRED").length } };
      }),
      columns: [
        { key: "by", format: "text" },
        { key: "reason", format: "text" },
        { key: "count", format: "number" },
        { key: "share", format: "percent" },
        { key: "feesCents", format: "cents" },
      ],
      rows: [...groups.values()].map((g) => ({ ...g, share: rate(g.count, cancelled.length + expired.length) })).sort((a, c) => c.count - a.count),
    };
  },

  revenue(b, from, to) {
    const done = finishedRides(b, from, to).filter((r) => r.status === "COMPLETED");
    const grouped = byDay(done, (r) => lisbonDay(rideTime(r)));
    const rows = days(from, to).map((date) => {
      const list = grouped.get(date) ?? [];
      const revenueCents = list.reduce((s, r) => s + r.fareBreakdown.total, 0);
      const vatCents = list.reduce((s, r) => s + r.fareBreakdown.vat, 0);
      const commissionCents = list.reduce((s, r) => s + commissionOf(b, r), 0);
      return { date, rides: list.length, revenueCents, vatCents, commissionCents, driverEarningsCents: revenueCents - vatCents - commissionCents };
    });
    const total = (k: "revenueCents" | "vatCents" | "commissionCents" | "driverEarningsCents") => rows.reduce((s, r) => s + r[k], 0);
    return {
      metrics: [
        { key: "revenueCents", value: total("revenueCents"), format: "cents" },
        { key: "commissionCents", value: total("commissionCents"), format: "cents" },
        { key: "driverEarningsCents", value: total("driverEarningsCents"), format: "cents" },
        { key: "vatCents", value: total("vatCents"), format: "cents" },
        { key: "avgFareCents", value: done.length ? Math.round(total("revenueCents") / done.length) : 0, format: "cents" },
      ],
      series: rows.map((r) => ({ bucket: r.date, values: { revenueCents: r.revenueCents, commissionCents: r.commissionCents } })),
      columns: [
        { key: "date", format: "date" },
        { key: "rides", format: "number" },
        { key: "revenueCents", format: "cents" },
        { key: "vatCents", format: "cents" },
        { key: "commissionCents", format: "cents" },
        { key: "driverEarningsCents", format: "cents" },
      ],
      rows: rows.reverse(),
    };
  },

  drivers(b, from, to) {
    const stats = new Map<string, { rides: number; cancelled: number; grossCents: number; ratings: number[] }>();
    for (const r of finishedRides(b, from, to)) {
      if (!r.driverId) continue;
      const s = stats.get(r.driverId) ?? { rides: 0, cancelled: 0, grossCents: 0, ratings: [] };
      if (r.status === "COMPLETED") {
        s.rides++;
        s.grossCents += fareNet(r.fareBreakdown);
        if (r.rating) s.ratings.push(r.rating);
      } else if (r.status === "CANCELLED" && r.cancellation?.by === "DRIVER") s.cancelled++;
      stats.set(r.driverId, s);
    }
    const rows = [...stats.entries()]
      .map(([id, s]) => ({
        driverId: id,
        name: b.db.drivers.get(id)?.name ?? id,
        rides: s.rides,
        driverCancellations: s.cancelled,
        grossCents: s.grossCents,
        avgRating: s.ratings.length ? Math.round((s.ratings.reduce((x, y) => x + y, 0) / s.ratings.length) * 10) / 10 : null,
      }))
      .sort((a, c) => c.rides - a.rides);
    const ratings = rows.filter((r) => r.avgRating !== null);
    return {
      metrics: [
        { key: "activeDrivers", value: rows.length, format: "number" },
        { key: "avgRidesPerDriver", value: rows.length ? Math.round((rows.reduce((s, r) => s + r.rides, 0) / rows.length) * 10) / 10 : 0, format: "number" },
        { key: "avgRating", value: ratings.length ? Math.round((ratings.reduce((s, r) => s + (r.avgRating ?? 0), 0) / ratings.length) * 10) / 10 : 0, format: "rating" },
        { key: "onlineNow", value: b.db.drivers.all().filter((d) => d.online).length, format: "number" },
      ],
      series: [],
      columns: [
        { key: "driverId", format: "text" },
        { key: "name", format: "text" },
        { key: "rides", format: "number" },
        { key: "driverCancellations", format: "number" },
        { key: "grossCents", format: "cents" },
        { key: "avgRating", format: "rating" },
      ],
      rows,
    };
  },

  fleets(b, from, to) {
    const stats = new Map<string, { rides: number; grossCents: number; commissionCents: number; drivers: Set<string> }>();
    for (const r of finishedRides(b, from, to)) {
      if (!r.fleetManagerId || r.status !== "COMPLETED") continue;
      const s = stats.get(r.fleetManagerId) ?? { rides: 0, grossCents: 0, commissionCents: 0, drivers: new Set<string>() };
      s.rides++;
      s.grossCents += fareNet(r.fareBreakdown);
      s.commissionCents += commissionOf(b, r);
      if (r.driverId) s.drivers.add(r.driverId);
      stats.set(r.fleetManagerId, s);
    }
    const rows = [...stats.entries()]
      .map(([id, s]) => ({ fleetId: id, name: b.db.fleets.get(id)?.companyName ?? id, activeDrivers: s.drivers.size, rides: s.rides, grossCents: s.grossCents, commissionCents: s.commissionCents }))
      .sort((a, c) => c.grossCents - a.grossCents);
    return {
      metrics: [
        { key: "activeFleets", value: rows.length, format: "number" },
        { key: "fleetRides", value: rows.reduce((s, r) => s + r.rides, 0), format: "number" },
        { key: "fleetGrossCents", value: rows.reduce((s, r) => s + r.grossCents, 0), format: "cents" },
      ],
      series: [],
      columns: [
        { key: "fleetId", format: "text" },
        { key: "name", format: "text" },
        { key: "activeDrivers", format: "number" },
        { key: "rides", format: "number" },
        { key: "grossCents", format: "cents" },
        { key: "commissionCents", format: "cents" },
      ],
      rows,
    };
  },

  customers(b, from, to) {
    const newOnes = byDay(b.db.customers.all().filter((c) => inRange(c.registeredAt, from, to)), (c) => lisbonDay(c.registeredAt));
    const ridesBy = byDay(finishedRides(b, from, to).filter((r) => r.status === "COMPLETED"), (r) => lisbonDay(rideTime(r)));
    const riders = new Map<string, number>();
    for (const list of ridesBy.values()) for (const r of list) riders.set(r.customerId, (riders.get(r.customerId) ?? 0) + 1);
    const rows = days(from, to).map((date) => ({
      date,
      newCustomers: newOnes.get(date)?.length ?? 0,
      activeCustomers: new Set((ridesBy.get(date) ?? []).map((r) => r.customerId)).size,
    }));
    const repeat = [...riders.values()].filter((n) => n > 1).length;
    return {
      metrics: [
        { key: "newCustomers", value: rows.reduce((s, r) => s + r.newCustomers, 0), format: "number" },
        { key: "activeCustomers", value: riders.size, format: "number" },
        { key: "repeatRate", value: rate(repeat, riders.size), format: "percent" },
      ],
      series: rows.map((r) => ({ bucket: r.date, values: { newCustomers: r.newCustomers, activeCustomers: r.activeCustomers } })),
      columns: [
        { key: "date", format: "date" },
        { key: "newCustomers", format: "number" },
        { key: "activeCustomers", format: "number" },
      ],
      rows: rows.reverse(),
    };
  },

  payments(b, from, to) {
    const list = b.db.payments.all().filter((p) => inRange(p.createdAt, from, to));
    const methods = new Map<string, { count: number; successful: number; failed: number; amountCents: number }>();
    for (const p of list) {
      const m = methods.get(p.method) ?? { count: 0, successful: 0, failed: 0, amountCents: 0 };
      m.count++;
      if (p.status === "FAILED") m.failed++;
      else if (p.status !== "PENDING" && p.status !== "PROCESSING") {
        m.successful++;
        m.amountCents += p.amountCents;
      }
      methods.set(p.method, m);
    }
    const failed = list.filter((p) => p.status === "FAILED").length;
    const grouped = byDay(list, (p) => lisbonDay(p.createdAt));
    return {
      metrics: [
        { key: "payments", value: list.length, format: "number" },
        { key: "successRate", value: rate(list.length - failed, list.length), format: "percent" },
        { key: "failed", value: failed, format: "number" },
        { key: "failureRate", value: rate(failed, list.length), format: "percent" },
      ],
      series: days(from, to).map((date) => {
        const day = grouped.get(date) ?? [];
        return { bucket: date, values: { payments: day.length, failed: day.filter((p) => p.status === "FAILED").length } };
      }),
      columns: [
        { key: "method", format: "text" },
        { key: "count", format: "number" },
        { key: "successful", format: "number" },
        { key: "failed", format: "number" },
        { key: "successRate", format: "percent" },
        { key: "amountCents", format: "cents" },
      ],
      rows: [...methods.entries()].map(([method, m]) => ({ method, ...m, successRate: rate(m.successful, m.count) })).sort((a, c) => c.count - a.count),
    };
  },

  refunds_payouts(b, from, to) {
    const refunds = b.db.payments.all().flatMap((p) => p.refunds).filter((r) => inRange(r.createdAt, from, to));
    const payouts = b.db.payouts.all().filter((p) => inRange(p.createdAt, from, to));
    const refundDays = byDay(refunds, (r) => lisbonDay(r.createdAt));
    const payoutDays = byDay(payouts, (p) => lisbonDay(p.createdAt));
    const rows = days(from, to).map((date) => {
      const rf = refundDays.get(date) ?? [];
      const po = payoutDays.get(date) ?? [];
      return { date, refunds: rf.length, refundedCents: rf.reduce((s, r) => s + r.amountCents, 0), payouts: po.length, payoutCents: po.reduce((s, p) => s + p.amountCents, 0), payoutsFailed: po.filter((p) => p.status === "FAILED").length };
    });
    return {
      metrics: [
        { key: "refunds", value: refunds.length, format: "number" },
        { key: "refundedCents", value: refunds.reduce((s, r) => s + r.amountCents, 0), format: "cents" },
        { key: "payouts", value: payouts.length, format: "number" },
        { key: "payoutCents", value: payouts.reduce((s, p) => s + p.amountCents, 0), format: "cents" },
        { key: "payoutsFailed", value: payouts.filter((p) => p.status === "FAILED").length, format: "number" },
      ],
      series: rows.map((r) => ({ bucket: r.date, values: { refundedCents: r.refundedCents, payoutCents: r.payoutCents } })),
      columns: [
        { key: "date", format: "date" },
        { key: "refunds", format: "number" },
        { key: "refundedCents", format: "cents" },
        { key: "payouts", format: "number" },
        { key: "payoutCents", format: "cents" },
        { key: "payoutsFailed", format: "number" },
      ],
      rows: rows.reverse(),
    };
  },

  promotions(b, from, to) {
    const stats = new Map<string, { redemptions: number; discountCents: number; grossCents: number; customers: Set<string> }>();
    for (const r of finishedRides(b, from, to)) {
      if (!r.promotionId) continue;
      const s = stats.get(r.promotionId) ?? { redemptions: 0, discountCents: 0, grossCents: 0, customers: new Set<string>() };
      s.redemptions++;
      s.discountCents += r.fareBreakdown.discount;
      s.grossCents += r.fareBreakdown.total;
      s.customers.add(r.customerId);
      stats.set(r.promotionId, s);
    }
    const rows = [...stats.entries()]
      .map(([id, s]) => ({ promotionId: id, code: b.db.promotions.get(id)?.code ?? id, redemptions: s.redemptions, uniqueCustomers: s.customers.size, discountCents: s.discountCents, grossCents: s.grossCents }))
      .sort((a, c) => c.redemptions - a.redemptions);
    return {
      metrics: [
        { key: "redemptions", value: rows.reduce((s, r) => s + r.redemptions, 0), format: "number" },
        { key: "discountCents", value: rows.reduce((s, r) => s + r.discountCents, 0), format: "cents" },
        { key: "campaignsUsed", value: rows.length, format: "number" },
      ],
      series: [],
      columns: [
        { key: "code", format: "text" },
        { key: "redemptions", format: "number" },
        { key: "uniqueCustomers", format: "number" },
        { key: "discountCents", format: "cents" },
        { key: "grossCents", format: "cents" },
      ],
      rows,
    };
  },

  support(b, from, to) {
    const tickets = b.db.tickets.all().filter((t) => inRange(t.createdAt, from, to));
    const incidents = b.db.incidents.all().filter((i) => inRange(i.raisedAt, from, to));
    const resolved = tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED");
    const hours = resolved
      .map((t) => t.history.find((e) => e.type === "RESOLVED"))
      .filter((e) => e !== undefined)
      .map((e, i) => (Date.parse(e.at) - Date.parse(resolved[i]!.createdAt)) / 3_600_000);
    const cats = new Map<string, { tickets: number; open: number; resolved: number; critical: number }>();
    for (const t of tickets) {
      const c = cats.get(t.category) ?? { tickets: 0, open: 0, resolved: 0, critical: 0 };
      c.tickets++;
      if (t.status === "RESOLVED" || t.status === "CLOSED") c.resolved++;
      else c.open++;
      if (t.priority === "CRITICAL") c.critical++;
      cats.set(t.category, c);
    }
    const grouped = byDay(tickets, (t) => lisbonDay(t.createdAt));
    return {
      metrics: [
        { key: "tickets", value: tickets.length, format: "number" },
        { key: "open", value: tickets.length - resolved.length, format: "number" },
        { key: "resolutionRate", value: rate(resolved.length, tickets.length), format: "percent" },
        { key: "avgResolutionHours", value: hours.length ? Math.round((hours.reduce((s, h) => s + h, 0) / hours.length) * 10) / 10 : 0, format: "number" },
        { key: "incidents", value: incidents.length, format: "number" },
      ],
      series: days(from, to).map((date) => ({ bucket: date, values: { tickets: grouped.get(date)?.length ?? 0 } })),
      columns: [
        { key: "category", format: "text" },
        { key: "tickets", format: "number" },
        { key: "open", format: "number" },
        { key: "resolved", format: "number" },
        { key: "critical", format: "number" },
      ],
      rows: [...cats.entries()].map(([category, c]) => ({ category, ...c })).sort((a, c) => c.tickets - a.tickets),
    };
  },
};

export const REPORT_TYPES = Object.keys(builders) as ReportType[];

/** // API: GET /admin/analytics/reports/:type?from&to&page&pageSize (✅ export partial, ❌ the reports) */
export async function getReport(type: ReportType, params: ReportParams): Promise<Report> {
  const b = await backend();
  const { from, to } = resolveRange(params);
  const built = builders[type](b, from, to);
  const size = Math.min(Math.max(1, params.pageSize || 25), 500);
  const lastPage = Math.max(1, Math.ceil(built.rows.length / size));
  const page = Math.min(Math.max(1, params.page || 1), lastPage);
  return clone({
    type,
    from,
    to,
    metrics: built.metrics as ReportMetric[],
    series: built.series,
    columns: built.columns,
    rows: built.rows.slice((page - 1) * size, page * size),
    page,
    pageSize: size,
    total: built.rows.length,
  });
}
