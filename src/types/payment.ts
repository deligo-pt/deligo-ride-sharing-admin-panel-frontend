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

export type PaymentListItem = Payment & { customerName: string };

export type PaymentListParams = ListParams &
  DateRange & {
    status?: PaymentStatus[];
    method?: PaymentMethod[];
    customerId?: string;
    rideId?: string;
    reconciled?: boolean;
  };
