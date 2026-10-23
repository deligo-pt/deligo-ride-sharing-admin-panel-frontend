import type { Cents, DateRange, ISODate, ListParams } from "./common";

/** MB WAY, Apple/Google Pay are from §12 — the backend has CASH, CARD, WALLET (Appendix B #4). */
export type PaymentMethod = "CARD" | "MB_WAY" | "APPLE_PAY" | "GOOGLE_PAY" | "WALLET" | "CASH";

export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCESSFUL"
  | "FAILED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

export type Refund = {
  id: string;
  amountCents: Cents;
  reason: string;
  adminId: string;
  /** Filled in by the payments service, so the screens show who refunded without needing the admins module. */
  adminName?: string;
  createdAt: ISODate;
  gatewayRef: string;
  status: "SUCCESSFUL" | "FAILED";
};

export type Payment = {
  id: string;
  rideId: string;
  customerId: string;
  amountCents: Cents;
  method: PaymentMethod;
  /** Card brand + last four, e.g. "Visa •••• 4242" — never the full number (§12). */
  methodDetail?: string;
  createdAt: ISODate;
  status: PaymentStatus;
  refundedCents: Cents;
  /** Gateway transaction reference; cash payments have none. */
  gatewayRef?: string;
  failureReason?: string;
  refunds: Refund[];
  /** Matched against the gateway's settlement file. */
  reconciled: boolean;
};

/**
 * Where a payment stands against the gateway's settlement file (§12):
 * - `MATCHED` — found in the file, same amount and status;
 * - `IN_PROGRESS` — still pending/processing, not in a file yet;
 * - `AWAITING_FILE` — captured, but too recent to be in the file (files arrive after 2 days);
 * - `NOT_EXPECTED` — failed payments never settle, so there is nothing to match;
 * - `MISMATCH` — should be in the file and isn't, or differs: needs a person.
 */
export type ReconciliationState = "MATCHED" | "IN_PROGRESS" | "AWAITING_FILE" | "NOT_EXPECTED" | "MISMATCH";

export const RECONCILIATION_STATES = ["MISMATCH", "AWAITING_FILE", "MATCHED", "IN_PROGRESS", "NOT_EXPECTED"] as const satisfies readonly ReconciliationState[];

/** What the gateway's file says about a mismatched payment (sample data: derived from the payment). */
export type GatewayMismatch =
  | { kind: "MISSING" }
  | { kind: "AMOUNT_DIFFERS"; gatewayAmountCents: Cents }
  | { kind: "STATUS_DIFFERS"; gatewayStatus: "FAILED" | "PENDING" };

export type PaymentListItem = Payment & {
  customerName: string;
  reconciliation: ReconciliationState;
  /** Only when `reconciliation` is `MISMATCH`. */
  mismatch?: GatewayMismatch;
};

/** The methods that go through a gateway; cash is paid to the driver. */
export const GATEWAY_METHODS = ["CARD", "MB_WAY", "APPLE_PAY", "GOOGLE_PAY", "WALLET"] as const satisfies readonly PaymentMethod[];
export type GatewayMethod = (typeof GATEWAY_METHODS)[number];

/** One payment method over a period: the numbers under its card on the Methods tab. */
export type PaymentMethodStat = {
  method: PaymentMethod;
  count: number;
  /** Captured (successful, or later refunded in full or part). */
  successful: number;
  failed: number;
  capturedCents: Cents;
};

export type PaymentListParams = ListParams &
  DateRange & {
    status?: PaymentStatus[];
    method?: PaymentMethod[];
    customerId?: string;
    rideId?: string;
    reconciled?: boolean;
    reconciliation?: ReconciliationState[];
  };
