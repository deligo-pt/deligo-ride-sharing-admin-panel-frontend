import { LIVE_STALE_MS, type LiveAttention, type LiveDriver, type LiveRide, type LiveSnapshot } from "@/types/live";
import { ACTIVE_RIDE_STATUSES } from "@/types/ride";
import { now } from "@/mock/clock";
import { heading, lerpPoint } from "@/mock/geo";
import { authorize, backend, canView } from "./_shared";

/**
 * Live ride monitoring — requirements §10. Positions move with the real clock
 * between polls (the screen refetches every few seconds), so the map looks
 * alive. A position older than a minute is "stale"; no position is shown as
 * unavailable rather than guessed. Names are left out for roles that can't
 * open customers or drivers (privacy, §10).
 */
const STALE_MS = LIVE_STALE_MS;
const LONG_SEARCH_MIN = 4;
const LONG_WAIT_MIN = 10;

/** // API: GET /admin/live/snapshot (❌ — later the admin socket channel) */
export async function getLiveSnapshot(): Promise<LiveSnapshot> {
  authorize("live", "view");
  const { db } = await backend();
  const seesCustomers = canView("customers");
  const seesDrivers = canView("drivers");
  const realNow = Date.now();
  const rides: LiveRide[] = [];
  const busyDrivers = new Set<string>();

  for (const ride of db.rides.all()) {
    if (!ACTIVE_RIDE_STATUSES.includes(ride.status)) continue;
    const driver = ride.driverId ? db.drivers.get(ride.driverId) : undefined;
    if (driver) busyDrivers.add(driver.id);
    const last = ride.timeline[ride.timeline.length - 1];
    const minutesInStatus = last ? Math.max(0, Math.round((realNow - Date.parse(last.at)) / 60_000)) : 0;

    let location: LiveRide["location"] = null;
    if (ride.lastLocation) {
      const reportedAt = Date.parse(ride.lastLocation.at);
      // Positions already old when the data was generated stay frozen (the "stale" demo rides).
      const stale = now() - reportedAt > STALE_MS;
      let point = { lat: ride.lastLocation.lat, lng: ride.lastLocation.lng };
      let at = ride.lastLocation.at;
      if (!stale) {
        // A live driver keeps reporting: fresh timestamp, and the car moves.
        at = new Date(realNow - 5_000).toISOString();
        if (ride.status === "IN_PROGRESS" && ride.startedAt) {
          // Along the route; it never "arrives" on its own.
          const progress = Math.min(0.95, (realNow - Date.parse(ride.startedAt)) / (Math.max(ride.durationMin, 5) * 60_000));
          point = lerpPoint(ride.pickup, ride.dropoff, progress);
        } else if (ride.status === "DRIVER_ARRIVING" || ride.status === "ACCEPTED") {
          point = lerpPoint(point, ride.pickup, Math.min(0.8, minutesInStatus / 10));
        }
      }
      location = { ...point, at, heading: heading(point, ride.status === "IN_PROGRESS" ? ride.dropoff : ride.pickup) };
    }

    const attention: LiveAttention[] = [];
    if (ride.status === "EMERGENCY") attention.push("SOS");
    if (driver && !location) attention.push("NO_LOCATION");
    if (location && realNow - Date.parse(location.at) > STALE_MS) attention.push("STALE_LOCATION");
    if ((ride.status === "SEARCHING" || ride.status === "REQUESTED") && minutesInStatus >= LONG_SEARCH_MIN) attention.push("LONG_SEARCH");
    if (ride.status === "DRIVER_ARRIVED" && minutesInStatus >= LONG_WAIT_MIN) attention.push("LONG_WAIT");

    rides.push({
      rideId: ride.id,
      status: ride.status,
      rideType: ride.rideType,
      city: ride.pickup.city,
      customerName: seesCustomers ? (db.customers.get(ride.customerId)?.name ?? ride.customerId) : undefined,
      driverId: driver?.id,
      driverName: seesDrivers ? driver?.name : undefined,
      vehiclePlate: ride.vehicleId ? db.vehicles.get(ride.vehicleId)?.plate : undefined,
      pickup: { lat: ride.pickup.lat, lng: ride.pickup.lng },
      dropoff: { lat: ride.dropoff.lat, lng: ride.dropoff.lng },
      location,
      minutesInStatus,
      attention,
    });
  }

  const availableDrivers: LiveDriver[] = [];
  for (const d of db.drivers.all()) {
    if (!d.online || !d.location || busyDrivers.has(d.id)) continue;
    const v = d.vehicleId ? db.vehicles.get(d.vehicleId) : undefined;
    // Idle drivers drift a little between polls.
    const wobble = Math.sin(realNow / 20_000 + d.id.length + Number(d.id.slice(4))) * 0.0015;
    availableDrivers.push({
      driverId: d.id,
      name: seesDrivers ? d.name : undefined,
      city: d.city,
      rideType: v?.category ?? "ECONOMY",
      location: { lat: d.location.lat + wobble, lng: d.location.lng - wobble, at: new Date(realNow - 10_000).toISOString() },
      busy: false,
    });
  }

  // Attention first, then the rest by status.
  rides.sort((a, b) => b.attention.length - a.attention.length || a.rideId.localeCompare(b.rideId));
  return { at: new Date(realNow).toISOString(), rides, availableDrivers };
}
