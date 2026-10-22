import type { Cents, Page } from "@/types/common";
import type { Payment, PaymentListItem, PaymentListParams } from "@/types/payment";
import { ServiceError } from "@/lib/service-error";
import { inRange, inSet, matchesQuery, paginate, sortRows } from "@/mock/query";
import { actor, audit, authorize, backend, clone, nowIso, requireReason, type Backend } from "./_shared";

/** Payments & refunds — requirements §12. Raw card data is never stored (§12). */

const withName = ({ db }: Backend, p: Payment): PaymentListItem => ({
  ...p,
  customerName: db.customers.get(p.customerId)?.name ?? p.customerId,
});

/**
 * Sort fields: createdAt, amountCents, refundedCents.
 * // API: GET /admin/payments (❌)
 */
export async function listPayments(params: PaymentListParams): Promise<Page<PaymentListItem>> {
  const b = await backend();
  authorize("payments", "view");
  const { db } = b;
  const source = params.customerId
    ? db.ix.rides.paymentsByCustomer.get(params.customerId).map((id) => db.payments.get(id)!)
    : db.payments.all();
  const rows = source.filter(
    (p) =>
      inSet(p.status, params.status) &&
      inSet(p.method, params.method) &&
      (!params.rideId || p.rideId === params.rideId) &&
      (params.reconciled === undefined || p.reconciled === params.reconciled) &&
      inRange(p.createdAt, params.from, params.to) &&
      matchesQuery(params.q, p.id, p.rideId, p.gatewayRef, db.customers.get(p.customerId)?.name),
  );
  const sorted = sortRows(
    rows,
    params.sort,
    { createdAt: (p) => p.createdAt, amountCents: (p) => p.amountCents, refundedCents: (p) => p.refundedCents },
    "createdAt:desc",
  );
  const page = paginate(sorted, params.page, params.pageSize);
  return { ...page, items: page.items.map((p) => withName(b, p)) };
}

/** // API: GET /admin/payments/:id (❌) */
export async function getPayment(id: string): Promise<PaymentListItem> {
  const b = await backend();
  return clone(withName(b, b.db.payments.require(id)));
}

/**
 * Full or partial refund (§12: reason, amount, operator, time and gateway
 * reference are recorded). Never more than what is left to refund.
 * // API: POST /admin/payments/:id/refunds (❌)
 */
export async function refundPayment(id: string, amountCents: Cents, reason: string): Promise<PaymentListItem> {
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
    after: { status, refundedCents, refundId: refund.id, gatewayRef: refund.gatewayRef },
    reason: text,
  });
  return clone(withName(b, next));
}

/** Mark as matched with the gateway settlement file after a manual check. // API: POST /admin/payments/:id/reconcile (❌) */
export async function markPaymentReconciled(id: string, reason: string): Promise<PaymentListItem> {
  const b = await backend();
  const text = requireReason(reason);
  const current = b.db.payments.require(id);
  if (current.reconciled) throw new ServiceError("CONFLICT", "Payment is already reconciled");
  const next = b.db.payments.update(id, { reconciled: true });
  audit(b, { action: "payment.reconcile", resourceType: "payment", resourceId: id, before: { reconciled: false }, after: { reconciled: true }, reason: text });
  return clone(withName(b, next));
}

/** Totals for the payments header (§12 reconciliation). // API: GET /admin/payments/summary (❌) */
export async function getPaymentSummary(params: { from?: string; to?: string }) {
  const { db } = await backend();
  const rows = db.payments.all().filter((p) => inRange(p.createdAt, params.from, params.to));
  const by = (s: Payment["status"]) => rows.filter((p) => p.status === s).length;
  return {
    count: rows.length,
    capturedCents: rows
      .filter((p) => p.status === "SUCCESSFUL" || p.status === "PARTIALLY_REFUNDED" || p.status === "REFUNDED")
      .reduce((s, p) => s + p.amountCents, 0),
    refundedCents: rows.reduce((s, p) => s + p.refundedCents, 0),
    failed: by("FAILED"),
    pending: by("PENDING") + by("PROCESSING"),
    unreconciled: rows.filter((p) => !p.reconciled && p.status !== "PENDING" && p.status !== "PROCESSING").length,
  };
}
