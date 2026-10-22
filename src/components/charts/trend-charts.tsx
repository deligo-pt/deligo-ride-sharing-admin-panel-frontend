"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { CategoryPoint, TrendPoint } from "@/types/analytics";
import { useFormat } from "@/lib/use-format";

/**
 * The dashboard charts (§4). Only `lazy-charts.tsx` imports this file, so
 * recharts stays out of every page's first-load JS (§G). Colours are the
 * theme's chart tokens (light and dark), never hex.
 */
const C = {
  rides: "var(--chart-1)",
  good: "var(--chart-3)",
  bad: "var(--chart-4)",
  revenue: "var(--chart-2)",
};
const CATEGORY_COLOURS = ["var(--chart-3)", "var(--chart-2)", "var(--chart-1)"];

/** recharts animates in JS, so the CSS reduced-motion rule doesn't reach it. */
function useAnimate() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

type Row = { bucket: string; [key: string]: number | string };

function useBucketLabels(points: TrendPoint[]) {
  const f = useFormat();
  const hourly = points[0]?.bucket.includes("T") ?? false;
  const axis = (bucket: string) =>
    hourly ? `${bucket.slice(11)}:00` : f.dayMonth(`${bucket}T12:00:00Z`);
  const title = (bucket: string) =>
    hourly
      ? `${f.dayMonth(`${bucket.slice(0, 10)}T12:00:00Z`)}, ${bucket.slice(11)}:00`
      : f.date(`${bucket}T12:00:00Z`);
  return { axis, title };
}

/** Tooltip with the same look as the cards. */
function ChartTooltip({
  active,
  payload,
  label,
  title,
  format,
}: TooltipContentProps & { title: (bucket: string) => string; format: (value: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-caption mb-1 font-medium">{title(String(label))}</p>
      <ul className="flex flex-col gap-0.5">
        {payload.map((entry) => (
          <li key={String(entry.dataKey)} className="text-dense flex items-center gap-2">
            <span aria-hidden className="size-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto pl-4 font-semibold tabular-nums">
              {format(Number(entry.value))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const AXIS = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--muted-foreground)", fontSize: 12 },
} as const;

export function RidesPerDayChart({ points }: { points: TrendPoint[] }) {
  const t = useTranslations("dashboard.charts");
  const animate = useAnimate();
  const f = useFormat();
  const { axis, title } = useBucketLabels(points);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={points as Row[]}
        margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
        accessibilityLayer
      >
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="bucket" tickFormatter={axis} minTickGap={24} {...AXIS} />
        <YAxis allowDecimals={false} {...AXIS} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={(props) => <ChartTooltip {...props} title={title} format={(v) => f.number(v)} />}
        />
        <Bar
          isAnimationActive={animate}
          dataKey="completed"
          name={t("completed")}
          stackId="rides"
          fill={C.good}
          radius={[0, 0, 0, 0]}
        />
        <Bar
          isAnimationActive={animate}
          dataKey="cancelled"
          name={t("cancelled")}
          stackId="rides"
          fill={C.bad}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueChart({ points }: { points: TrendPoint[] }) {
  const t = useTranslations("dashboard.charts");
  const animate = useAnimate();
  const f = useFormat();
  const { axis, title } = useBucketLabels(points);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={points as Row[]}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        accessibilityLayer
      >
        <defs>
          <linearGradient id="dash-revenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.revenue} stopOpacity={0.3} />
            <stop offset="100%" stopColor={C.revenue} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="dash-commission" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.rides} stopOpacity={0.3} />
            <stop offset="100%" stopColor={C.rides} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="bucket" tickFormatter={axis} minTickGap={24} {...AXIS} />
        <YAxis tickFormatter={(v: number) => f.eur(v, { compact: true })} width={56} {...AXIS} />
        <Tooltip
          content={(props) => <ChartTooltip {...props} title={title} format={(v) => f.eur(v)} />}
        />
        <Area
          isAnimationActive={animate}
          type="monotone"
          dataKey="revenueCents"
          name={t("revenue")}
          stroke={C.revenue}
          strokeWidth={2}
          fill="url(#dash-revenue)"
        />
        <Area
          isAnimationActive={animate}
          type="monotone"
          dataKey="commissionCents"
          name={t("commission")}
          stroke={C.rides}
          strokeWidth={2}
          fill="url(#dash-commission)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CategoryChart({ points }: { points: CategoryPoint[] }) {
  const t = useTranslations();
  const animate = useAnimate();
  const f = useFormat();
  const total = points.reduce((sum, p) => sum + p.rides, 0);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div className="relative size-32 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer>
            <Pie
              isAnimationActive={animate}
              data={points}
              dataKey="rides"
              nameKey="category"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={total ? 2 : 0}
              stroke="none"
            >
              {points.map((p, i) => (
                <Cell key={p.category} fill={CATEGORY_COLOURS[i % CATEGORY_COLOURS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-card-title tabular-nums">{f.number(total)}</p>
            <p className="text-caption">{t("dashboard.charts.rides")}</p>
          </div>
        </div>
      </div>
      <ul className="flex w-full min-w-0 flex-col gap-2.5">
        {points.map((p, i) => (
          <li key={p.category} className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: CATEGORY_COLOURS[i % CATEGORY_COLOURS.length] }}
            />
            <span className="text-dense flex-1 truncate">
              {t(`enums.rideCategory.${p.category}`)}
            </span>
            <span className="text-dense font-semibold tabular-nums">{f.number(p.rides)}</span>
            <span className="text-caption w-10 text-right tabular-nums">
              {total ? f.percent(p.rides / total, 0) : "—"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A driver's gross and net earnings per day (drivers → Earnings tab, §13). */
export function EarningsChart({
  points,
}: {
  points: { date: string; grossCents: number; netCents: number }[];
}) {
  const t = useTranslations("drivers.earnings");
  const f = useFormat();
  const animate = useAnimate();
  const day = (date: string) => f.dayMonth(`${date}T12:00:00Z`);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="date" tickFormatter={day} minTickGap={24} {...AXIS} />
        <YAxis tickFormatter={(v: number) => f.eur(v, { compact: true })} width={56} {...AXIS} />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.6 }}
          content={(props) => (
            <ChartTooltip
              {...props}
              title={(d) => f.date(`${d}T12:00:00Z`)}
              format={(v) => f.eur(v)}
            />
          )}
        />
        <Bar
          isAnimationActive={animate}
          dataKey="grossCents"
          name={t("gross")}
          fill={C.revenue}
          radius={[4, 4, 0, 0]}
        />
        <Bar
          isAnimationActive={animate}
          dataKey="netCents"
          name={t("net")}
          fill={C.good}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
