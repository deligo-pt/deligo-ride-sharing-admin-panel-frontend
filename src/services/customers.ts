import type { AdminNote, Page } from "@/types/common";
import type { Customer, CustomerListParams, SuspensionCheck } from "@/types/customer";
import { maskEmail, maskPhone, maskTail } from "@/lib/format";
import { ServiceError } from "@/lib/service-error";
import { inRange, inSet, matchesQuery, paginate, sortRows } from "@/mock/query";
import { ACTIVE_RIDE_STATUSES } from "@/types/ride";
import {
  assertState,
  audit,
  authorize,
  backend,
  clone,
  makeNote,
  requireReason,
  seesPersonalData,
} from "./_shared";
import { toCustomer } from "./_views";

/**
 * Customers — requirements §5. Permissions (P7): `customers.view` to read,
 * `export`, `suspend` (also reactivate), `edit` (notes). Without
 * `customers.sensitive` e-mail, phone and NIF come back masked and search
 * only matches name and ID — like the real API must do.
 */

function present(c: Customer, unmasked: boolean): Customer {
  if (unmasked) return c;
  return {
    ...c,
    email: maskEmail(c.email),
    phone: maskPhone(c.phone),
    nif: c.nif ? maskTail(c.nif) : undefined,
  };
}

/** Filter + sort shared by the list and the export. */
async function query(params: Omit<CustomerListParams, "page" | "pageSize">) {
  const b = await backend();
  authorize("customers", "view");
  const unmasked = seesPersonalData("customers");
  const rows = b.db.customers
    .all()
    .filter(
      (c) =>
        inSet(c.status, params.status) &&
        inSet(c.verification, params.verification) &&
        inRange(c.registeredAt, params.from, params.to) &&
        (unmasked
          ? matchesQuery(params.q, c.name, c.email, c.phone, c.id, c.nif)
          : matchesQuery(params.q, c.name, c.id)),
    )
    .map((c) => present(toCustomer(b, c), unmasked));
  const sorted = sortRows(
    rows,
    params.sort,
    {
      name: (c) => c.name,
      registeredAt: (c) => c.registeredAt,
      totalRides: (c) => c.totalRides,
      totalSpentCents: (c) => c.totalSpentCents,
      status: (c) => c.status,
    },
    "registeredAt:desc",
  );
  return { b, sorted };
}

/**
 * Sort fields: name, registeredAt, totalRides, totalSpentCents, status.
 * // API: GET /admin/users?role=CUSTOMER
 */
export async function listCustomers(params: CustomerListParams): Promise<Page<Customer>> {
  const { sorted } = await query(params);
  return paginate(sorted, params.page, params.pageSize);
}

/**
 * Every customer matching the filters, for CSV/Excel. Exporting personal data
 * is audited (§23).
 * // API: GET /admin/users/export?role=CUSTOMER (❌)
 */
export async function exportCustomers(
  params: Omit<CustomerListParams, "page" | "pageSize">,
): Promise<Customer[]> {
  authorize("customers", "export");
  const { b, sorted } = await query(params);
  audit(b, {
    action: "customer.export",
    resourceType: "customer",
    resourceId: "list",
    after: { rows: sorted.length, filters: { ...params } },
  });
  return clone(sorted);
}

/** // API: GET /admin/users/:id (❌ not in the backend yet) */
export async function getCustomer(id: string): Promise<Customer> {
  const b = await backend();
  authorize("customers", "view");
  return clone(present(toCustomer(b, b.db.customers.require(id)), seesPersonalData("customers")));
}

/** The ride in progress and the unpaid balance — what blocks a suspension. */
function suspensionCheck(b: Awaited<ReturnType<typeof backend>>, id: string): SuspensionCheck {
  const activeRideId = b.db.ix.rides.byCustomer
    .get(id)
    .find((rideId) => ACTIVE_RIDE_STATUSES.includes(b.db.rides.get(rideId)?.status ?? "COMPLETED"));
  const failed = b.db.ix.rides.paymentsByCustomer
    .get(id)
    .map((paymentId) => b.db.payments.get(paymentId))
    .filter((p) => p?.status === "FAILED");
  return {
    activeRideId,
    unpaidCents: failed.reduce((sum, p) => sum + (p?.amountCents ?? 0), 0),
    unpaidCount: failed.length,
  };
}

/**
 * What stops a suspension, so the dialog can say so before the admin writes a
 * reason (§5). The same rules are enforced by `suspendCustomer`.
 * // API: GET /admin/users/:id/suspension-check (❌)
 */
export async function getSuspensionCheck(id: string): Promise<SuspensionCheck> {
  const b = await backend();
  authorize("customers", "suspend");
  b.db.customers.require(id);
  return suspensionCheck(b, id);
}

/**
 * Suspend — refused with CONFLICT while the customer has a ride in progress
 * (field `activeRide`) or an unpaid balance (field `unpaidBalance`, details
 * `amountCents`). Reason required.
 * // API: PATCH /admin/users/:id/status
 */
export async function suspendCustomer(id: string, reason: string): Promise<Customer> {
  const b = await backend();
  authorize("customers", "suspend");
  const text = requireReason(reason);
  const current = b.db.customers.require(id);
  assertState(current.status, ["ACTIVE", "PENDING_VERIFICATION"], "suspend");
  const check = suspensionCheck(b, id);
  if (check.activeRideId)
    throw new ServiceError("CONFLICT", "Customer has a ride in progress", "activeRide", {
      ride: check.activeRideId,
    });
  if (check.unpaidCents > 0)
    throw new ServiceError("CONFLICT", "Customer has an unpaid balance", "unpaidBalance", {
      amountCents: check.unpaidCents,
    });
  const next = b.db.customers.update(id, { status: "SUSPENDED" });
  audit(b, {
    action: "customer.suspend",
    resourceType: "customer",
    resourceId: id,
    before: { status: current.status },
    after: { status: "SUSPENDED" },
    reason: text,
  });
  return clone(present(toCustomer(b, next), seesPersonalData("customers")));
}

/** // API: PATCH /admin/users/:id/status */
export async function reactivateCustomer(id: string, reason: string): Promise<Customer> {
  const b = await backend();
  authorize("customers", "suspend");
  const text = requireReason(reason);
  const current = b.db.customers.require(id);
  assertState(current.status, ["SUSPENDED", "DEACTIVATED"], "reactivate");
  const next = b.db.customers.update(id, { status: "ACTIVE" });
  audit(b, {
    action: "customer.reactivate",
    resourceType: "customer",
    resourceId: id,
    before: { status: current.status },
    after: { status: "ACTIVE" },
    reason: text,
  });
  return clone(present(toCustomer(b, next), seesPersonalData("customers")));
}

/** // API: POST /admin/users/:id/notes (❌) */
export async function addCustomerNote(id: string, text: string): Promise<AdminNote> {
  const b = await backend();
  authorize("customers", "edit");
  const note = makeNote(b, text);
  b.db.customers.update(id, (c) => ({ ...c, notes: [note, ...c.notes] }));
  audit(b, { action: "customer.add_note", resourceType: "customer", resourceId: id });
  return clone(note);
}
