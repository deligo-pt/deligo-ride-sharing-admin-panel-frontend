import type { Page } from "@/types/common";
import type { GdprListParams, GdprRequest, GdprRequestStatus, PlatformSettings } from "@/types/settings";
import { ServiceError } from "@/lib/service-error";
import { inSet, matchesQuery, paginate, sortRows } from "@/mock/query";
import { actor, audit, backend, clone, diff, nowIso, requireReason } from "./_shared";

/** Settings, localization & GDPR — requirements §22, §23. */

/** // API: GET /admin/settings (❌) */
export async function getSettings(): Promise<PlatformSettings> {
  const { db } = await backend();
  return clone(db.settings.value);
}

type SettingsPatch = Partial<Omit<PlatformSettings, "updatedAt" | "updatedBy" | "localization">>;

/**
 * Update one or more sections. `gatewayConfigured` comes from the backend and
 * cannot be changed; a method can only be enabled when its gateway is
 * configured (§12).
 * // API: PATCH /admin/settings (❌)
 */
export async function updateSettings(patch: SettingsPatch, reason: string): Promise<PlatformSettings> {
  const b = await backend();
  const text = requireReason(reason);
  const current = b.db.settings.value;
  const paymentMethods = patch.paymentMethods?.map((m) => {
    const configured = current.paymentMethods.find((c) => c.method === m.method)?.gatewayConfigured ?? false;
    if (m.enabled && !configured) throw new ServiceError("VALIDATION", `${m.method} has no configured gateway`, "paymentMethods");
    return { ...m, gatewayConfigured: configured };
  });
  if (patch.rideTypes && !patch.rideTypes.some((r) => r.enabled)) throw new ServiceError("VALIDATION", "At least one ride type must stay enabled", "rideTypes");
  if (patch.security && patch.security.sessionTimeoutMinutes < 5) throw new ServiceError("VALIDATION", "Session timeout: at least 5 minutes", "security.sessionTimeoutMinutes");
  if (patch.privacy && patch.privacy.invoiceRetentionYears < 10) {
    // Portuguese tax law: invoices are kept for 10 years.
    throw new ServiceError("VALIDATION", "Invoices must be kept at least 10 years", "privacy.invoiceRetentionYears");
  }
  const next: PlatformSettings = {
    ...current,
    ...patch,
    ...(paymentMethods ? { paymentMethods } : {}),
    updatedAt: nowIso(),
    updatedBy: actor().id,
  };
  b.db.settings.value = next;
  const { updatedAt: _a, updatedBy: _b, ...before } = current;
  const { updatedAt: _c, updatedBy: _d, ...after } = next;
  audit(b, { action: "settings.update", resourceType: "settings", resourceId: "platform", ...diff(before, after), reason: text });
  return clone(next);
}

/**
 * Sort fields: receivedAt, dueAt.
 * // API: GET /admin/gdpr/requests (❌)
 */
export async function listGdprRequests(params: GdprListParams): Promise<Page<GdprRequest>> {
  const { db } = await backend();
  const rows = db.gdpr.all().filter((r) => inSet(r.status, params.status) && inSet(r.type, params.type) && matchesQuery(params.q, r.id, r.subjectId, r.subjectName));
  return paginate(sortRows(rows, params.sort, { receivedAt: (r) => r.receivedAt, dueAt: (r) => r.dueAt }, "receivedAt:desc"), params.page, params.pageSize);
}

/**
 * Move a request along. Completing an ERASURE anonymises the customer but
 * keeps rides, payments and invoices (legal retention, §23).
 * // API: PATCH /admin/gdpr/requests/:id (❌)
 */
export async function updateGdprRequest(id: string, status: GdprRequestStatus, note: string): Promise<GdprRequest> {
  const b = await backend();
  const text = requireReason(note);
  const current = b.db.gdpr.require(id);
  if (current.status === "COMPLETED" || current.status === "REJECTED") throw new ServiceError("CONFLICT", "Request is already closed");
  if (status === current.status) throw new ServiceError("CONFLICT", `Request is already ${status}`);
  const at = nowIso();
  if (status === "COMPLETED" && current.type === "ERASURE" && current.subjectType === "CUSTOMER") {
    const c = b.db.customers.get(current.subjectId);
    if (c) {
      b.db.customers.update(c.id, {
        name: `Cliente anonimizado ${c.id.slice(-4)}`,
        email: `anon-${c.id.toLowerCase()}@deleted.deligo.pt`,
        phone: "+351000000000",
        status: "DEACTIVATED",
        notes: [],
      });
    }
  }
  const next = b.db.gdpr.update(id, {
    status,
    handledBy: actor().id,
    completedAt: status === "COMPLETED" || status === "REJECTED" ? at : undefined,
    note: text,
  });
  audit(b, { action: `gdpr.${status.toLowerCase()}`, resourceType: "gdpr", resourceId: id, before: { status: current.status }, after: { status }, reason: text });
  return clone(next);
}

/**
 * Everything held about a customer, for an ACCESS or PORTABILITY request.
 * The screen offers it as a JSON download. Audited.
 * // API: GET /admin/gdpr/export/:subjectId (❌)
 */
export async function exportSubjectData(customerId: string) {
  const b = await backend();
  const { db } = b;
  const customer = db.customers.require(customerId);
  const data = {
    exportedAt: nowIso(),
    customer,
    rides: db.ix.rides.byCustomer.get(customerId).map((id) => db.rides.get(id)),
    payments: db.ix.rides.paymentsByCustomer.get(customerId).map((id) => db.payments.get(id)),
    invoices: db.ix.rides.invoicesByCustomer.get(customerId).map((id) => db.invoices.get(id)),
    tickets: db.ix.support.ticketsByCustomer.get(customerId).map((id) => db.tickets.get(id)),
  };
  audit(b, { action: "gdpr.export", resourceType: "gdpr", resourceId: customerId });
  return clone(data);
}
