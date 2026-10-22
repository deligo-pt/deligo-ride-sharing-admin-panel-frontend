import type { ModuleKey } from "./nav";

/**
 * The seven admin roles from requirements §20. Labels live in messages
 * (`roles.<id>`). The permission matrix below is ride_plan.md §E — a
 * proposal until the project owner approves it.
 */
export const ROLE_IDS = [
  "SUPER_ADMIN",
  "OPERATIONS_ADMIN",
  "SUPPORT_AGENT",
  "VERIFICATION_OFFICER",
  "FINANCE_ADMIN",
  "FLEET_OPS_MANAGER",
  "READ_ONLY_ANALYST",
] as const;

export type RoleId = (typeof ROLE_IDS)[number];

/** Actions from requirements §20. `approve` covers reject, `suspend` covers reactivate. */
export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "approve",
  "suspend",
  "export",
  "refund",
  "manage_admins",
  "modify_pricing",
  "sensitive",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/** Menu modules plus `gdpr`, which lives inside Settings. */
export type PermissionModule = ModuleKey | "gdpr";

export type PermissionMatrix = Partial<Record<PermissionModule, readonly PermissionAction[]>>;

/** `sensitive` = sees personal data (e-mail, phone, NIF, IBAN) unmasked. */
const ALL: readonly PermissionAction[] = PERMISSION_ACTIONS;
const VIEW = ["view"] as const;

export const ROLE_PERMISSIONS: Record<RoleId, PermissionMatrix> = {
  // Everything, including granting roles and changing fares.
  SUPER_ADMIN: {
    dashboard: ALL,
    live: ALL,
    customers: ALL,
    drivers: ALL,
    fleet: ALL,
    vehicles: ALL,
    documents: ALL,
    rides: ALL,
    pricing: ALL,
    support: ALL,
    payments: ALL,
    commission: ALL,
    payouts: ALL,
    invoices: ALL,
    promotions: ALL,
    notifications: ALL,
    reports: ALL,
    admins: ALL,
    audit: ALL,
    settings: ALL,
    gdpr: ALL,
  },
  // Runs operations; no refunds, no fare changes, no admin management.
  OPERATIONS_ADMIN: {
    dashboard: ["view", "export"],
    live: ["view", "edit"],
    customers: ["view", "edit", "suspend", "export", "sensitive"],
    drivers: ["view", "edit", "approve", "suspend", "export", "sensitive"],
    fleet: ["view", "edit", "approve", "suspend", "export", "sensitive"],
    vehicles: ["view", "create", "edit", "approve", "suspend", "export"],
    documents: ["view", "approve"],
    rides: ["view", "edit", "export", "sensitive"],
    pricing: VIEW,
    support: ["view", "edit"],
    payments: VIEW,
    promotions: ["view", "create", "edit", "suspend"],
    notifications: ["view", "create", "edit"],
    reports: ["view", "export"],
    audit: VIEW,
  },
  // Answers customers and drivers: full support, read-only elsewhere.
  SUPPORT_AGENT: {
    dashboard: VIEW,
    live: VIEW,
    customers: ["view", "edit", "sensitive"],
    drivers: ["view", "sensitive"],
    rides: ["view", "sensitive"],
    support: ["view", "create", "edit", "export", "sensitive"],
    payments: VIEW,
  },
  // Reviews people, vehicles and documents; nothing financial.
  VERIFICATION_OFFICER: {
    dashboard: VIEW,
    drivers: ["view", "approve", "sensitive"],
    fleet: ["view", "approve", "sensitive"],
    vehicles: ["view", "approve"],
    documents: ["view", "approve", "sensitive"],
  },
  // Money: refunds, settlements, payouts, invoices. Sees customers, masked.
  FINANCE_ADMIN: {
    dashboard: ["view", "export"],
    customers: VIEW,
    pricing: VIEW,
    payments: ["view", "export", "refund", "sensitive"],
    commission: ["view", "edit", "export"],
    payouts: ["view", "edit", "approve", "export", "sensitive"],
    invoices: ["view", "create", "export"],
    reports: ["view", "export"],
  },
  // Fleets, their vehicles and drivers.
  FLEET_OPS_MANAGER: {
    dashboard: VIEW,
    live: VIEW,
    drivers: ["view", "edit", "sensitive"],
    fleet: ["view", "edit", "export", "sensitive"],
    vehicles: ["view", "create", "edit", "export"],
    reports: VIEW,
  },
  // Numbers only — no personal data.
  READ_ONLY_ANALYST: {
    dashboard: ["view", "export"],
    reports: ["view", "export"],
  },
};
