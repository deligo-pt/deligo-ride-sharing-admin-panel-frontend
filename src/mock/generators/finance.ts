import type { CommissionRule, Settlement, SettlementStatus } from "@/types/finance";
import type { Payout } from "@/types/payout";
import type { Payment } from "@/types/payment";
import type { Ride } from "@/types/ride";
import type { DriverRecord, FleetRecord } from "../records";
import { DAY, HOUR, iso, now, weekStart } from "../clock";
import { commissionRateAt } from "../derive";
import { fareNet } from "../fare";
import { DEMO } from "../fixtures/demo";
import { payoutId, settlementId } from "../ids";
import { maskIban } from "../pt";
import { chance, digits, int, pick, weighted, withSeed } from "../seed";

export type FinanceBundle = { settlements: Settlement[]; payouts: Payout[] };

type Inputs = {
  rides: readonly Ride[];
  payments: readonly Payment[];
  drivers: readonly DriverRecord[];
  fleets: readonly FleetRecord[];
  commissionRules: readonly CommissionRule[];
};

const PAYOUT_FAILURES = [
  "IBAN rejeitado pelo banco (AC01 — número de conta incorreto).",
  "Conta encerrada (AC04).",
  "Nome do beneficiário não coincide com o titular da conta.",
];

/**
 * Weekly settlements per payee (independent driver, or the fleet for its
 * drivers) for every finished week, and a SEPA payout for each one sent.
 * gross = fares before VAT; commission = rate × gross; deductions = cash the
 * driver already collected; net = gross − commission − deductions.
 */
export function generateFinance(input: Inputs): FinanceBundle {
  return withSeed("finance", () => {
    const nowMs = now();
    const currentWeek = weekStart(nowMs);
    const paymentById = new Map(input.payments.map((p) => [p.id, p]));
    const driverById = new Map(input.drivers.map((d) => [d.id, d]));
    const fleetById = new Map(input.fleets.map((f) => [f.id, f]));

    type Acc = { payeeType: "DRIVER" | "FLEET"; payeeId: string; week: number; rides: number; gross: number; commission: number; deductions: number };
    const groups = new Map<string, Acc>();
    for (const ride of input.rides) {
      if (ride.status !== "COMPLETED" || !ride.driverId || !ride.completedAt) continue;
      const doneMs = Date.parse(ride.completedAt);
      const week = weekStart(doneMs);
      if (week >= currentWeek) continue; // the running week is settled next Monday
      const payeeType = ride.fleetManagerId ? "FLEET" : "DRIVER";
      const payeeId = ride.fleetManagerId ?? ride.driverId;
      const key = `${payeeId}|${week}`;
      const acc = groups.get(key) ?? { payeeType, payeeId, week, rides: 0, gross: 0, commission: 0, deductions: 0 };
      const net = fareNet(ride.fareBreakdown);
      acc.rides += 1;
      acc.gross += net;
      acc.commission += Math.round(net * commissionRateAt(input.commissionRules, ride.rideType, doneMs));
      const payment = ride.payment.paymentId ? paymentById.get(ride.payment.paymentId) : undefined;
      if (payment?.method === "CASH") acc.deductions += payment.amountCents;
      groups.set(key, acc);
    }

    const lastWeek = currentWeek - 7 * DAY;
    const sorted = [...groups.values()].sort((a, b) => a.week - b.week || a.payeeId.localeCompare(b.payeeId));
    const settlements: Settlement[] = [];
    const payouts: Payout[] = [];

    sorted.forEach((g, i) => {
      const weeksAgo = Math.round((lastWeek - g.week) / (7 * DAY));
      const netCents = g.gross - g.commission - g.deductions;
      let status: SettlementStatus =
        weeksAgo === 0
          ? "PENDING"
          : weeksAgo === 1
            ? weighted<SettlementStatus>([["COMPLETED", 90], ["PROCESSING", 8], ["FAILED", 2]])
            : chance(0.012)
              ? "FAILED"
              : "COMPLETED";
      if (g.payeeId === DEMO.driverFailedPayout && weeksAgo === 1) status = "FAILED";
      if (netCents <= 0 && status !== "PENDING") status = "COMPLETED";

      const driver = g.payeeType === "DRIVER" ? driverById.get(g.payeeId) : undefined;
      const fleet = g.payeeType === "FLEET" ? fleetById.get(g.payeeId) : undefined;
      const payeeName = driver?.name ?? fleet?.companyName ?? g.payeeId;
      const createdMs = g.week + 7 * DAY + 6 * HOUR;
      const id = settlementId(i);

      let payout: Payout | undefined;
      if (status !== "PENDING" && netCents > 0) {
        const payoutStatus = status === "COMPLETED" ? "SUCCESSFUL" : status === "PROCESSING" ? "PROCESSING" : "FAILED";
        const sentMs = createdMs + DAY + int(2, 6) * HOUR;
        payout = {
          id: payoutId(payouts.length),
          payeeType: g.payeeType,
          payeeId: g.payeeId,
          payeeName,
          settlementId: id,
          amountCents: netCents,
          ibanMasked: maskIban(driver?.iban ?? fleet?.iban ?? "PT500000000000000000000000"),
          status: payoutStatus,
          reference: payoutStatus === "FAILED" ? undefined : `SEPA-${digits(12)}`,
          failureReason: payoutStatus === "FAILED" ? (g.payeeId === DEMO.driverFailedPayout ? PAYOUT_FAILURES[0] : pick(PAYOUT_FAILURES)) : undefined,
          createdAt: iso(Math.min(sentMs, nowMs - HOUR)),
          paidAt: payoutStatus === "SUCCESSFUL" ? iso(Math.min(sentMs + DAY, nowMs - HOUR)) : undefined,
          attempts: payoutStatus === "FAILED" ? int(1, 3) : 1,
        };
        payouts.push(payout);
      }

      settlements.push({
        id,
        payeeType: g.payeeType,
        payeeId: g.payeeId,
        payeeName,
        periodFrom: iso(g.week),
        periodTo: iso(g.week + 7 * DAY - 1),
        rideCount: g.rides,
        grossCents: g.gross,
        commissionCents: g.commission,
        deductionsCents: g.deductions,
        netCents,
        status,
        createdAt: iso(Math.min(createdMs, nowMs - HOUR)),
        payoutId: payout?.id,
      });
    });
    return { settlements, payouts };
  });
}
