import type { City, GeoPoint, ISODate } from "./common";
import type { RideStatus } from "./ride";
import type { RideCategory } from "./vehicle";

/** A position older than this is "stale" (§10): the marker fades and the ride needs attention. */
export const LIVE_STALE_MS = 60_000;

/** Why a ride shows up as "needs attention" on the live map (§10). */
export type LiveAttention = "SOS" | "STALE_LOCATION" | "LONG_SEARCH" | "LONG_WAIT" | "NO_LOCATION";

export type LiveRide = {
  rideId: string;
  status: RideStatus;
  rideType: RideCategory;
  city: City;
  /** Left out for roles that may not open customers. */
  customerName?: string;
  driverId?: string;
  /** Left out for roles that may not open drivers. */
  driverName?: string;
  vehiclePlate?: string;
  pickup: GeoPoint;
  dropoff: GeoPoint;
  /** Null when the driver's location is unavailable. */
  location: (GeoPoint & { at: ISODate; heading: number }) | null;
  /** Minutes in the current status. */
  minutesInStatus: number;
  attention: LiveAttention[];
};

export type LiveDriver = {
  driverId: string;
  /** Left out for roles that may not open drivers (they see an anonymous dot). */
  name?: string;
  city: City;
  rideType: RideCategory;
  location: GeoPoint & { at: ISODate };
  busy: boolean;
};

export type LiveSnapshot = {
  at: ISODate;
  rides: LiveRide[];
  /** Online drivers without a ride (shown as dots, per the privacy policy). */
  availableDrivers: LiveDriver[];
};
