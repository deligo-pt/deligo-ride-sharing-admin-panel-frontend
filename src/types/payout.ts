import type { Cents, DateRange, ISODate, ListParams } from "./common";
import type { SettlementPayeeType } from "./finance";

export type PayoutStatus = "PENDING" | "PROCESSING" | "SUCCESSFUL" | "FAILED";

/** Bank transfer of a settlement's net amount to the driver or fleet (SEPA). */
export type Payout = {
  id: string;
  payeeType: SettlementPayeeType;
  payeeId: string;
  payeeName: string;
  settlementId: string;
  amountCents: Cents;
  /** Masked IBAN, e.g. "PT50 •••• •••• •••• 1234 5". */
  ibanMasked: string;
  status: PayoutStatus;
  /** SEPA transfer reference once sent. */
  reference?: string;
  failureReason?: string;
  createdAt: ISODate;
  paidAt?: ISODate;
  attempts: number;
};

export type PayoutListParams = ListParams &
  DateRange & {
    status?: PayoutStatus[];
    payeeType?: SettlementPayeeType[];
    payeeId?: string;
  };

/** Earnings of one driver over a period (§13). */
export type DriverEarnings = {
  driverId: string;
  from: ISODate;
  to: ISODate;
  rideCount: number;
  grossCents: Cents;
  commissionCents: Cents;
  deductionsCents: Cents;
  netCents: Cents;
  /** One point per day for the chart. */
  daily: { date: string; grossCents: Cents; netCents: Cents; rides: number }[];
};
