import type { Cents, DateRange, ISODate, ListParams, Page } from "./common";
import type { PaymentMethod } from "./payment";
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
  /** Why the rate was set (the audit entry has it too; shown in the history). */
  reason?: string;
  /** A scheduled change that was cancelled before it started. It never applied. */
  withdrawn?: boolean;
};

/** Where a rule stands: in force, waiting for its start date, replaced, or cancelled before it started. */
export type CommissionRuleStatus = "ACTIVE" | "SCHEDULED" | "ENDED" | "WITHDRAWN";

export type CommissionRuleView = CommissionRule & { status: CommissionRuleStatus; createdByName: string };

export type SettlementPayeeType = "DRIVER" | "FLEET";
export type SettlementStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

/**
 * Weekly statement for an independent driver or a fleet manager (the fleet is
 * paid for its drivers' rides). Amounts come from the rides in the period.
 */
/** A manual credit (+) or deduction (−) a person added to a pending settlement, with the reason (§12). */
export type SettlementAdjustment = {
  id: string;
  /** Signed: positive pays the payee more, negative pays less. */
  amountCents: Cents;
  reason: string;
  adminId: string;
  adminName?: string;
  createdAt: ISODate;
};

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
  /** Cash the driver already collected from customers. */
  deductionsCents: Cents;
  /** Sum of the manual adjustments (signed); missing = none. net = gross − commission − deductions + adjustments. */
  adjustmentsCents?: Cents;
  adjustments?: SettlementAdjustment[];
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

/** One completed ride inside a settlement: the per-ride commission breakdown (§12). */
export type SettlementRide = {
  rideId: string;
  completedAt: ISODate;
  category: RideCategory;
  driverName?: string;
  /** Fare before VAT: what commission is charged on. */
  fareNetCents: Cents;
  rate: number;
  commissionCents: Cents;
  /** What the driver keeps of the fare: fare − commission. */
  earningsCents: Cents;
  method: PaymentMethod;
  /** Cash the driver collected on this ride (cash rides only); it is deducted from the payout. */
  cashCollectedCents: Cents;
};

export type SettlementRidesTotals = { count: number; fareNetCents: Cents; commissionCents: Cents; earningsCents: Cents; cashCollectedCents: Cents };

export type SettlementRidesPage = Page<SettlementRide> & { totals: SettlementRidesTotals };

export type SettlementSummary = {
  count: number;
  grossCents: Cents;
  commissionCents: Cents;
  pendingCount: number;
  pendingNetCents: Cents;
  processingCount: number;
  completedCount: number;
  completedNetCents: Cents;
  failedCount: number;
};
