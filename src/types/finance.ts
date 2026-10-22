import type { Cents, DateRange, ISODate, ListParams } from "./common";
import type { RideCategory } from "./vehicle";

/**
 * Platform commission per ride category (§12). A new rule with a later
 * `effectiveFrom` replaces the previous one; history is kept.
 */
export type CommissionRule = {
  id: string;
  category: RideCategory;
  /** Fraction of the fare before VAT: 0.2 = 20%. */
  rate: number;
  effectiveFrom: ISODate;
  effectiveTo?: ISODate;
  createdBy: string;
  createdAt: ISODate;
};

export type SettlementPayeeType = "DRIVER" | "FLEET";
export type SettlementStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

/**
 * Weekly statement for an independent driver or a fleet manager (the fleet is
 * paid for its drivers' rides). Amounts come from the rides in the period.
 */
export type Settlement = {
  id: string;
  payeeType: SettlementPayeeType;
  payeeId: string;
  payeeName: string;
  periodFrom: ISODate;
  periodTo: ISODate;
  rideCount: number;
  grossCents: Cents;
  commissionCents: Cents;
  /** Cash collected by the driver, chargebacks, manual adjustments. */
  deductionsCents: Cents;
  netCents: Cents;
  status: SettlementStatus;
  createdAt: ISODate;
  payoutId?: string;
};

export type SettlementListParams = ListParams &
  DateRange & {
    status?: SettlementStatus[];
    payeeType?: SettlementPayeeType[];
    payeeId?: string;
  };

/** Commission summary for one ride (ride detail, earnings breakdown). */
export type RideCommission = {
  rideId: string;
  fareNetCents: Cents;
  rate: number;
  commissionCents: Cents;
  driverEarningsCents: Cents;
};
