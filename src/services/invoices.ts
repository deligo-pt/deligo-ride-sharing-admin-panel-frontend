import type { Page } from "@/types/common";
import type { Invoice, InvoiceListParams, TaxSummary } from "@/types/invoice";
import { ServiceError } from "@/lib/service-error";
import { inRange, inSet, matchesQuery, paginate, sortRows } from "@/mock/query";
import { audit, authorize, backend, clone, nowIso } from "./_shared";

/**
 * Invoices & tax — requirements §19. Read-only view of what the certified
 * invoicing provider issued; the admin panel is not the invoicing software.
 */

/**
 * Sort fields: issuedAt, totalCents, number.
 * // API: GET /admin/invoices (❌ — provider not chosen)
 */
export async function listInvoices(params: InvoiceListParams): Promise<Page<Invoice>> {
  const { db } = await backend();
  authorize("invoices", "view");
  const source = params.customerId ? db.ix.rides.invoicesByCustomer.get(params.customerId).map((id) => db.invoices.get(id)!) : db.invoices.all();
  const rows = source.filter(
    (i) =>
      inSet(i.status, params.status) &&
      (!params.rideId || i.rideId === params.rideId) &&
      inRange(i.issuedAt, params.from, params.to) &&
      matchesQuery(params.q, i.number, i.rideId, i.customerName, i.customerNif, i.atcud),
  );
  const sorted = sortRows(rows, params.sort, { issuedAt: (i) => i.issuedAt, totalCents: (i) => i.totalCents, number: (i) => i.number }, "issuedAt:desc");
  return paginate(sorted, params.page, params.pageSize);
}

/** // API: GET /admin/invoices/:id (❌) */
export async function getInvoice(id: string): Promise<Invoice> {
  const { db } = await backend();
  return clone(db.invoices.require(id));
}

/** Try issuing a failed invoice again (simulated success). // API: POST /admin/invoices/:id/retry (❌) */
export async function retryInvoice(id: string): Promise<Invoice> {
  const b = await backend();
  const current = b.db.invoices.require(id);
  if (current.status !== "FAILED") throw new ServiceError("CONFLICT", `Invoice is ${current.status}`);
  const seq = Number(current.number.split("/")[1]);
  const next = b.db.invoices.update(id, { status: "ISSUED", failureReason: undefined, atcud: `JJ3K7M2P-${seq}`, issuedAt: nowIso() });
  audit(b, { action: "invoice.retry", resourceType: "invoice", resourceId: id, before: { status: "FAILED" }, after: { status: "ISSUED" } });
  return clone(next);
}

/** VAT per month for the accountant (newest first). // API: GET /admin/invoices/tax-summary (❌) */
export async function getTaxSummary(): Promise<TaxSummary[]> {
  const { db } = await backend();
  const months = new Map<string, TaxSummary>();
  for (const inv of db.invoices.all()) {
    const month = inv.issuedAt.slice(0, 7);
    const m = months.get(month) ?? { month, invoiceCount: 0, netCents: 0, vatCents: 0, totalCents: 0, failedCount: 0 };
    if (inv.status === "ISSUED") {
      m.invoiceCount++;
      m.netCents += inv.netCents;
      m.vatCents += inv.vatCents;
      m.totalCents += inv.totalCents;
    } else if (inv.status === "FAILED") m.failedCount++;
    months.set(month, m);
  }
  return [...months.values()].sort((a, b) => b.month.localeCompare(a.month));
}
