import type { Page } from "@/types/common";
import type { ComplianceDocument, DocumentListItem, DocumentListParams } from "@/types/document";
import { ServiceError } from "@/lib/service-error";
import { DAY, now } from "@/mock/clock";
import { effectiveDocumentStatus } from "@/mock/derive";
import { inRange, inSet, matchesQuery, paginate, sortRows } from "@/mock/query";
import { actor, audit, authorize, backend, clone, nowIso, requireReason, type Backend } from "./_shared";

/** Document verification — requirements §18. Viewing a document is audited (access is restricted). */

function ownerName({ db }: Backend, d: ComplianceDocument) {
  if (d.ownerType === "DRIVER") return db.drivers.get(d.ownerId)?.name ?? d.ownerId;
  if (d.ownerType === "FLEET") return db.fleets.get(d.ownerId)?.companyName ?? d.ownerId;
  const v = db.vehicles.get(d.ownerId);
  return v ? `${v.plate} · ${v.make} ${v.model}` : d.ownerId;
}

/** Status with expiry applied (an approved document past its date is EXPIRED). */
function item(b: Backend, d: ComplianceDocument): DocumentListItem {
  return { ...d, status: effectiveDocumentStatus(d.status, d.expiresAt, now()), ownerName: ownerName(b, d) };
}

/**
 * Pending queue oldest-first by default would be `sort=submittedAt:asc`.
 * Sort fields: submittedAt, expiresAt.
 * // API: GET /kyc/documents/all (✅ drivers only — fleet/vehicle ❌)
 */
export async function listDocuments(params: DocumentListParams): Promise<Page<DocumentListItem>> {
  const b = await backend();
  authorize("documents", "view");
  const { db } = b;
  const nowMs = now();
  const source = params.ownerId ? db.ix.documents.get(params.ownerId).map((id) => db.documents.get(id)!) : db.documents.all();
  const rows = source
    .map((d) => ({ d, status: effectiveDocumentStatus(d.status, d.expiresAt, nowMs) }))
    .filter(
      ({ d, status }) =>
        inSet(status, params.status) &&
        inSet(d.ownerType, params.ownerType) &&
        inSet(d.type, params.type) &&
        inRange(d.submittedAt, params.from, params.to) &&
        (params.expiringWithinDays === undefined ||
          (status === "APPROVED" && !!d.expiresAt && Date.parse(d.expiresAt) - nowMs < params.expiringWithinDays * DAY)) &&
        matchesQuery(params.q, d.id, d.ownerId, d.fileName),
    )
    .map(({ d }) => d);
  const sorted = sortRows(rows, params.sort, { submittedAt: (d) => d.submittedAt, expiresAt: (d) => d.expiresAt }, "submittedAt:desc");
  const page = paginate(sorted, params.page, params.pageSize);
  return { ...page, items: page.items.map((d) => item(b, d)) };
}

/** // API: GET /kyc/documents/:id */
export async function getDocument(id: string): Promise<DocumentListItem> {
  const b = await backend();
  authorize("documents", "view");
  const doc = b.db.documents.require(id);
  audit(b, { action: "document.view", resourceType: "document", resourceId: id });
  return clone(item(b, doc));
}

/** // API: PATCH /kyc/documents/:id/review */
export async function approveDocument(id: string): Promise<DocumentListItem> {
  const b = await backend();
  authorize("documents", "approve");
  const current = b.db.documents.require(id);
  if (current.status !== "PENDING" && current.status !== "REJECTED") throw new ServiceError("CONFLICT", `Cannot approve a document that is ${current.status}`);
  if (current.expiresAt && Date.parse(current.expiresAt) < Date.now()) throw new ServiceError("CONFLICT", "Document has already expired");
  const next = b.db.documents.update(id, (d) => ({
    ...d,
    status: "APPROVED",
    rejectionReason: undefined,
    reviewHistory: [...d.reviewHistory, { status: "APPROVED", at: nowIso(), by: actor().id }],
  }));
  audit(b, { action: "document.approve", resourceType: "document", resourceId: id, before: { status: current.status }, after: { status: "APPROVED" } });
  return clone(item(b, next));
}

/** Rejection always carries the reason the owner will see (§18). // API: PATCH /kyc/documents/:id/review */
export async function rejectDocument(id: string, reason: string): Promise<DocumentListItem> {
  const b = await backend();
  authorize("documents", "approve");
  const text = requireReason(reason);
  const current = b.db.documents.require(id);
  if (current.status !== "PENDING" && current.status !== "APPROVED") throw new ServiceError("CONFLICT", `Cannot reject a document that is ${current.status}`);
  const next = b.db.documents.update(id, (d) => ({
    ...d,
    status: "REJECTED",
    rejectionReason: text,
    reviewHistory: [...d.reviewHistory, { status: "REJECTED", at: nowIso(), by: actor().id, reason: text }],
  }));
  audit(b, { action: "document.reject", resourceType: "document", resourceId: id, before: { status: current.status }, after: { status: "REJECTED" }, reason: text });
  return clone(item(b, next));
}

/** Counts for the verification centre tabs. // API: GET /kyc/documents/summary (❌) */
export async function getDocumentSummary() {
  const { db } = await backend();
  authorize("documents", "view");
  const nowMs = now();
  const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0, EXPIRED: 0, expiringSoon: 0 };
  for (const d of db.documents.all()) {
    const status = effectiveDocumentStatus(d.status, d.expiresAt, nowMs);
    counts[status]++;
    if (status === "APPROVED" && d.expiresAt && Date.parse(d.expiresAt) - nowMs < 30 * DAY) counts.expiringSoon++;
  }
  return counts;
}
