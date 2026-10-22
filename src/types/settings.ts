import type { AppLanguage, ISODate, ListParams } from "./common";
import type { PaymentMethod } from "./payment";
import type { RideCategory } from "./vehicle";

/**
 * Platform settings an admin may change (§22). Infrastructure secrets are
 * never part of this (§22: "do not expose infrastructure credentials").
 */
export type PlatformSettings = {
  branding: { platformName: string; supportEmail: string; supportPhone: string };
  localization: {
    defaultLanguage: AppLanguage;
    timeZone: "Europe/Lisbon";
    currency: "EUR";
    dateFormat: "dd/MM/yyyy";
  };
  rideTypes: { category: RideCategory; enabled: boolean; seats: number }[];
  /**
   * A method is only offered when its gateway is configured (§12) —
   * `gatewayConfigured` is read-only and comes from the backend.
   */
  paymentMethods: { method: PaymentMethod; enabled: boolean; gatewayConfigured: boolean }[];
  operations: {
    driverSearchRadiusKm: number;
    driverAcceptTimeoutSec: number;
    maxSearchMinutes: number;
    scheduledLeadMinutes: number;
    maxStops: number;
    freeCancellationMinutes: number;
    documentExpiryWarningDays: number;
  };
  notifications: { emailOnSos: boolean; dailyDigest: boolean; payoutFailureAlerts: boolean };
  security: { sessionTimeoutMinutes: number; mfaRequired: boolean; passwordMinLength: number };
  privacy: { dataRetentionYears: number; invoiceRetentionYears: number; maskPhonesForAnalysts: boolean };
  updatedAt: ISODate;
  updatedBy: string;
};

export type GdprRequestType = "ACCESS" | "RECTIFICATION" | "ERASURE" | "PORTABILITY" | "RESTRICTION";
export type GdprRequestStatus = "RECEIVED" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";

/** Data-subject request. Erasure keeps records the law requires (invoices: 10 years, §23). */
export type GdprRequest = {
  id: string;
  subjectType: "CUSTOMER" | "DRIVER";
  subjectId: string;
  subjectName: string;
  type: GdprRequestType;
  status: GdprRequestStatus;
  receivedAt: ISODate;
  /** One month to answer (GDPR art. 12). */
  dueAt: ISODate;
  completedAt?: ISODate;
  handledBy?: string;
  note?: string;
};

export type GdprListParams = ListParams & {
  status?: GdprRequestStatus[];
  type?: GdprRequestType[];
};
