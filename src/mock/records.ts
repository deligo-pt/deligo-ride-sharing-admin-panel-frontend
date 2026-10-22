import type { City } from "@/types/common";
import type { Customer } from "@/types/customer";
import type { Driver } from "@/types/driver";
import type { FleetManager } from "@/types/fleet";
import type { Promotion } from "@/types/promotion";
import type { Vehicle } from "@/types/vehicle";

/**
 * What the fake backend stores. Counts, sums and statuses that a real backend
 * would compute with a query (total rides, eligibility, credential status…)
 * are left out and computed by the services at read time, so they can never
 * drift from the underlying rows.
 */
export type CustomerRecord = Omit<Customer, "totalRides" | "totalSpentCents" | "unpaidCents" | "lastRideAt">;

export type DriverRecord = Omit<
  Driver,
  "currentRideStatus" | "completedRides" | "cancelledRides" | "eligible" | "documents"
> & {
  /** Where the driver works — rides are matched within a city. */
  city: City;
  iban: string;
};

export type FleetRecord = Omit<
  FleetManager,
  "driverIds" | "vehicleIds" | "completedRides" | "settlementBalanceCents" | "documents"
> & { iban: string };

export type VehicleRecord = Omit<Vehicle, "documents">;

export type PromotionRecord = Omit<Promotion, "state" | "redemptions" | "revenueImpactCents">;
