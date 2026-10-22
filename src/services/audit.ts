import type { AuditListParams, AuditLog } from "@/types/audit";
import type { Page } from "@/types/common";
import { inRange, inSet, matchesQuery, paginate, sortRows } from "@/mock/query";
import { authorize, backend, clone } from "./_shared";

/**
 * Audit logs — requirements §21. Read-only: there is deliberately no update
 * or delete (entries are written by the other services' mutations).
 */

/**
 * Sort fields: at.
 * // API: GET /admin/audit-logs (❌)
 */
export async function listAuditLogs(params: AuditListParams): Promise<Page<AuditLog>> {
  const { db } = await backend();
  authorize("audit", "view");
  const rows = db.audit.all().filter(
    (a) =>
      (!params.adminId || a.adminId === params.adminId) &&
      inSet(a.resourceType, params.resourceType) &&
      (!params.resourceId || a.resourceId === params.resourceId) &&
      (!params.action || a.action === params.action) &&
      inRange(a.at, params.from, params.to) &&
      matchesQuery(params.q, a.id, a.action, a.resourceId, a.adminName, a.correlationId, a.reason),
  );
  return paginate(sortRows(rows, params.sort, { at: (a) => a.at }, "at:desc"), params.page, params.pageSize);
}

/** // API: GET /admin/audit-logs/:id (❌) */
export async function getAuditLog(id: string): Promise<AuditLog> {
  const { db } = await backend();
  return clone(db.audit.require(id));
}
