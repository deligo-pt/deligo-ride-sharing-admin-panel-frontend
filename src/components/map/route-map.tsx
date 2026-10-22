"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useMemo } from "react";
import { Car } from "lucide-react";
import { setWorkerUrl } from "maplibre-gl";
import Map, { Layer, Marker, NavigationControl, Source } from "react-map-gl/maplibre";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import type { GeoPoint } from "@/types/common";

/**
 * The map behind a ride (§9): pickup (A), stops (1, 2…), destination (B),
 * a route line and — for a ride in progress — the driver. MapLibre with the
 * free Carto basemap (light or dark with the theme): no API key. Only
 * `lazy-map.tsx` imports this file, so maplibre (≈ 250 kB gz) loads on
 * demand (§G). The line is drawn through the points with a gentle curve — the
 * prototype has no routing service.
 */
const STYLE = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
} as const;

// The worker files are copied to /public/maplibre by scripts/copy-maplibre-worker.mjs.
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export type RouteMapProps = {
  pickup: GeoPoint;
  dropoff: GeoPoint;
  stops?: GeoPoint[];
  driver?: GeoPoint;
};

/** A quadratic curve between two points, bending a little to one side. */
function curve(a: GeoPoint, b: GeoPoint, steps = 16): [number, number][] {
  const mid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const control = { lat: mid.lat + dx * 0.12, lng: mid.lng - dy * 0.12 };
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = 1 - t;
    return [
      u * u * a.lng + 2 * u * t * control.lng + t * t * b.lng,
      u * u * a.lat + 2 * u * t * control.lat + t * t * b.lat,
    ];
  });
}

function Pin({ label, tone }: { label: string; tone: "start" | "end" | "stop" }) {
  const colour =
    tone === "start" ? "bg-success" : tone === "end" ? "bg-primary" : "bg-foreground/70";
  return (
    <span
      className={`grid size-7 place-items-center rounded-full border-2 border-white text-xs font-bold text-white shadow-md ${colour}`}
    >
      {label}
    </span>
  );
}

export default function RouteMap({ pickup, dropoff, stops = [], driver }: RouteMapProps) {
  const t = useTranslations("rides.map");
  const { resolvedTheme } = useTheme();

  const points = useMemo(() => [pickup, ...stops, dropoff], [pickup, stops, dropoff]);
  const line = useMemo(() => {
    const coordinates: [number, number][] = [];
    for (let i = 0; i < points.length - 1; i++)
      coordinates.push(...curve(points[i]!, points[i + 1]!));
    return {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates },
    };
  }, [points]);
  const bounds = useMemo(() => {
    const all = driver ? [...points, driver] : points;
    const lngs = all.map((p) => p.lng);
    const lats = all.map((p) => p.lat);
    return [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ] as [[number, number], [number, number]];
  }, [points, driver]);

  return (
    <Map
      initialViewState={{ bounds, fitBoundsOptions: { padding: 56, maxZoom: 15 } }}
      mapStyle={resolvedTheme === "dark" ? STYLE.dark : STYLE.light}
      scrollZoom={false}
      attributionControl={{ compact: true }}
      aria-label={t("label")}
      style={{ width: "100%", height: "100%" }}
    >
      <NavigationControl showCompass={false} position="top-right" />
      <Source id="route" type="geojson" data={line}>
        <Layer
          id="route-casing"
          type="line"
          paint={{ "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.85 }}
          layout={{ "line-cap": "round", "line-join": "round" }}
        />
        <Layer
          id="route-line"
          type="line"
          paint={{ "line-color": "#dc3173", "line-width": 4 }}
          layout={{ "line-cap": "round", "line-join": "round" }}
        />
      </Source>
      <Marker longitude={pickup.lng} latitude={pickup.lat}>
        <Pin label="A" tone="start" />
      </Marker>
      {stops.map((stop, i) => (
        <Marker key={i} longitude={stop.lng} latitude={stop.lat}>
          <Pin label={String(i + 1)} tone="stop" />
        </Marker>
      ))}
      <Marker longitude={dropoff.lng} latitude={dropoff.lat}>
        <Pin label="B" tone="end" />
      </Marker>
      {driver && (
        <Marker longitude={driver.lng} latitude={driver.lat}>
          <span
            className="grid size-8 place-items-center rounded-full border-2 border-white bg-info text-white shadow-md"
            title={t("driver")}
          >
            <Car aria-hidden className="size-4" />
          </span>
        </Marker>
      )}
    </Map>
  );
}
