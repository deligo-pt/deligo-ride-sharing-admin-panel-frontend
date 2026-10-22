import { LIVE_STALE_MS, type LiveAttention, type LiveRide } from "@/types/live";
import type { RideStatus } from "@/types/ride";

/** The status filter groups the operators think in (§10). */
export const LIVE_GROUPS = ["all", "searching", "toPickup", "inProgress", "emergency"] as const;
export type LiveGroup = (typeof LIVE_GROUPS)[number];

const GROUP_STATUSES: Record<Exclude<LiveGroup, "all">, readonly RideStatus[]> = {
  searching: ["REQUESTED", "SEARCHING"],
  toPickup: ["ACCEPTED", "DRIVER_ARRIVING", "DRIVER_ARRIVED"],
  inProgress: ["IN_PROGRESS"],
  emergency: ["EMERGENCY"],
};

export const inGroup = (status: RideStatus, group: LiveGroup) =>
  group === "all" || GROUP_STATUSES[group].includes(status);

/** Attention reasons shown first-to-last (most urgent first). */
export const ATTENTION_ORDER: readonly LiveAttention[] = [
  "SOS",
  "NO_LOCATION",
  "STALE_LOCATION",
  "LONG_SEARCH",
  "LONG_WAIT",
];

/** A snapshot ride as the screen uses it: the position's age is judged against the screen's clock, not just the last poll. */
export type LiveItem = LiveRide & { stale: boolean };

export function toItem(ride: LiveRide, nowMs: number): LiveItem {
  const age = ride.location ? nowMs - Date.parse(ride.location.at) : 0;
  const stale = Boolean(ride.location) && age > LIVE_STALE_MS;
  const attention =
    stale && !ride.attention.includes("STALE_LOCATION")
      ? [...ride.attention, "STALE_LOCATION" as const]
      : ride.attention;
  return { ...ride, stale, attention };
}

export const needsAttention = (item: LiveItem) => item.attention.length > 0;
