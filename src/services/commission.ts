import type { Cents, DateRange, ListParams, Page } from "@/types/common";
import type {
  CommissionRule,
  CommissionRuleStatus,
  CommissionRuleView,
  Settlement,
  SettlementListParams,
  SettlementRide,
  SettlementRidesPage,
  SettlementSummary,
} from "@/types/finance";
import type { Payout } from "@/types/payout";
import type { RideCategory } from "@/types/vehicle";
import { ServiceError } from "@/lib/service-error";
import { weekStart } from "@/mock/clock";
import { commissionRateAt } from "@/mock/derive";
import { fareNet } from "@/mock/fare";
import { inRange, inSet, matchesQuery, paginate, sortRows } from "@/mock/query";
import { actor, audit, authorize, backend, clone, nowIso, requireReason, type Backend } from "./_shared";

/**
 * Commission & settlements — requirements §12. Reads need `commission.view`,
 * rate changes, withdrawals and adjustments `commission.edit`, exports
 * `commission.export`; approving settlements creates payouts, so it needs
 * `payouts.approve` (Finance, Super Admin).
 */

/** The most one manual adjustment may move a settlement, either way. */
export const ADJUSTMENT_LIMIT_CENTS: Cents = 100_000;

/** The furthest ahead a rate change can be scheduled. */
const MAX_AHEAD_MS = 366 * 24 * 60 * 60 * 1000;

const ruleStatus = (r: CommissionRule, at = Date.now()): CommissionRuleStatus =>
  r.withdrawn
    ? "WITHDRAWN"
    : Date.parse(r.effectiveFrom) > at
      ? "SCHEDULED"
      : r.effectiveTo && Date.parse(r.effectiveTo) <= at
        ? "ENDED"
        : "ACTIVE";

const ruleView = ({ db }: Backend, r: CommissionRule): CommissionRuleView => ({
  ...r,
  status: ruleStatus(r),
  createdByName: db.admins.get(r.createdBy)?.name ?? r.createdBy,
});

/** All commission rules, newest start first, with who set each and where it stands. // API: GET /admin/finances/commission (❌) */
export async function listCommissionRules(): Promise<CommissionRuleView[]> {
  authorize("commission", "view");
  const b = await backend();
  return clone(
    [...b.db.commissionRules.all()]
      .sort((a, b2) => b2.effectiveFrom.localeCompare(a.effectiveFrom) || b2.createdAt.localeCompare(a.createdAt))
      .map((r) => ruleView(b, r)),
  );
}

/**
 * New rate for a category, from now or from a later date (up to a year ahead).
 * The rule in force then gets an end date; rides and settlements already made
 * keep the rate they were made with. One scheduled change per category at a
 * time (withdraw it first to replace it).
 * // API: POST /admin/finances/commission (❌)
 */
export async function createCommissionRule(category: RideCategory, rate: number, effectiveFrom: string, reason: string): Promise<CommissionRuleView> {
  authorize("commission", "edit");
  const b = await backend();
  const text = requireReason(reason);
  if (!(rate > 0 && rate < 0.5)) throw new ServiceError("VALIDATION", "Rate must be between 0% and 50%", "rate");
  const rounded = Math.round(rate * 1000) / 1000;
  const startMs = Date.parse(effectiveFrom);
  if (Number.isNaN(startMs) || startMs < Date.now() - 60_000) throw new ServiceError("VALIDATION", "Start date must be today or later", "effectiveFrom");
  if (startMs > Date.now() + MAX_AHEAD_MS) throw new ServiceError("VALIDATION", "Start date can be at most a year ahead", "effectiveFrom");

  const rules = b.db.commissionRules.all().filter((r) => r.category === category && !r.withdrawn);
  if (rules.some((r) => ruleStatus(r) === "SCHEDULED")) {
    throw new ServiceError("CONFLICT", "A change is already scheduled for this category; withdraw it first", "category");
  }
  const open = rules.filter((r) => !r.effectiveTo);
  if (open.some((r) => r.rate === rounded)) throw new ServiceError("VALIDATION", "That is already the rate in force", "rate");
  for (const r of open) b.db.commissionRules.update(r.id, { effectiveTo: new Date(startMs).toISOString() });
  const rule = b.db.commissionRules.insert({
    id: `COM-${b.seq.commission.take()}`,
    category,
    rate: rounded,
    effectiveFrom: new Date(startMs).toISOString(),
    createdBy: actor().id,
    createdAt: nowIso(),
    reason: text,
  });
  audit(b, {
    action: "commission.create",
    resourceType: "commission",
    resourceId: rule.id,
    before: { rate: open[0]?.rate ?? null },
    after: { category, rate: rule.rate, effectiveFrom: rule.effectiveFrom },
    reason: text,
  });
  return clone(ruleView(b, rule));
}

/**
 * Cancel a rate change that has not started. It stays in the history as
 * withdrawn, and the rate before it carries on.
 * // API: POST /admin/finances/commission/:id/withdraw (❌)
 */
export async function withdrawCommissionRule(id: string, reason: string): Promise<CommissionRuleView> {
  authorize("commission", "edit");
  const b = await backend();
  const text = requireReason(reason);
  const rule = b.db.commissionRules.require(id);
  if (ruleStatus(rule) !== "SCHEDULED") throw new ServiceError("CONFLICT", "Only a change that has not started can be withdrawn");
  const next = b.db.commissionRules.update(id, { withdrawn: true, effectiveTo: rule.effectiveFrom });
  for (const r of b.db.commissionRules.all()) {
    if (r.category === rule.category && r.id !== id && !r.withdrawn && r.effectiveTo === rule.effectiveFrom) {
      b.db.commissionRules.update(r.id, { effectiveTo: undefined });
    }
  }
  audit(b, { action: "commission.withdraw", resourceType: "commission", resourceId: id, before: { rate: rule.rate, effectiveFrom: rule.effectiveFrom }, after: { withdrawn: true }, reason: text });
  return clone(ruleView(b, next));
}

/** The settlement with the admins' names beside their adjustments. */
const present = ({ db }: Backend, s: Settlement): Settlement => ({
  ...s,
  adjustments: s.adjustments?.map((a) => ({ ...a, adminName: db.admins.get(a.adminId)?.name ?? a.adminId })),
});

function filtered(b: Backend, params: Omit<SettlementListParams, "page" | "pageSize">): Settlement[] {
  const { db } = b;
  const source = params.payeeId ? db.ix.finance.settlementsByPayee.get(params.payeeId).map((id) => db.settlements.get(id)!) : db.settlements.all();
  return source.filter(
    (s) =>
      inSet(s.status, params.status) &&
      inSet(s.payeeType, params.payeeType) &&
      inRange(s.periodFrom, params.from, params.to) &&
      matchesQuery(params.q, s.id, s.payeeId, s.payeeName),
  );
}

const SORTS = {
  periodFrom: (s: Settlement) => s.periodFrom,
  netCents: (s: Settlement) => s.netCents,
  grossCents: (s: Settlement) => s.grossCents,
  commissionCents: (s: Settlement) => s.commissionCents,
  rideCount: (s: Settlement) => s.rideCount,
};

/**
 * Sort fields: periodFrom, netCents, grossCents, commissionCents, rideCount.
 * // API: GET /admin/finances/settlements (❌)
 */
export async function listSettlements(params: SettlementListParams): Promise<Page<Settlement>> {
  authorize("commission", "view");
  const b = await backend();
  const sorted = sortRows(filtered(b, params), params.sort, SORTS, "periodFrom:desc");
  const page = paginate(sorted, params.page, params.pageSize);
  return { ...page, items: page.items.map((s) => present(b, s)) };
}

/** Every settlement matching the filters, for CSV/Excel (the financial statement). Audited. // API: GET /admin/finances/settlements/export (❌) */
export async function exportSettlements(params: Omit<SettlementListParams, "page" | "pageSize">): Promise<Settlement[]> {
  authorize("commission", "export");
  const b = await backend();
  const rows = sortRows(filtered(b, params), params.sort, SORTS, "periodFrom:desc");
  audit(b, { action: "settlement.export", resourceType: "settlement", resourceId: "list", after: { rows: rows.length, filters: { ...params } } });
  return clone(rows.map((s) => present(b, s)));
}

/** // API: GET /admin/finances/settlements/:id (❌) */
export async function getSettlement(id: string): Promise<Settlement> {
  authorize("commission", "view");
  const b = await backend();
  return clone(present(b, b.db.settlements.require(id)));
}

/** Numbers for the settlements cards: counts and sums by status over the period. // API: GET /admin/finances/settlements/summary (❌) */
export async function getSettlementSummary(params: DateRange): Promise<SettlementSummary> {
  authorize("commission", "view");
  const { db } = await backend();
  const rows = db.settlements.all().filter((s) => inRange(s.periodFrom, params.from, params.to));
  const of = (status: Settlement["status"]) => rows.filter((s) => s.status === status);
  const sum = (list: Settlement[], pick: (s: Settlement) => number) => list.reduce((total, s) => total + pick(s), 0);
  return {
    count: rows.length,
    grossCents: sum(rows, (s) => s.grossCents),
    commissionCents: sum(rows, (s) => s.commissionCents),
    pendingCount: of("PENDING").length,
    pendingNetCents: sum(of("PENDING"), (s) => s.netCents),
    processingCount: of("PROCESSING").length,
    completedCount: of("COMPLETED").length,
    completedNetCents: sum(of("COMPLETED"), (s) => s.netCents),
    failedCount: of("FAILED").length,
  };
}

/**
 * The rides a settlement is made of: completed rides of the payee (the fleet's,
 * or the independent driver's own) finished in its week, each with the
 * commission rate that was in force when it finished. The lines add up to the
 * settlement's gross, commission and cash deductions.
 */
function ridesOf(b: Backend, s: Settlement): SettlementRide[] {
  const { db } = b;
  const ids = s.payeeType === "FLEET" ? db.ix.rides.byFleet.get(s.payeeId) : db.ix.rides.byDriver.get(s.payeeId);
  const week = Date.parse(s.periodFrom);
  const rules = db.commissionRules.all();
  const rows: SettlementRide[] = [];
  for (const id of ids) {
    const ride = db.rides.get(id);
    if (!ride || ride.status !== "COMPLETED" || !ride.completedAt || !ride.driverId) continue;
    if (s.payeeType === "DRIVER" && ride.fleetManagerId) continue;
    const doneMs = Date.parse(ride.completedAt);
    if (weekStart(doneMs) !== week) continue;
    const net = fareNet(ride.fareBreakdown);
    const rate = commissionRateAt(rules, ride.rideType, doneMs);
    const commissionCents = Math.round(net * rate);
    const payment = ride.payment.paymentId ? db.payments.get(ride.payment.paymentId) : undefined;
    rows.push({
      rideId: ride.id,
      completedAt: ride.completedAt,
      category: ride.rideType,
      driverName: db.drivers.get(ride.driverId)?.name,
      fareNetCents: net,
      rate,
      commissionCents,
      earningsCents: net - commissionCents,
      method: ride.payment.method,
      cashCollectedCents: payment?.method === "CASH" ? payment.amountCents : 0,
    });
  }
  return rows;
}

const RIDE_SORTS = {
  completedAt: (r: SettlementRide) => r.completedAt,
  fareNetCents: (r: SettlementRide) => r.fareNetCents,
  commissionCents: (r: SettlementRide) => r.commissionCents,
  earningsCents: (r: SettlementRide) => r.earningsCents,
};

const totalsOf = (rows: SettlementRide[]) => ({
  count: rows.length,
  fareNetCents: rows.reduce((t, r) => t + r.fareNetCents, 0),
  commissionCents: rows.reduce((t, r) => t + r.commissionCents, 0),
  earningsCents: rows.reduce((t, r) => t + r.earningsCents, 0),
  cashCollectedCents: rows.reduce((t, r) => t + r.cashCollectedCents, 0),
});

/**
 * The per-ride commission breakdown of a settlement, with totals over all its
 * rides (not just the page). Sort fields: completedAt, fareNetCents,
 * commissionCents, earningsCents.
 * // API: GET /admin/finances/settlements/:id/rides (❌)
 */
export async function listSettlementRides(id: string, params: ListParams): Promise<SettlementRidesPage> {
  authorize("commission", "view");
  const b = await backend();
  const rows = ridesOf(b, b.db.settlements.require(id));
  const sorted = sortRows(rows, params.sort, RIDE_SORTS, "completedAt:desc");
  return clone({ ...paginate(sorted, params.page, params.pageSize), totals: totalsOf(rows) });
}

/**
 * One settlement as a financial statement: the settlement and every ride line,
 * for CSV/Excel. Audited. // API: GET /admin/finances/settlements/:id/statement (❌)
 */
export async function exportSettlementStatement(id: string): Promise<{ settlement: Settlement; rides: SettlementRide[] }> {
  authorize("commission", "export");
  const b = await backend();
  const settlement = b.db.settlements.require(id);
  const rides = sortRows(ridesOf(b, settlement), "completedAt:asc", RIDE_SORTS, "completedAt:asc");
  audit(b, { action: "settlement.export", resourceType: "settlement", resourceId: id, after: { rides: rides.length } });
  return clone({ settlement: present(b, settlement), rides });
}

/**
 * ⚠ A manual credit (positive) or deduction (negative) on a settlement that is
 * still pending (§12: reason, amount, operator and time are recorded). Moves
 * the net amount the payee will be paid; at most €1 000 each time.
 * // API: POST /admin/finances/settlements/:id/adjustments (❌)
 */
export async function adjustSettlement(id: string, amountCents: Cents, reason: string): Promise<Settlement> {
  authorize("commission", "edit");
  const b = await backend();
  const text = requireReason(reason);
  const current = b.db.settlements.require(id);
  if (current.status !== "PENDING") throw new ServiceError("CONFLICT", "Only a pending settlement can be adjusted");
  if (!Number.isInteger(amountCents) || amountCents === 0) throw new ServiceError("VALIDATION", "Amount must be more than 0", "amountCents");
  if (Math.abs(amountCents) > ADJUSTMENT_LIMIT_CENTS) {
    throw new ServiceError("VALIDATION", `An adjustment can be at most ${ADJUSTMENT_LIMIT_CENTS} cents either way`, "amountCents");
  }
  const adjustment = { id: `ADJ-${b.seq.adjustment.take()}`, amountCents, reason: text, adminId: actor().id, createdAt: nowIso() };
  const adjustmentsCents = (current.adjustmentsCents ?? 0) + amountCents;
  const netCents = current.netCents + amountCents;
  const next = b.db.settlements.update(id, { adjustments: [...(current.adjustments ?? []), adjustment], adjustmentsCents, netCents });
  audit(b, {
    action: "settlement.adjust",
    resourceType: "settlement",
    resourceId: id,
    before: { netCents: current.netCents, adjustmentsCents: current.adjustmentsCents ?? 0 },
    after: { netCents, adjustmentsCents, adjustmentId: adjustment.id, amountCents },
    reason: text,
  });
  return clone(present(b, next));
}

/**
 * Approve pending settlements: each one with a positive net gets a SEPA
 * payout (PROCESSING). Returns the payouts created. Needs `payouts.approve`.
 * // API: POST /admin/finances/settlements/approve (❌)
 */
export async function approveSettlements(ids: string[]): Promise<Payout[]> {
  authorize("payouts", "approve");
  const b = await backend();
  const { db } = b;
  if (!ids.length) throw new ServiceError("VALIDATION", "Select at least one settlement", "ids");
  const created: Payout[] = [];
  for (const id of ids) {
    const s = db.settlements.require(id);
    if (s.status !== "PENDING") throw new ServiceError("CONFLICT", `Settlement ${id} is ${s.status}`);
  }
  for (const id of ids) {
    const s = db.settlements.require(id);
    let payoutId: string | undefined;
    if (s.netCents > 0) {
      const payee = s.payeeType === "DRIVER" ? db.drivers.get(s.payeeId) : db.fleets.get(s.payeeId);
      const iban = payee?.iban ?? "PT500000000000000000000000";
      payoutId = `PO-${70000 + db.payouts.size}`;
      const payout: Payout = {
        id: payoutId,
        payeeType: s.payeeType,
        payeeId: s.payeeId,
        payeeName: s.payeeName,
        settlementId: id,
        amountCents: s.netCents,
        ibanMasked: `${iban.slice(0, 4)} •••• •••• •••• ${iban.slice(-5, -1)} ${iban.slice(-1)}`,
        status: "PROCESSING",
        createdAt: nowIso(),
        attempts: 1,
      };
      db.payouts.insert(payout);
      db.ix.finance.payoutsByPayee.add(s.payeeId, payoutId);
      created.push(payout);
    }
    db.settlements.update(id, { status: s.netCents > 0 ? "PROCESSING" : "COMPLETED", payoutId });
    audit(b, { action: "settlement.approve", resourceType: "settlement", resourceId: id, before: { status: "PENDING" }, after: { status: s.netCents > 0 ? "PROCESSING" : "COMPLETED", payoutId: payoutId ?? null } });
  }
  return clone(created);
}
