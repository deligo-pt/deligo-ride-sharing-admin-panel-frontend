import type { Page } from "@/types/common";
import type { DriverEarnings, Payout, PayoutListParams } from "@/types/payout";
import { ServiceError } from "@/lib/service-error";
import { lisbonDay } from "@/mock/clock";
import { commissionRateAt } from "@/mock/derive";
import { fareNet } from "@/mock/fare";
import { inRange, inSet, matchesQuery, paginate, sortRows } from "@/mock/query";
import { audit, authorize, backend, clone, requireReason } from "./_shared";

/** Driver earnings & payouts — requirements §13. Figures come from the settled rides, never a separate calculation. */

/**
 * Sort fields: createdAt, amountCents.
 * // API: GET /admin/payouts (❌)
 */
export async function listPayouts(params: PayoutListParams): Promise<Page<Payout>> {
  const { db } = await backend();
  authorize("payouts", "view");
  const source = params.payeeId ? db.ix.finance.payoutsByPayee.get(params.payeeId).map((id) => db.payouts.get(id)!) : db.payouts.all();
  const rows = source.filter(
    (p) =>
      inSet(p.status, params.status) &&
      inSet(p.payeeType, params.payeeType) &&
      inRange(p.createdAt, params.from, params.to) &&
      matchesQuery(params.q, p.id, p.payeeId, p.payeeName, p.reference, p.settlementId),
  );
  const sorted = sortRows(rows, params.sort, { createdAt: (p) => p.createdAt, amountCents: (p) => p.amountCents }, "createdAt:desc");
  return paginate(sorted, params.page, params.pageSize);
}

/** // API: GET /admin/payouts/:id (❌) */
export async function getPayout(id: string): Promise<Payout> {
  const { db } = await backend();
  return clone(db.payouts.require(id));
}

/**
 * Send a failed payout again (usually after the driver fixed their IBAN).
 * // API: POST /admin/payouts/:id/retry (❌)
 */
export async function retryPayout(id: string, reason: string): Promise<Payout> {
  const b = await backend();
  const text = requireReason(reason);
  const current = b.db.payouts.require(id);
  if (current.status !== "FAILED") throw new ServiceError("CONFLICT", `Cannot retry a payout that is ${current.status}`);
  const next = b.db.payouts.update(id, (p) => ({ ...p, status: "PROCESSING", failureReason: undefined, attempts: p.attempts + 1 }));
  b.db.settlements.update(current.settlementId, { status: "PROCESSING" });
  audit(b, { action: "payout.retry", resourceType: "payout", resourceId: id, before: { status: "FAILED", attempts: current.attempts }, after: { status: "PROCESSING", attempts: next.attempts }, reason: text });
  return clone(next);
}

/**
 * Earnings of one driver over a period: gross (fares before VAT), commission
 * at the rate in force, cash already collected, net, and a daily series.
 * // API: GET /admin/drivers/:id/earnings?from&to (❌)
 */
export async function getDriverEarnings(driverId: string, from: string, to: string): Promise<DriverEarnings> {
  const { db } = await backend();
  authorize("payouts", "view");
  db.drivers.require(driverId);
  const daily = new Map<string, { grossCents: number; netCents: number; rides: number }>();
  let gross = 0;
  let commission = 0;
  let deductions = 0;
  let rideCount = 0;
  for (const rideId of db.ix.rides.byDriver.get(driverId)) {
    const ride = db.rides.get(rideId);
    if (!ride || ride.status !== "COMPLETED" || !ride.completedAt || !inRange(ride.completedAt, from, to)) continue;
    const net = fareNet(ride.fareBreakdown);
    const fee = Math.round(net * commissionRateAt(db.commissionRules.all(), ride.rideType, Date.parse(ride.completedAt)));
    const payment = ride.payment.paymentId ? db.payments.get(ride.payment.paymentId) : undefined;
    const cash = payment?.method === "CASH" ? payment.amountCents : 0;
    gross += net;
    commission += fee;
    deductions += cash;
    rideCount++;
    const day = lisbonDay(ride.completedAt);
    const d = daily.get(day) ?? { grossCents: 0, netCents: 0, rides: 0 };
    d.grossCents += net;
    d.netCents += net - fee - cash;
    d.rides++;
    daily.set(day, d);
  }
  return {
    driverId,
    from,
    to,
    rideCount,
    grossCents: gross,
    commissionCents: commission,
    deductionsCents: deductions,
    netCents: gross - commission - deductions,
    daily: [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v })),
  };
}
