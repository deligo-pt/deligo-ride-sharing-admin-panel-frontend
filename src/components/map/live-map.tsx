"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setWorkerUrl, type ExpressionSpecification, type GeoJSONSource } from "maplibre-gl";
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { LIVE_COLOURS, type LiveTone } from "./live-colours";

/**
 * The live map (§10): every active ride with a known position, and the
 * available drivers as small dots. Rides and drivers share one clustered
 * GeoJSON source, so a busy city collapses into numbered circles (red when a
 * ride in it needs attention) that open as you zoom. Only `lazy-map.tsx`
 * imports this file (maplibre loads on demand, §G).
 */
const STYLE = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
} as const;

setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

export type LiveMapRide = {
  id: string;
  lat: number;
  lng: number;
  tone: LiveTone;
  /** Needs operational attention (ring), whatever the reason. */
  attention: boolean;
  /** Position older than a minute (faded marker). */
  stale: boolean;
};

export type LiveMapDriver = { id: string; lat: number; lng: number };

export type LiveMapProps = {
  rides: LiveMapRide[];
  drivers: LiveMapDriver[];
  selectedId?: string | null;
  /** Changing this refits the map to everything shown ("Fit all"). */
  fitKey?: number;
  onSelect: (rideId: string | null) => void;
};

const RIDE_SOURCE = "live-ride-points";
const DRIVER_SOURCE = "live-driver-points";
const RIDE_CLUSTERS = "live-ride-clusters";
const RIDE_COUNT = "live-ride-count";
const RIDES = "live-rides";
const DRIVER_CLUSTERS = "live-driver-clusters";
const DRIVER_COUNT = "live-driver-count";
const DRIVERS = "live-drivers";

const single: ExpressionSpecification = ["!", ["has", "point_count"]];

/** The label font of the base style: clusters need one that its glyph server has. */
function readLabelFont(map: { getStyle: () => { layers?: { type: string; layout?: unknown }[] } }) {
  const layer = map.getStyle().layers?.find((l) => {
    const font = (l.layout as Record<string, unknown> | undefined)?.["text-font"];
    return l.type === "symbol" && Array.isArray(font);
  });
  const font = (layer?.layout as Record<string, unknown> | undefined)?.["text-font"];
  if (!Array.isArray(font)) return null;
  const stack = font[0] === "literal" && Array.isArray(font[1]) ? font[1] : font;
  return stack.every((f) => typeof f === "string") ? (stack as string[]) : null;
}

export default function LiveMap({ rides, drivers, selectedId, fitKey = 0, onSelect }: LiveMapProps) {
  const t = useTranslations("live.map");
  const { resolvedTheme } = useTheme();
  const mapRef = useRef<MapRef>(null);
  const [labelFont, setLabelFont] = useState<string[] | null>(null);
  const [cursor, setCursor] = useState("");
  const fitted = useRef<number | null>(null);

  const rideData = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: rides.map((r) => ({
        type: "Feature" as const,
        properties: {
          id: r.id,
          tone: r.tone,
          attention: r.attention ? 1 : 0,
          stale: r.stale ? 1 : 0,
        },
        geometry: { type: "Point" as const, coordinates: [r.lng, r.lat] },
      })),
    }),
    [rides],
  );
  const driverData = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: drivers.map((d) => ({
        type: "Feature" as const,
        properties: { id: d.id },
        geometry: { type: "Point" as const, coordinates: [d.lng, d.lat] },
      })),
    }),
    [drivers],
  );

  const fit = useCallback(() => {
    const map = mapRef.current;
    const points = rides.length ? rides : drivers;
    if (!map || points.length === 0) return;
    const lngs = points.map((p) => p.lng);
    const lats = points.map((p) => p.lat);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 64, maxZoom: 13, duration: 600 },
    );
  }, [rides, drivers]);

  // Fit once when the first positions arrive, and again on "Fit all".
  useEffect(() => {
    if (fitted.current === fitKey) return;
    if (rides.length === 0 && drivers.length === 0) return;
    fitted.current = fitKey;
    fit();
  }, [fitKey, fit, rides.length, drivers.length]);

  const selected = selectedId ? rides.find((r) => r.id === selectedId) : undefined;
  const selectedLat = selected?.lat;
  const selectedLng = selected?.lng;
  const flownTo = useRef<string | null>(null);
  // Selecting a ride (from the list or the map) centres it, once per selection.
  useEffect(() => {
    if (!selectedId) {
      flownTo.current = null;
      return;
    }
    if (flownTo.current === selectedId || selectedLat === undefined || selectedLng === undefined) return;
    const map = mapRef.current;
    if (!map) return;
    flownTo.current = selectedId;
    map.easeTo({ center: [selectedLng, selectedLat], zoom: Math.max(map.getZoom(), 13), duration: 600 });
  }, [selectedId, selectedLat, selectedLng]);

  const onClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    const map = mapRef.current;
    if (!feature || !map) return onSelect(null);
    const props = feature.properties as Record<string, unknown>;
    if (props.cluster_id !== undefined) {
      const source = map.getSource(feature.source) as GeoJSONSource | undefined;
      const coordinates = (feature.geometry as { coordinates: unknown }).coordinates as [number, number];
      source?.getClusterExpansionZoom(Number(props.cluster_id)).then((zoom) => {
        map.easeTo({ center: coordinates, zoom: Math.min(zoom + 0.5, 16), duration: 500 });
      });
      return;
    }
    onSelect(feature.source === RIDE_SOURCE ? String(props.id) : null);
  };

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: -9.14, latitude: 38.72, zoom: 8 }}
      mapStyle={resolvedTheme === "dark" ? STYLE.dark : STYLE.light}
      attributionControl={{ compact: true }}
      aria-label={t("label")}
      style={{ width: "100%", height: "100%" }}
      cursor={cursor}
      interactiveLayerIds={[RIDE_CLUSTERS, RIDES, DRIVER_CLUSTERS, DRIVERS]}
      onLoad={(event) => setLabelFont(readLabelFont(event.target))}
      onClick={onClick}
      onMouseEnter={() => setCursor("pointer")}
      onMouseLeave={() => setCursor("")}
    >
      <NavigationControl showCompass={false} position="top-left" />
      {/* Available drivers: their own grey clusters, under the rides, so a crowd of idle cars never hides a ride. */}
      <Source
        id={DRIVER_SOURCE}
        type="geojson"
        data={driverData}
        cluster
        clusterRadius={50}
        clusterMaxZoom={13}
      >
        <Layer
          id={DRIVER_CLUSTERS}
          type="circle"
          filter={["has", "point_count"]}
          paint={{
            "circle-color": LIVE_COLOURS.driver,
            "circle-radius": ["step", ["get", "point_count"], 13, 25, 16, 100, 20],
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.8,
          }}
        />
        {labelFont && (
          <Layer
            id={DRIVER_COUNT}
            type="symbol"
            filter={["has", "point_count"]}
            layout={{
              "text-field": ["get", "point_count_abbreviated"],
              "text-font": labelFont,
              "text-size": 11,
              // Rides sit on top: where a driver cluster lies under a ride cluster, only the ride's count shows.
              "text-allow-overlap": false,
            }}
            paint={{ "text-color": "#ffffff" }}
          />
        )}
        <Layer
          id={DRIVERS}
          type="circle"
          filter={single}
          paint={{
            "circle-color": LIVE_COLOURS.driver,
            "circle-radius": 4.5,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.85,
          }}
        />
      </Source>
      <Source
        id={RIDE_SOURCE}
        type="geojson"
        data={rideData}
        cluster
        clusterRadius={40}
        clusterMaxZoom={12}
        clusterProperties={{ attention: ["+", ["get", "attention"]] }}
      >
        <Layer
          id={RIDE_CLUSTERS}
          type="circle"
          filter={["has", "point_count"]}
          paint={{
            "circle-color": [
              "case",
              [">", ["get", "attention"], 0],
              LIVE_COLOURS.emergency,
              LIVE_COLOURS.inProgress,
            ],
            "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 50, 26],
            "circle-stroke-width": 3,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.92,
          }}
        />
        {labelFont && (
          <Layer
            id={RIDE_COUNT}
            type="symbol"
            filter={["has", "point_count"]}
            layout={{
              "text-field": ["get", "point_count_abbreviated"],
              "text-font": labelFont,
              "text-size": 12,
              "text-allow-overlap": true,
            }}
            paint={{ "text-color": "#ffffff" }}
          />
        )}
        <Layer
          id={RIDES}
          type="circle"
          filter={single}
          paint={{
            "circle-color": [
              "match",
              ["get", "tone"],
              "searching",
              LIVE_COLOURS.searching,
              "pickup",
              LIVE_COLOURS.pickup,
              "inProgress",
              LIVE_COLOURS.inProgress,
              "emergency",
              LIVE_COLOURS.emergency,
              LIVE_COLOURS.driver,
            ],
            "circle-radius": ["case", ["==", ["get", "tone"], "emergency"], 10, 8],
            "circle-stroke-width": ["case", [">", ["get", "attention"], 0], 4, 2],
            "circle-stroke-color": [
              "case",
              [">", ["get", "attention"], 0],
              LIVE_COLOURS.emergency,
              "#ffffff",
            ],
            "circle-opacity": ["case", [">", ["get", "stale"], 0], 0.45, 1],
            "circle-stroke-opacity": ["case", [">", ["get", "stale"], 0], 0.6, 1],
          }}
        />
      </Source>
      {selected && (
        <Marker longitude={selected.lng} latitude={selected.lat} style={{ pointerEvents: "none" }}>
          <span
            aria-hidden
            className="block size-9 animate-pulse rounded-full border-[3px] border-foreground bg-foreground/10"
          />
        </Marker>
      )}
    </Map>
  );
}
