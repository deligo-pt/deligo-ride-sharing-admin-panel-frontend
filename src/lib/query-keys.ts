import type { ReportType } from "@/types/analytics";
import type { DateRange } from "@/types/common";

/**
 * React Query keys as factories (ride_plan.md §D.5). Every key of a module
 * starts with `qk.<module>.all`, so a mutation invalidates the whole module
 * with `queryClient.invalidateQueries({ queryKey: qk.rides.all })`.
 */
function moduleKeys<M extends string>(module: M) {
  const all = [module] as const;
  return {
    all,
    lists: () => [...all, "list"] as const,
    list: <P extends object>(params: P) => [...all, "list", params] as const,
    detail: (id: string) => [...all, "detail", id] as const,
  };
}

export const qk = {
  auth: {
    all: ["auth"] as const,
    demoAccounts: () => ["auth", "demo-accounts"] as const,
    resetToken: (token: string) => ["auth", "reset-token", token] as const,
  },
  dashboard: {
    all: ["dashboard"] as const,
    stats: (range: DateRange) => ["dashboard", "stats", range] as const,
    trends: (range: DateRange) => ["dashboard", "trends", range] as const,
    categories: (range: DateRange) => ["dashboard", "categories", range] as const,
    recentRides: () => ["dashboard", "recent-rides"] as const,
    registrations: () => ["dashboard", "registrations"] as const,
    alerts: () => ["dashboard", "alerts"] as const,
  },
  customers: { ...moduleKeys("customers"), suspensionCheck: (id: string) => ["customers", "suspension-check", id] as const },
  drivers: {
    ...moduleKeys("drivers"),
    earnings: (id: string, from: string, to: string) => ["drivers", "earnings", id, from, to] as const,
    eligibility: (id: string) => ["drivers", "eligibility", id] as const,
    suspensionCheck: (id: string) => ["drivers", "suspension-check", id] as const,
  },
  fleet: {
    ...moduleKeys("fleet"),
    onboarding: (id: string) => ["fleet", "onboarding", id] as const,
    suspensionCheck: (id: string) => ["fleet", "suspension-check", id] as const,
    performance: (id: string, range: DateRange) => ["fleet", "performance", id, range] as const,
  },
  vehicles: {
    ...moduleKeys("vehicles"),
    approval: (id: string) => ["vehicles", "approval", id] as const,
    statusCheck: (id: string) => ["vehicles", "status-check", id] as const,
    drivers: (id: string) => ["vehicles", "drivers", id] as const,
    assignable: (id: string) => ["vehicles", "assignable", id] as const,
  },
  rides: {
    ...moduleKeys("rides"),
    candidates: (id: string) => ["rides", "candidates", id] as const,
    counts: (params: object) => ["rides", "counts", params] as const,
  },
  live: { all: ["live"] as const, snapshot: () => ["live", "snapshot"] as const },
  pricing: {
    ...moduleKeys("pricing"),
    active: () => ["pricing", "active"] as const,
    zones: () => ["pricing", "zones"] as const,
    preview: (input: object) => ["pricing", "preview", input] as const,
  },
  payments: { ...moduleKeys("payments"), summary: (range: DateRange) => ["payments", "summary", range] as const },
  commission: { ...moduleKeys("commission"), rules: () => ["commission", "rules"] as const },
  payouts: moduleKeys("payouts"),
  promotions: {
    ...moduleKeys("promotions"),
    redemptions: (id: string, page: number) => ["promotions", "redemptions", id, page] as const,
    performance: (id: string) => ["promotions", "performance", id] as const,
  },
  support: {
    ...moduleKeys("support"),
    incidents: (params: object) => ["support", "incidents", params] as const,
    incident: (id: string) => ["support", "incident", id] as const,
  },
  notifications: moduleKeys("notifications"),
  reports: { all: ["reports"] as const, report: (type: ReportType, params: object) => ["reports", type, params] as const },
  documents: { ...moduleKeys("documents"), summary: () => ["documents", "summary"] as const },
  invoices: { ...moduleKeys("invoices"), tax: () => ["invoices", "tax"] as const },
  admins: { ...moduleKeys("admins"), roles: () => ["admins", "roles"] as const },
  audit: moduleKeys("audit"),
  settings: {
    all: ["settings"] as const,
    platform: () => ["settings", "platform"] as const,
    gdpr: (params: object) => ["settings", "gdpr", params] as const,
  },
};
