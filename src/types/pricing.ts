import type { Cents, GeoPoint, ISODate, ListParams, Localized } from "./common";
import type { RideCategory } from "./vehicle";

export type PricingStatus = "DRAFT" | "SCHEDULED" | "ACTIVE" | "ARCHIVED";

/** 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** A time window with a fare multiplier (e.g. Fri–Sat 22:00–04:00 ×1.2). Times are Lisbon "HH:mm". */
export type TimeBand = { days: Weekday[]; from: string; to: string; multiplier: number };

/** VAT rates in Portugal (mainland): reduced 6%, intermediate 13%, standard 23%. */
export type VatRate = 0.06 | 0.13 | 0.23;

/**
 * One version of the fare for a category (optionally for one zone). Publishing
 * a new version schedules it; the previous ACTIVE one is archived when it takes
 * effect — completed rides keep the fare they were charged (§11).
 */
export type PricingRule = {
  id: string;
  version: number;
  category: RideCategory;
  zoneId?: string;
  baseFare: Cents;
  minimumFare: Cents;
  perKm: Cents;
  perMinute: Cents;
  bookingFee: Cents;
  waitingPerMinute: Cents;
  cancellationFee: Cents;
  timeBands: TimeBand[];
  surge: { enabled: boolean; maxMultiplier: number };
  vatRate: VatRate;
  effectiveFrom: ISODate;
  status: PricingStatus;
  changedBy: string;
  /** The admin's name, filled in by the service for display. */
  changedByName?: string;
  changedAt: ISODate;
  changeReason?: string;
};

export type PricingRuleInput = Omit<
  PricingRule,
  "id" | "version" | "status" | "changedBy" | "changedAt" | "effectiveFrom"
>;

export type PricingListParams = ListParams & {
  category?: RideCategory[];
  status?: PricingStatus[];
  zoneId?: string;
};

export type ZoneType = "STANDARD" | "SURCHARGE" | "RESTRICTED";

export type Zone = {
  id: string;
  name: Localized;
  type: ZoneType;
  /** Closed ring of points (first = last). */
  polygon: GeoPoint[];
  /** Flat surcharge for pickups/drop-offs in a SURCHARGE zone (e.g. airport). */
  surchargeCents?: Cents;
  active: boolean;
};

/** Result of the "preview before publishing" calculator (§11). */
export type FarePreview = {
  distanceKm: number;
  durationMin: number;
  waitingMin: number;
  multiplier: number;
  /** Fare before VAT (after the minimum fare is applied). */
  netCents: Cents;
  lines: { key: "base" | "distance" | "time" | "waiting" | "booking" | "zone" | "surge" | "discount" | "vat"; cents: Cents }[];
  minimumApplied: boolean;
  totalCents: Cents;
};
