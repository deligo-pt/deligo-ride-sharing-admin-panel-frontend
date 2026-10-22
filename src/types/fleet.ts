import type { AccountStatus, Cents, ISODate, ListParams, StatusChange } from "./common";
import type { DocumentStatus, DocumentType } from "./document";
import type { DriverEligibility } from "./driver";

export type FleetVerification = "PENDING" | "APPROVED" | "REJECTED";

export type FleetManager = {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  /** Company tax number (NIPC, starts with 5). */
  nif: string;
  address: string;
  registeredAt: ISODate;
  verification: FleetVerification;
  driverIds: string[];
  vehicleIds: string[];
  /** Computed from rides by the fleet's drivers. */
  completedRides: number;
  /** Net amount of settlements not yet paid out. Computed. */
  settlementBalanceCents: Cents;
  accountStatus: AccountStatus;
  documents: { id: string; type: DocumentType; status: DocumentStatus; expiresAt?: ISODate }[];
  statusHistory: StatusChange<FleetVerification | AccountStatus>[];
};

export type FleetListParams = ListParams & {
  verification?: FleetVerification[];
  accountStatus?: AccountStatus[];
};

/** Can the onboarding be approved, and which company documents are still missing (same shape as a driver's eligibility). */
export type FleetOnboardingCheck = DriverEligibility;

/** Why a fleet can't be suspended right now: rides its drivers are on. */
export type FleetSuspensionCheck = { activeRides: number };

/** Operational performance of a fleet over a period (§7 "review operational performance"). */
export type FleetPerformance = {
  fleetManagerId: string;
  from: ISODate;
  to: ISODate;
  /** Rides finished in the period (completed + cancelled + expired). */
  rides: number;
  completed: number;
  cancelled: number;
  /** Fares before VAT of completed rides. */
  grossCents: Cents;
  commissionCents: Cents;
  drivers: { total: number; online: number; approved: number; averageRating: number };
  vehicles: { total: number; approved: number; pendingReview: number; documentsExpiring: number };
  /** One point per day for the chart; `netCents` = gross − commission. */
  daily: { date: string; grossCents: Cents; netCents: Cents; rides: number }[];
};
