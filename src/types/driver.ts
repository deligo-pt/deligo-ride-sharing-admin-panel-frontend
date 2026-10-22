import type {
  AccountStatus,
  AdminNote,
  CredentialStatus,
  GeoPoint,
  ISODate,
  ListParams,
  StatusChange,
} from "./common";
import type { DocumentStatus, DocumentType } from "./document";
import type { RideStatus } from "./ride";

export type DriverVerification =
  | "NOT_SUBMITTED"
  | "PENDING_DOCS"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED";

/** Driving licence or TVDE certificate: number + expiry, status derived from the date. */
export type DriverCredential = {
  number: string;
  expiresAt: ISODate;
  status: CredentialStatus;
};

/** The driver's documents as listed on their profile (full records live in Documents). */
export type DriverDocumentSummary = {
  id: string;
  type: DocumentType;
  status: DocumentStatus;
  expiresAt?: ISODate;
};

export type Driver = {
  id: string;
  name: string;
  email: string;
  phone: string;
  nif: string;
  photoUrl: string;
  joinedAt: ISODate;
  verification: DriverVerification;
  licence: DriverCredential;
  tvde: DriverCredential;
  fleetManagerId?: string;
  vehicleId?: string;
  online: boolean;
  /** Last known position while online (live map). */
  location?: GeoPoint & { at: ISODate };
  /** Status of the ride they are on now, if any. Computed from rides. */
  currentRideStatus?: RideStatus;
  /** Computed from rides. */
  completedRides: number;
  /** Computed from rides. */
  cancelledRides: number;
  /** 1.0–5.0, one decimal. */
  rating: number;
  accountStatus: AccountStatus;
  /**
   * False when a mandatory document is missing, rejected or expired — the
   * driver cannot be marked eligible (§6). Computed from `documents`.
   */
  eligible: boolean;
  documents: DriverDocumentSummary[];
  statusHistory: StatusChange<DriverVerification | AccountStatus>[];
  notes: AdminNote[];
};

export type DriverListParams = ListParams & {
  verification?: DriverVerification[];
  accountStatus?: AccountStatus[];
  online?: boolean;
  fleetManagerId?: string;
  /** Only drivers with a licence or TVDE certificate expiring within 30 days or expired. */
  expiring?: boolean;
};

/** A driver row/profile with the names the screens show (joined like a backend would). */
export type DriverListItem = Driver & {
  fleetName?: string;
  vehiclePlate?: string;
  /** "Toyota Prius" — make and model. */
  vehicleLabel?: string;
};

export type RequirementState = "OK" | "PENDING" | "REJECTED" | "EXPIRED" | "MISSING";

/** One mandatory document (or a choice between alternatives, e.g. citizen card or residence permit). */
export type DriverRequirement = {
  /** One type, or the alternatives that satisfy it. */
  options: DocumentType[];
  state: RequirementState;
  /** The document that decides the state, when there is one. */
  documentId?: string;
};

/** Can the driver be marked eligible, and if not, what is missing (§6). */
export type DriverEligibility = {
  eligible: boolean;
  requirements: DriverRequirement[];
};

/** Why a driver can't be suspended right now. */
export type DriverSuspensionCheck = { activeRideId?: string };
