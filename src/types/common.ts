/**
 * Shared shapes for every domain type (ride_plan.md §D).
 *
 * - Money is integer **cents** (`Cents`), never float euros.
 * - Dates are **ISO strings in UTC** (`ISODate`), shown in Europe/Lisbon.
 * - IDs are readable and prefixed (`CUS-10234`, `RIDE-884102`, …).
 */

/** Integer euro cents. 1250 = €12.50. */
export type Cents = number;

/** ISO 8601 timestamp in UTC, e.g. "2026-10-19T08:30:00.000Z". */
export type ISODate = string;

/** User-facing text the platform stores in both languages (notifications, settings). */
export type Localized = { en: string; pt: string };

export type AppLanguage = "pt" | "en";

export type GeoPoint = { lat: number; lng: number };

export type City = "LISBOA" | "PORTO" | "FARO";

/** A place on a ride: a readable address plus coordinates for the map. */
export type Place = GeoPoint & { address: string; city: City };

/** Server-style pagination — what every list service returns. */
export type Page<T> = { items: T[]; page: number; pageSize: number; total: number };

/**
 * The params every list service accepts. `sort` is `"<field>:asc|desc"`;
 * the allowed fields are listed per service. `from`/`to` are ISO dates.
 */
export type ListParams = {
  page: number;
  pageSize: number;
  q?: string;
  sort?: string;
};

export type DateRange = { from?: ISODate; to?: ISODate };

/** An internal administrative note (customers, drivers, rides, tickets). */
export type AdminNote = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: ISODate;
};

/** One status change in a record's history. */
export type StatusChange<S extends string = string> = {
  status: S;
  at: ISODate;
  /** Admin ID, `SYSTEM`, or the customer/driver ID that caused it. */
  by: string;
  reason?: string;
};

/** Validity of a licence, certificate or policy, derived from its expiry date. */
export type CredentialStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED" | "MISSING";

export type AccountStatus = "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

/** Small "who is this" shape used inside other records (ride rows, tickets). */
export type PersonRef = { id: string; name: string; phone?: string; email?: string };
