import type { Cents, City, ISODate, ListParams, Localized } from "./common";
import type { RideCategory } from "./vehicle";

export type DiscountType = "FLAT" | "PERCENTAGE";

export type PromotionUserGroup = "ALL" | "NEW_CUSTOMERS" | "INACTIVE_30D" | "FREQUENT";

/** Derived from `enabled` + dates + usage — not stored. */
export type PromotionState = "SCHEDULED" | "ACTIVE" | "EXPIRED" | "DISABLED" | "EXHAUSTED";

export type Promotion = {
  id: string;
  code: string;
  name: Localized;
  discountType: DiscountType;
  /** Cents for FLAT, a fraction for PERCENTAGE (0.15 = 15%). */
  value: number;
  maxDiscountCents?: Cents;
  minBookingCents?: Cents;
  startsAt: ISODate;
  endsAt: ISODate;
  /** Total redemptions allowed; undefined = unlimited. */
  usageLimit?: number;
  perCustomerLimit: number;
  eligible: { userGroups: PromotionUserGroup[]; categories: RideCategory[]; cities: City[] };
  enabled: boolean;
  state: PromotionState;
  /** Computed from rides that used the code. */
  redemptions: number;
  /** Total discount given, in cents. Computed. */
  revenueImpactCents: Cents;
  createdAt: ISODate;
  createdBy: string;
};

export type PromotionInput = Pick<
  Promotion,
  | "code"
  | "name"
  | "discountType"
  | "value"
  | "maxDiscountCents"
  | "minBookingCents"
  | "startsAt"
  | "endsAt"
  | "usageLimit"
  | "perCustomerLimit"
  | "eligible"
  | "enabled"
>;

export type PromotionListParams = ListParams & { state?: PromotionState[] };

export type Redemption = {
  rideId: string;
  customerId: string;
  customerName: string;
  discountCents: Cents;
  redeemedAt: ISODate;
};

export type PromotionPerformance = {
  promotionId: string;
  redemptions: number;
  uniqueCustomers: number;
  discountCents: Cents;
  /** Fare of the rides that used the code (after discount). */
  grossCents: Cents;
  daily: { date: string; redemptions: number; discountCents: Cents }[];
};
