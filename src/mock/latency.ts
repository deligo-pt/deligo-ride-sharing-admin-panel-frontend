import { ServiceError } from "@/lib/service-error";
import { useDemoSettings } from "@/stores/demo-settings";

/**
 * Simulated network for every service call: 150–600 ms, and — when "simulate
 * errors" is on — a share of calls fail with NETWORK (ride_plan.md §A).
 * Math.random is fine here: timing is not part of the seeded data.
 */
export async function latency() {
  const { latency: enabled, simulateErrors, errorRate } = useDemoSettings.getState();
  if (enabled) await new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 450));
  if (simulateErrors && Math.random() < errorRate) {
    throw new ServiceError("NETWORK", "Simulated network error (demo setting)");
  }
}
