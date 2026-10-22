import type { AdminNote, AppLanguage, Cents, DateRange, ISODate, ListParams } from "./common";

export type CustomerStatus = "ACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION" | "DEACTIVATED";
export type CustomerVerification = "VERIFIED" | "UNVERIFIED";

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** Tax number for invoices — optional, customers add it at checkout. */
  nif?: string;
  registeredAt: ISODate;
  status: CustomerStatus;
  verification: CustomerVerification;
  /** Computed from rides (like a backend COUNT) — not stored. */
  totalRides: number;
  /** Sum of successful payments minus refunds, in cents. Computed. */
  totalSpentCents: Cents;
  /** Charges that failed and are still owed (payments in FAILED), in cents. Computed. */
  unpaidCents: Cents;
  language: AppLanguage;
  lastRideAt?: ISODate;
  notes: AdminNote[];
};

export type CustomerListParams = ListParams &
  DateRange & {
    status?: CustomerStatus[];
    verification?: CustomerVerification[];
  };

/**
 * Why a customer can't be suspended right now (§5: rules for active rides and
 * outstanding payments). Nothing set = free to suspend.
 */
export type SuspensionCheck = {
  /** A ride in progress — suspend after it ends. */
  activeRideId?: string;
  unpaidCents: Cents;
  unpaidCount: number;
};
