import type { Page } from "@/types/common";
import type { CommissionRule, Settlement, SettlementListParams } from "@/types/finance";
import type { Payout } from "@/types/payout";
import type { RideCategory } from "@/types/vehicle";
import { ServiceError } from "@/lib/service-error";
import { inRange, inSet, matchesQuery, paginate, sortRows } from "@/mock/query";
import { actor, audit, backend, clone, nowIso, requireReason } from "./_shared";

/** Commission & settlements — requirements §12. */

/** All commission rules, current first. // API: GET /admin/finances/commission (❌) */
export async function listCommissionRules(): Promise<CommissionRule[]> {
  const { db } = await backend();
  return clone([...db.commissionRules.all()].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)));
}

/**
 * New rate for a category from a date (today or later). The previous rule
 * gets an end date; past rides keep the rate they were settled with.
 * // API: POST /admin/finances/commission (❌)
 */
export async function createCommissionRule(category: RideCategory, rate: number, effectiveFrom: string, reason: string): Promise<CommissionRule> {
  const b = await backend();
  const text = requireReason(reason);
  if (!(rate > 0 && rate < 0.5)) throw new ServiceError("VALIDATION", "Rate must be between 0% and 50%", "rate");
  const startMs = Date.parse(effectiveFrom);
  if (Number.isNaN(startMs) || startMs < Date.now() - 60_000) throw new ServiceError("VALIDATION", "Start date must be today or later", "effectiveFrom");
  const open = b.db.commissionRules.all().filter((r) => r.category === category && !r.effectiveTo);
  for (const r of open) b.db.commissionRules.update(r.id, { effectiveTo: new Date(startMs).toISOString() });
  const rule = b.db.commissionRules.insert({
    id: `COM-${b.seq.commission.take()}`,
    category,
    rate: Math.round(rate * 1000) / 1000,
    effectiveFrom: new Date(startMs).toISOString(),
    createdBy: actor().id,
    createdAt: nowIso(),
  });
  audit(b, { action: "commission.create", resourceType: "commission", resourceId: rule.id, before: { rate: open[0]?.rate ?? null }, after: { category, rate: rule.rate, effectiveFrom: rule.effectiveFrom }, reason: text });
  return clone(rule);
}

/**
 * Sort fields: periodFrom, netCents, grossCents, rideCount.
 * // API: GET /admin/finances/settlements (❌)
 */
export async function listSettlements(params: SettlementListParams): Promise<Page<Settlement>> {
  const { db } = await backend();
  const source = params.payeeId ? db.ix.finance.settlementsByPayee.get(params.payeeId).map((id) => db.settlements.get(id)!) : db.settlements.all();
  const rows = source.filter(
    (s) =>
      inSet(s.status, params.status) &&
      inSet(s.payeeType, params.payeeType) &&
      inRange(s.periodFrom, params.from, params.to) &&
      matchesQuery(params.q, s.id, s.payeeId, s.payeeName),
  );
  const sorted = sortRows(
    rows,
    params.sort,
    { periodFrom: (s) => s.periodFrom, netCents: (s) => s.netCents, grossCents: (s) => s.grossCents, rideCount: (s) => s.rideCount },
    "periodFrom:desc",
  );
  return paginate(sorted, params.page, params.pageSize);
}

/** // API: GET /admin/finances/settlements/:id (❌) */
export async function getSettlement(id: string): Promise<Settlement> {
  const { db } = await backend();
  return clone(db.settlements.require(id));
}

/**
 * Approve pending settlements: each one with a positive net gets a SEPA
 * payout (PROCESSING). Returns the payouts created.
 * // API: POST /admin/finances/settlements/approve (❌)
 */
export async function approveSettlements(ids: string[]): Promise<Payout[]> {
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
