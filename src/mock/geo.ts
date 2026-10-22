import type { GeoPoint } from "@/types/common";

/** Plain geometry (no faker) — safe to import from services. */
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Straight-line distance in km. */
export function haversineKm(a: GeoPoint, b: GeoPoint) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Point a fraction `t` of the way from a to b (live positions). */
export const lerpPoint = (a: GeoPoint, b: GeoPoint, t: number): GeoPoint => ({
  lat: round6(a.lat + (b.lat - a.lat) * t),
  lng: round6(a.lng + (b.lng - a.lng) * t),
});

/** Compass heading from a to b, 0–359°. */
export function heading(a: GeoPoint, b: GeoPoint) {
  const deg = (Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180) / Math.PI;
  return Math.round((deg + 360) % 360);
}
