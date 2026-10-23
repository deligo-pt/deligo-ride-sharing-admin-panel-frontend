import type { Cents, DateRange, Page } from "@/types/common";
import type {
  GatewayMismatch,
  Payment,
  PaymentListItem,
  PaymentListParams,
  PaymentMethod,
  PaymentMethodStat,
  ReconciliationState,
} from "@/types/payment";
import { ServiceError } from "@/lib/service-error";
import { DAY, now } from "@/mock/clock";
import { inRange, inSet, matchesQuery, paginate, sortRows } from "@/mock/query";
import { actor, audit, authorize, backend, clone, nowIso, requireReason, type Backend } from "./_shared";

/** Payments & refunds — requirements §12. Raw card data is never stored (§12). */

/**
 * The gateway's settlement file arrives two days after a payment. A captured
 * payment older than that and not matched is a mismatch for a person to look
 * at; a younger one is just not in the file yet.
 */
const FILE_DELAY_MS = 2 * DAY;

/** Where the payment stands against the gateway's file. Worked out when read, so it never drifts. */
export function reconciliationOf(p: Payment): ReconciliationState {
  if (p.reconciled) return "MATCHED";
  if (p.status === "PENDING" || p.status === "PROCESSING") return "IN_PROGRESS";
  if (p.status === "FAILED") return "NOT_EXPECTED";
  return now() - Date.parse(p.createdAt) > FILE_DELAY_MS ? "MISMATCH" : "AWAITING_FILE";
}

/**
 * What the gateway's file says about a mismatched payment. The sample data
 * only knows "not matched", so the kind is derived from the payment's ID: the
 * same payment always shows the same difference.
 */
function mismatchOf(p: Payment): GatewayMismatch {
  const h = [...p.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  switch (h % 3) {
    case 0:
      return { kind: "MISSING" };
    case 1:
      return { kind: "AMOUNT_DIFFERS", gatewayAmountCents: Math.max(0, p.amountCents - (50 + (h % 7) * 25)) };
    default:
      return { kind: "STATUS_DIFFERS", gatewayStatus: h % 2 ? "PENDING" : "FAILED" };
  }
}

const present = ({ db }: Backend, p: Payment): PaymentListItem => {
  const reconciliation = reconciliationOf(p);
  return {
    ...p,
    refunds: p.refunds.map((r) => ({ ...r, adminName: db.admins.get(r.adminId)?.name ?? r.adminId })),
    customerName: db.customers.get(p.customerId)?.name ?? p.customerId,
    reconciliation,
    mismatch: reconciliation === "MISMATCH" ? mismatchOf(p) : undefined,
  };
};

function filtered(b: Backend, params: Omit<PaymentListParams, "page" | "pageSize">): Payment[] {
  const { db } = b;
  const source = params.customerId
    ? db.ix.rides.paymentsByCustomer.get(params.customerId).map((id) => db.payments.get(id)!)
    : db.payments.all();
  return source.filter(
    (p) =>
      inSet(p.status, params.status) &&
      inSet(p.method, params.method) &&
      (!params.rideId || p.rideId === params.rideId) &&
      (params.reconciled === undefined || p.reconciled === params.reconciled) &&
      (!params.reconciliation?.length || params.reconciliation.includes(reconciliationOf(p))) &&
      inRange(p.createdAt, params.from, params.to) &&
      matchesQuery(params.q, p.id, p.rideId, p.gatewayRef, db.customers.get(p.customerId)?.name),
  );
}

const SORTS = {
  createdAt: (p: Payment) => p.createdAt,
  amountCents: (p: Payment) => p.amountCents,
  refundedCents: (p: Payment) => p.refundedCents,
};

/**
 * Sort fields: createdAt, amountCents, refundedCents.
 * // API: GET /admin/payments (❌)
 */
export async function listPayments(params: PaymentListParams): Promise<Page<PaymentListItem>> {
  authorize("payments", "view");
  const b = await backend();
  const sorted = sortRows(filtered(b, params), params.sort, SORTS, "createdAt:desc");
  const page = paginate(sorted, params.page, params.pageSize);
  return { ...page, items: page.items.map((p) => present(b, p)) };
}

/** Every payment matching the filters, for CSV/Excel. Exporting payments is audited (§23). // API: GET /admin/payments/export (❌) */
export async function exportPayments(params: Omit<PaymentListParams, "page" | "pageSize">): Promise<PaymentListItem[]> {
  authorize("payments", "export");
  const b = await backend();
  const rows = sortRows(filtered(b, params), params.sort, SORTS, "createdAt:desc");
  audit(b, {
    action: "payment.export",
    resourceType: "payment",
    resourceId: "list",
    after: { rows: rows.length, filters: { ...params } },
  });
  return clone(rows.map((p) => present(b, p)));
}

/** // API: GET /admin/payments/:id (❌) */
export async function getPayment(id: string): Promise<PaymentListItem> {
  authorize("payments", "view");
  const b = await backend();
  return clone(present(b, b.db.payments.require(id)));
}

/**
 * Full or partial refund (§12: reason, amount, operator, time and gateway
 * reference are recorded). Never more than what is left to refund. Needs the
 * explicit `refund` permission (Finance, Super Admin).
 * // API: POST /admin/payments/:id/refunds (❌)
 */
export async function refundPayment(id: string, amountCents: Cents, reason: string): Promise<PaymentListItem> {
  authorize("payments", "refund");
  const b = await backend();
  const text = requireReason(reason);
  const current = b.db.payments.require(id);
  if (current.status !== "SUCCESSFUL" && current.status !== "PARTIALLY_REFUNDED") {
    throw new ServiceError("CONFLICT", `Cannot refund a payment that is ${current.status}`);
  }
  if (current.method === "CASH") throw new ServiceError("CONFLICT", "Cash payments are refunded outside the platform");
  const left = current.amountCents - current.refundedCents;
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw new ServiceError("VALIDATION", "Amount must be more than 0", "amountCents");
  if (amountCents > left) throw new ServiceError("VALIDATION", `At most ${left} cents can be refunded`, "amountCents");

  const refundedCents = current.refundedCents + amountCents;
  const status = refundedCents === current.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED";
  const refund = {
    id: `RFD-${b.seq.refund.take()}`,
    amountCents,
    reason: text,
    adminId: actor().id,
    createdAt: nowIso(),
    gatewayRef: `RDQ-R${Date.now().toString(16).toUpperCase().slice(-12)}`,
    status: "SUCCESSFUL" as const,
  };
  const next = b.db.payments.update(id, (p) => ({ ...p, status, refundedCents, refunds: [...p.refunds, refund] }));
  b.db.rides.update(current.rideId, (r) => ({ ...r, payment: { ...r.payment, status } }));
  audit(b, {
    action: "payment.refund",
    resourceType: "payment",
    resourceId: id,
    before: { status: current.status, refundedCents: current.refundedCents },
    after: { status, refundedCents, refundId: refund.id, amountCents, gatewayRef: refund.gatewayRef },
    reason: text,
  });
  return clone(present(b, next));
}

/**
 * Mark a mismatched payment as matched after the person has checked it with
 * the gateway. A manual adjustment, so it needs the `refund` permission too.
 * // API: POST /admin/payments/:id/reconcile (❌)
 */
export async function markPaymentReconciled(id: string, reason: string): Promise<PaymentListItem> {
  authorize("payments", "refund");
  const b = await backend();
  const text = requireReason(reason);
  const current = b.db.payments.require(id);
  if (current.reconciled) throw new ServiceError("CONFLICT", "Payment is already reconciled");
  if (reconciliationOf(current) !== "MISMATCH") {
    throw new ServiceError("CONFLICT", "Only a payment that should be in the gateway's file, and isn't matched, can be marked as reconciled");
  }
  const next = b.db.payments.update(id, { reconciled: true });
  audit(b, { action: "payment.reconcile", resourceType: "payment", resourceId: id, before: { reconciled: false }, after: { reconciled: true }, reason: text });
  return clone(present(b, next));
}

/** Totals for the payments header and the reconciliation tab (§12). // API: GET /admin/payments/summary (❌) */
export async function getPaymentSummary(params: DateRange) {
  authorize("payments", "view");
  const { db } = await backend();
  const rows = db.payments.all().filter((p) => inRange(p.createdAt, params.from, params.to));
  const by = (s: Payment["status"]) => rows.filter((p) => p.status === s).length;
  const state = (s: ReconciliationState) => rows.filter((p) => reconciliationOf(p) === s);
  const mismatched = state("MISMATCH");
  return {
    count: rows.length,
    capturedCents: rows
      .filter((p) => p.status === "SUCCESSFUL" || p.status === "PARTIALLY_REFUNDED" || p.status === "REFUNDED")
      .reduce((s, p) => s + p.amountCents, 0),
    refundedCents: rows.reduce((s, p) => s + p.refundedCents, 0),
    failed: by("FAILED"),
    pending: by("PENDING") + by("PROCESSING"),
    matched: state("MATCHED").length,
    awaitingFile: state("AWAITING_FILE").length,
    notExpected: state("NOT_EXPECTED").length,
    mismatched: mismatched.length,
    mismatchedCents: mismatched.reduce((s, p) => s + p.amountCents, 0),
  };
}

/** Per-method numbers for the Methods tab. // API: GET /admin/payments/methods (❌) */
export async function getPaymentMethodStats(params: DateRange): Promise<PaymentMethodStat[]> {
  authorize("payments", "view");
  const { db } = await backend();
  const stats = new Map<PaymentMethod, PaymentMethodStat>();
  for (const p of db.payments.all()) {
    if (!inRange(p.createdAt, params.from, params.to)) continue;
    const stat = stats.get(p.method) ?? { method: p.method, count: 0, successful: 0, failed: 0, capturedCents: 0 };
    stat.count += 1;
    if (p.status === "FAILED") stat.failed += 1;
    else if (p.status === "SUCCESSFUL" || p.status === "PARTIALLY_REFUNDED" || p.status === "REFUNDED") {
      stat.successful += 1;
      stat.capturedCents += p.amountCents;
    }
    stats.set(p.method, stat);
  }
  return [...stats.values()];
}
