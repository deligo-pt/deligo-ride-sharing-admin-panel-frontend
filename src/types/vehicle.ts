import type { CredentialStatus, ISODate, ListParams, StatusChange } from "./common";
import type { DocumentStatus, DocumentType } from "./document";
import type { DriverEligibility } from "./driver";

/** Ride category the vehicle can serve (also the customer's ride type). */
export type RideCategory = "ECONOMY" | "COMFORT" | "PREMIUM";

/** Body type, from the backend's VehicleType enum. */
export type VehicleType = "SUV" | "Sedan" | "Hatchback" | "Micro" | "Motorcycle" | "PickupTruck";

/** Colour keys — the label is translated (`vehicles.colour.<key>`). */
export type VehicleColour = "BLACK" | "WHITE" | "GREY" | "SILVER" | "BLUE" | "RED" | "GREEN" | "BEIGE";

export type VehicleApproval = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "SUSPENDED";
export type VehicleOperational = "ACTIVE" | "INACTIVE" | "SUSPENDED";

export type Vehicle = {
  id: string;
  /** Portuguese plate, e.g. "AA-12-BB". */
  plate: string;
  make: string;
  model: string;
  year: number;
  colour: VehicleColour;
  category: RideCategory;
  type: VehicleType;
  seats: number;
  electric: boolean;
  driverId?: string;
  fleetManagerId?: string;
  insurance: { policyNo: string; insurer: string; expiresAt: ISODate; status: CredentialStatus };
  /** IPO — periodic technical inspection. */
  inspection: { expiresAt: ISODate; status: CredentialStatus };
  approval: VehicleApproval;
  operational: VehicleOperational;
  registeredAt: ISODate;
  documents: { id: string; type: DocumentType; status: DocumentStatus; expiresAt?: ISODate }[];
  statusHistory: StatusChange<VehicleApproval | VehicleOperational>[];
};

export type VehicleListParams = ListParams & {
  category?: RideCategory[];
  approval?: VehicleApproval[];
  operational?: VehicleOperational[];
  fleetManagerId?: string;
  driverId?: string;
  /** Only vehicles with insurance or inspection expiring within 30 days or expired. */
  expiring?: boolean;
  /** Upcoming-expirations view (§8): insurance or inspection ends within N days (30, 60 or 90) or already ended. */
  expiringWithinDays?: number;
};

/** What an admin can set when adding or editing a vehicle. */
export type VehicleInput = Pick<
  Vehicle,
  "plate" | "make" | "model" | "year" | "colour" | "category" | "type" | "seats" | "electric"
> & {
  driverId?: string;
  fleetManagerId?: string;
  insurance: { policyNo: string; insurer: string; expiresAt: ISODate };
  inspection: { expiresAt: ISODate };
};

/** A vehicle with the names the screens show (joined like a backend would). */
export type VehicleListItem = Vehicle & {
  driverName?: string;
  fleetName?: string;
  /** Days until the nearer of insurance and inspection ends; negative once it has. */
  daysToExpiry: number;
};

/** Can the vehicle be approved, and which documents are still needed (same shape as a driver's eligibility). */
export type VehicleApprovalCheck = DriverEligibility;

/** Why the vehicle's status can't change right now. */
export type VehicleStatusCheck = { activeRideId?: string };

/** A driver who has driven this vehicle, from the rides done with it (assignment history, §8). */
export type VehicleDriverUse = {
  driverId: string;
  driverName: string;
  rides: number;
  firstRideAt: ISODate;
  lastRideAt: ISODate;
  /** Still the assigned driver. */
  current: boolean;
};

/** A driver who could be assigned to the vehicle now. */
export type AssignableDriver = { id: string; name: string; fleetName?: string };
