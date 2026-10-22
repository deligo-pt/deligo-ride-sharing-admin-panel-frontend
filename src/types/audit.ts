import type { DateRange, ISODate, ListParams } from "./common";

/** Resource types match the permission modules, plus `auth` for sign-in events. */
export type AuditResourceType =
  | "auth"
  | "customer"
  | "driver"
  | "fleet"
  | "vehicle"
  | "ride"
  | "pricing"
  | "zone"
  | "payment"
  | "commission"
  | "settlement"
  | "payout"
  | "promotion"
  | "ticket"
  | "incident"
  | "notification"
  | "document"
  | "invoice"
  | "admin"
  | "settings"
  | "gdpr"
  | "report";

/**
 * `<resource>.<verb>`, e.g. "customer.suspend", "payment.refund",
 * "auth.login". Labels are translated per action in P27.
 */
export type AuditAction = `${AuditResourceType}.${string}`;

/** Append-only (§21): there is no update or delete for audit entries. */
export type AuditLog = {
  id: string;
  adminId: string;
  adminName: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  at: ISODate;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  correlationId: string;
  ip: string;
};

export type AuditListParams = ListParams &
  DateRange & {
    adminId?: string;
    resourceType?: AuditResourceType[];
    resourceId?: string;
    action?: string;
  };
