"use client";

import { Component, useSyncExternalStore, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { MapPinOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import type { LiveMapProps } from "./live-map";
import type { RouteMapProps } from "./route-map";

/**
 * Maps load on demand (§G): maplibre is heavy and no page needs it for first
 * paint. Use this wrapper, never import `route-map` directly. If the browser
 * can't draw the map (no WebGL, offline tiles) the card falls back to the
 * addresses instead of breaking the page.
 */
const Loading = () => <Skeleton className="size-full min-h-64" aria-hidden />;
const RouteMapInner = dynamic(() => import("./route-map"), { ssr: false, loading: Loading });
const LiveMapInner = dynamic(() => import("./live-map"), { ssr: false, loading: Loading });

function Fallback() {
  const t = useTranslations("rides.map");
  return (
    <div className="grid size-full min-h-64 place-items-center bg-muted p-6 text-center">
      <span className="grid justify-items-center gap-2 text-muted-foreground">
        <MapPinOff aria-hidden className="size-8" />
        <span className="text-dense font-medium text-foreground">{t("unavailableTitle")}</span>
        <span className="text-caption max-w-xs">{t("unavailableBody")}</span>
      </span>
    </div>
  );
}

class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <Fallback /> : this.props.children;
  }
}

/** MapLibre needs WebGL 2. Checked once, in the browser (the server snapshot says "yes" so nothing mismatches). */
let webgl2: boolean | undefined;
function hasWebGL2() {
  if (webgl2 === undefined) {
    try {
      webgl2 = Boolean(document.createElement("canvas").getContext("webgl2"));
    } catch {
      webgl2 = false;
    }
  }
  return webgl2;
}
const subscribe = () => () => {};

export function RouteMap(props: RouteMapProps) {
  const supported = useSyncExternalStore(subscribe, hasWebGL2, () => true);
  if (!supported) return <Fallback />;
  return (
    <MapBoundary>
      <RouteMapInner {...props} />
    </MapBoundary>
  );
}

/** The live monitoring map (§10): same guard as `RouteMap` — no WebGL shows the fallback, not a crash. */
export function LiveMap(props: LiveMapProps) {
  const supported = useSyncExternalStore(subscribe, hasWebGL2, () => true);
  if (!supported) return <Fallback />;
  return (
    <MapBoundary>
      <LiveMapInner {...props} />
    </MapBoundary>
  );
}
