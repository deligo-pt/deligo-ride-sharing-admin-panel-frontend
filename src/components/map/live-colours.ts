import type { RideStatus } from "@/types/ride";

/**
 * Marker colours for the live map. MapLibre paints on a canvas, so it can't
 * read the CSS tokens; these hex values mirror them (warning, info, brand,
 * danger, muted-foreground). The legend uses the same constants.
 */
export type LiveTone = "searching" | "pickup" | "inProgress" | "emergency";

export const LIVE_COLOURS = {
  searching: "#f59e0b",
  pickup: "#3b82f6",
  inProgress: "#dc3173",
  emergency: "#dc2626",
  driver: "#64748b",
} as const;

export function liveTone(status: RideStatus): LiveTone {
  switch (status) {
    case "REQUESTED":
    case "SEARCHING":
      return "searching";
    case "IN_PROGRESS":
      return "inProgress";
    case "EMERGENCY":
      return "emergency";
    default:
      return "pickup";
  }
}
