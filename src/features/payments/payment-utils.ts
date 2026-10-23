import type { Cents } from "@/types/common";
import type { Payment, PaymentMethod, PaymentStatus } from "@/types/payment";

export const PAYMENT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SUCCESSFUL",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
] as const satisfies readonly PaymentStatus[];

export const PAYMENT_METHODS = [
  "CARD",
  "MB_WAY",
  "APPLE_PAY",
  "GOOGLE_PAY",
  "WALLET",
  "CASH",
] as const satisfies readonly PaymentMethod[];

/** What is still refundable on a payment. */
export const leftToRefund = (p: Pick<Payment, "amountCents" | "refundedCents">): Cents =>
  p.amountCents - p.refundedCents;

/**
 * Why a payment can't be refunded, or null when it can: cash is settled with
 * the driver (no gateway), only captured payments are refundable, and a fully
 * refunded one has nothing left. The service enforces the same rules.
 */
export type RefundBlock = "cash" | "status" | "full";
export function refundBlock(p: Pick<Payment, "method" | "status">): RefundBlock | null {
  if (p.status === "REFUNDED") return "full";
  if (p.method === "CASH") return "cash";
  if (p.status !== "SUCCESSFUL" && p.status !== "PARTIALLY_REFUNDED") return "status";
  return null;
}
