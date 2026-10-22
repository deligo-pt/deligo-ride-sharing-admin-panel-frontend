"use client";

import { useTranslations } from "next-intl";
import type { CategoryPoint, TrendPoint } from "@/types/analytics";
import { CategoryChart, RevenueChart, RidesPerDayChart } from "@/components/charts/lazy-charts";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Query<T> = {
  data: T | undefined;
  isPending: boolean;
  isFetching: boolean;
  error: unknown;
  refetch: () => unknown;
};

/** A chart card with the page's four states (§H): loading, error, empty, data. */
function ChartCard<T>({
  title,
  description,
  query,
  isEmpty,
  label,
  className,
  children,
}: {
  title: string;
  description: string;
  query: Query<T>;
  isEmpty: (data: T) => boolean;
  /** Read by screen readers instead of the (visual) chart. */
  label: (data: T) => string;
  className?: string;
  children: (data: T) => React.ReactNode;
}) {
  const t = useTranslations("dashboard.charts");
  const data = query.data;
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-card-title">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        {query.isPending ? (
          <Skeleton className="size-full" aria-hidden />
        ) : data === undefined ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} className="py-6" />
        ) : isEmpty(data) ? (
          <EmptyState title={t("emptyTitle")} description={t("emptyBody")} className="py-6" />
        ) : (
          <div
            role="img"
            aria-label={label(data)}
            className={cn("size-full transition-opacity", query.isFetching && "opacity-60")}
          >
            {children(data)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const sum = (points: TrendPoint[], key: "rides" | "completed" | "cancelled") =>
  points.reduce((total, p) => total + p[key], 0);

export function RidesChartCard({ query }: { query: Query<TrendPoint[]> }) {
  const t = useTranslations("dashboard.charts");
  return (
    <ChartCard
      title={t("ridesTitle")}
      description={t("ridesDescription")}
      query={query}
      isEmpty={(points) => sum(points, "rides") === 0}
      label={(points) =>
        t("ridesLabel", {
          completed: sum(points, "completed"),
          cancelled: sum(points, "cancelled"),
        })
      }
    >
      {(points) => <RidesPerDayChart points={points} />}
    </ChartCard>
  );
}

export function RevenueChartCard({ query }: { query: Query<TrendPoint[]> }) {
  const t = useTranslations("dashboard.charts");
  return (
    <ChartCard
      title={t("revenueTitle")}
      description={t("revenueDescription")}
      query={query}
      isEmpty={(points) => points.every((p) => p.revenueCents === 0)}
      label={() => t("revenueLabel")}
    >
      {(points) => <RevenueChart points={points} />}
    </ChartCard>
  );
}

export function CategoryChartCard({
  query,
  className,
}: {
  query: Query<CategoryPoint[]>;
  className?: string;
}) {
  const t = useTranslations("dashboard.charts");
  return (
    <ChartCard
      title={t("categoryTitle")}
      description={t("categoryDescription")}
      query={query}
      className={className}
      isEmpty={(points) => points.every((p) => p.rides === 0)}
      label={() => t("categoryLabel")}
    >
      {(points) => <CategoryChart points={points} />}
    </ChartCard>
  );
}
