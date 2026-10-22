import type { Cents, ISODate } from "./common";
import type { RideCategory } from "./vehicle";

/** Dashboard KPIs (§4) for the selected period. Counts of "now" (ongoing, pending) ignore the period. */
export type DashboardStats = {
  from: ISODate;
  to: ISODate;
  customers: { total: number; newInPeriod: number };
  drivers: { total: number; active: number; inactive: number; online: number; pendingVerification: number };
  fleetManagers: { total: number; pendingOnboarding: number };
  rides: { total: number; ongoing: number; scheduled: number; completed: number; cancelled: number; expired: number };
  revenueCents: Cents;
  commissionCents: Cents;
  pendingSettlements: { count: number; amountCents: Cents };
  pendingPayouts: { count: number; amountCents: Cents };
  openComplaints: number;
  activeIncidents: number;
  /** Same metrics for the previous period of equal length, for the ▲▼ deltas. */
  previous: { rides: number; revenueCents: Cents; completed: number; newCustomers: number };
};

/** One day (or hour, for "today") on the trend charts. */
export type TrendPoint = {
  /** "2026-10-19" or "2026-10-19T14" for hourly buckets. */
  bucket: string;
  rides: number;
  completed: number;
  cancelled: number;
  revenueCents: Cents;
  commissionCents: Cents;
};

/** Rides and revenue of one ride category in the period (donut/bars). */
export type CategoryPoint = {
  category: RideCategory;
  rides: number;
  completed: number;
  revenueCents: Cents;
};

export type DashboardAlertKind =
  | "SOS_ACTIVE"
  | "DOCUMENTS_PENDING"
  | "DOCUMENTS_EXPIRING"
  | "PAYOUTS_FAILED"
  | "FLEET_PENDING"
  | "VEHICLES_PENDING"
  | "INVOICES_FAILED"
  | "STALE_LOCATIONS";

export type DashboardAlert = {
  kind: DashboardAlertKind;
  severity: "critical" | "warning" | "info";
  count: number;
  /** Where the alert's link goes (locale-free href). */
  href: string;
  /** Record to name in the message, e.g. the SOS ride ID. */
  ref?: string;
};

/** A registration in the "recent activity" list. */
export type RecentRegistration = {
  kind: "CUSTOMER" | "DRIVER" | "FLEET";
  id: string;
  name: string;
  at: ISODate;
  status: string;
};

export type ReportType =
  | "rides"
  | "cancellations"
  | "revenue"
  | "drivers"
  | "fleets"
  | "customers"
  | "payments"
  | "refunds_payouts"
  | "promotions"
  | "support";

/** A metric on a report: `format` tells the screen how to show `value`. */
export type ReportMetric = {
  key: string;
  value: number;
  format: "number" | "cents" | "percent" | "rating" | "minutes";
};

export type ReportRow = Record<string, string | number | null>;

/**
 * Generic report payload: headline metrics, a daily series, and the detail
 * rows (paginated, same shape as the export).
 */
export type Report = {
  type: ReportType;
  from: ISODate;
  to: ISODate;
  metrics: ReportMetric[];
  series: { bucket: string; values: Record<string, number> }[];
  columns: { key: string; format: ReportMetric["format"] | "text" | "date" }[];
  rows: ReportRow[];
  page: number;
  pageSize: number;
  total: number;
};
