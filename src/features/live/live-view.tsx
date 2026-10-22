"use client";

import { useMemo, useState } from "react";
import { Car, List, LocateFixed, MapPinOff, Navigation, TriangleAlert } from "lucide-react";
import { parseAsBoolean, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useTranslations } from "next-intl";
import { LIVE_COLOURS, liveTone } from "@/components/map/live-colours";
import { LiveMap } from "@/components/map/lazy-map";
import {
  SearchInput,
  SingleSelectFilter,
  ToggleFilter,
} from "@/components/data/filter-bar";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useLiveSnapshot } from "@/hooks/queries/live";
import { useSlowTick } from "@/lib/use-ticker";
import { cn } from "@/lib/utils";
import { Ago } from "./ago";
import { LiveDrawer } from "./live-drawer";
import { LiveList } from "./live-list";
import { LIVE_GROUPS, inGroup, needsAttention, toItem, type LiveGroup } from "./live-utils";

const parsers = {
  q: parseAsString.withDefault(""),
  group: parseAsStringLiteral(LIVE_GROUPS).withDefault("all"),
  attention: parseAsBoolean.withDefault(false),
  drivers: parseAsBoolean.withDefault(true),
  ride: parseAsString,
};

function Stat({
  icon: Icon,
  label,
  value,
  tone = "neutral",
  onClick,
  pressed,
}: {
  icon: typeof Car;
  label: string;
  value: number;
  tone?: "neutral" | "danger";
  onClick?: () => void;
  pressed?: boolean;
}) {
  const body = (
    <>
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          tone === "danger" && value > 0
            ? "bg-danger-soft text-destructive"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon aria-hidden className="size-4" />
      </span>
      <span className="flex flex-col text-left">
        <span className="text-section tabular leading-tight">{value}</span>
        <span className="text-caption">{label}</span>
      </span>
    </>
  );
  const className = "flex items-center gap-3 p-3";
  return (
    <Card className="gap-0 py-0">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-pressed={pressed}
          className={cn(
            className,
            "w-full rounded-xl outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
            pressed && "bg-accent",
          )}
        >
          {body}
        </button>
      ) : (
        <div className={className}>{body}</div>
      )}
    </Card>
  );
}

function LiveSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[68px]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Skeleton className="h-[32rem]" />
        <Skeleton className="h-[32rem]" />
      </div>
    </div>
  );
}

/**
 * Live ride monitoring (§10): a full-height map of the active rides and the
 * available drivers, with a side list in step with it. Positions refresh every
 * 5 s (polling, until the admin socket channel exists); every marker and row
 * says how old its position is, and a ride with a stale (> 60 s) or missing
 * position, a long wait or an SOS is flagged and can be filtered ("needs
 * attention"). Picking a ride opens a drawer with a link to its full page.
 */
export function LiveView() {
  const t = useTranslations("live");
  const query = useLiveSnapshot();
  const clock = useSlowTick();
  const [state, setState] = useQueryStates(parsers, {
    history: "replace",
    clearOnDefault: true,
    scroll: false,
  });
  const [fitKey, setFitKey] = useState(0);
  const [panel, setPanel] = useState<"map" | "list">("map");

  const snapshot = query.data;
  // Re-judge staleness every 5 s even if a poll fails, so a frozen feed shows up as stale.
  const items = useMemo(
    () => snapshot?.rides.map((r) => toItem(r, clock || Date.parse(snapshot.at))) ?? [],
    [snapshot, clock],
  );

  const filtered = useMemo(() => {
    const q = state.q.toLowerCase();
    return items.filter(
      (r) =>
        inGroup(r.status, state.group) &&
        (!state.attention || needsAttention(r)) &&
        (!q ||
          [r.rideId, r.customerName, r.driverName, r.vehiclePlate, r.driverId]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(q))),
    );
  }, [items, state.q, state.group, state.attention]);

  const mapRides = useMemo(
    () =>
      filtered.flatMap((r) =>
        r.location
          ? [
              {
                id: r.rideId,
                lat: r.location.lat,
                lng: r.location.lng,
                tone: liveTone(r.status),
                attention: needsAttention(r),
                stale: r.stale,
              },
            ]
          : [],
      ),
    [filtered],
  );
  const mapDrivers = useMemo(
    () =>
      state.drivers && snapshot
        ? snapshot.availableDrivers.map((d) => ({ id: d.driverId, lat: d.location.lat, lng: d.location.lng }))
        : [],
    [state.drivers, snapshot],
  );

  if (query.isPending) return <LiveSkeleton />;
  if (!snapshot) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;

  const attentionCount = items.filter(needsAttention).length;
  const withoutLocation = filtered.filter((r) => !r.location).length;
  const onlineDrivers = items.filter((r) => r.driverId).length + snapshot.availableDrivers.length;
  const selected = state.ride ? items.find((r) => r.rideId === state.ride) : undefined;
  const hasFilters = Boolean(state.q) || state.group !== "all" || state.attention;
  const select = (id: string | null) => setState({ ride: id });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-page-title">{t("title")}</h1>
          <p className="text-dense text-muted-foreground">{t("subtitle")}</p>
        </div>
        <p
          className="text-caption flex items-center gap-1.5"
          aria-live="off"
          data-testid="live-updated"
        >
          <span className="relative flex size-2">
            <span
              className={cn(
                "absolute inline-flex size-full animate-ping rounded-full opacity-60",
                query.isError ? "bg-warning" : "bg-success",
              )}
            />
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                query.isError ? "bg-warning" : "bg-success",
              )}
            />
          </span>
          {t("updated")} <Ago iso={snapshot.at} />
        </p>
      </div>

      {query.isError && <InlineAlert tone="warning">{t("connectionLost")}</InlineAlert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Navigation} label={t("kpi.activeRides")} value={items.length} />
        <Stat icon={Car} label={t("kpi.onlineDrivers")} value={onlineDrivers} />
        <Stat
          icon={TriangleAlert}
          label={t("kpi.needsAttention")}
          value={attentionCount}
          tone="danger"
          pressed={state.attention}
          onClick={() => setState({ attention: !state.attention || null })}
        />
        <Stat
          icon={MapPinOff}
          label={t("kpi.noLocation")}
          value={items.filter((r) => !r.location).length}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={state.q}
          onChange={(q) => setState({ q: q || null })}
          placeholder={t("filters.search")}
        />
        <SingleSelectFilter
          label={t("filters.status")}
          options={LIVE_GROUPS.filter((g) => g !== "all").map((g) => ({
            value: g,
            label: t(`groups.${g}`),
          }))}
          value={state.group === "all" ? null : state.group}
          onChange={(v) => setState({ group: (v as LiveGroup | null) ?? null })}
        />
        <ToggleFilter
          label={t("filters.attention")}
          pressed={state.attention}
          onChange={(on) => setState({ attention: on || null })}
        />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setState({ q: null, group: null, attention: null })}
          >
            {t("filters.clear")}
          </Button>
        )}
        <div className="ml-auto flex rounded-lg border p-0.5 lg:hidden" role="group" aria-label={t("panel.label")}>
          {(["map", "list"] as const).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={panel === p ? "default" : "ghost"}
              aria-pressed={panel === p}
              onClick={() => setPanel(p)}
            >
              {p === "list" && <List />}
              {t(`panel.${p}`)}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:h-[calc(100svh-22rem)] lg:min-h-[30rem] lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card
          className={cn(
            "min-h-0 gap-0 overflow-hidden py-0",
            panel === "list" ? "flex h-[70svh]" : "hidden lg:flex",
          )}
        >
          <div className="flex items-center justify-between border-b px-3 py-2.5">
            <h2 className="text-dense font-medium">{t("list.title", { count: filtered.length })}</h2>
            {withoutLocation > 0 && (
              <span className="text-caption flex items-center gap-1">
                <MapPinOff aria-hidden className="size-3.5" />
                {t("list.withoutLocation", { n: withoutLocation })}
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto" data-testid="live-list">
            {filtered.length === 0 ? (
              <EmptyState
                filtered={hasFilters}
                title={hasFilters ? undefined : t("list.empty")}
                description={hasFilters ? undefined : t("list.emptyHint")}
                onClearFilters={() => setState({ q: null, group: null, attention: null })}
              />
            ) : (
              <LiveList
                items={filtered}
                selectedId={state.ride}
                onSelect={(id) => {
                  select(id);
                  setPanel("map");
                }}
              />
            )}
          </div>
        </Card>

        <Card
          className={cn(
            "min-h-0 gap-0 overflow-hidden py-0",
            panel === "map" ? "flex h-[70svh] lg:h-auto" : "hidden lg:flex",
          )}
        >
          <div className="text-caption flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-2">
            <ul
              className="flex max-w-full items-center gap-x-3 gap-y-1 overflow-x-auto whitespace-nowrap sm:flex-wrap"
              aria-label={t("map.legend")}
            >
              {(
                [
                  ["searching", LIVE_COLOURS.searching],
                  ["toPickup", LIVE_COLOURS.pickup],
                  ["inProgress", LIVE_COLOURS.inProgress],
                  ["emergency", LIVE_COLOURS.emergency],
                ] as const
              ).map(([key, colour]) => (
                <li key={key} className="flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 rounded-full" style={{ background: colour }} />
                  {t(`groups.${key}`)}
                </li>
              ))}
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2.5 rounded-full border-2 bg-background"
                  style={{ borderColor: LIVE_COLOURS.emergency }}
                />
                {t("map.attentionRing")}
              </li>
              <li className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ background: LIVE_COLOURS.driver }}
                />
                {t("map.availableDriver")}
              </li>
            </ul>
            <div className="ml-auto flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2">
                <Switch
                  size="sm"
                  checked={state.drivers}
                  onCheckedChange={(on) => setState({ drivers: on ? null : false })}
                />
                {t("map.showDrivers", { count: snapshot.availableDrivers.length })}
              </label>
              <Button variant="outline" size="sm" onClick={() => setFitKey((k) => k + 1)}>
                <LocateFixed />
                {t("map.fitAll")}
              </Button>
            </div>
          </div>
          <div className="relative min-h-0 flex-1" data-testid="live-map">
            <LiveMap
              rides={mapRides}
              drivers={mapDrivers}
              selectedId={state.ride}
              fitKey={fitKey}
              onSelect={select}
            />
            {selected && <LiveDrawer ride={selected} onClose={() => select(null)} />}
          </div>
        </Card>
      </div>
    </div>
  );
}
