"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Charts load on demand (§G): recharts is ~100 kB gz and no page needs it for
 * first paint. Use these wrappers, never import `trend-charts` directly.
 */
const Loading = () => <Skeleton className="size-full min-h-40" aria-hidden />;

export const RidesPerDayChart = dynamic(
  () => import("./trend-charts").then((m) => m.RidesPerDayChart),
  { ssr: false, loading: Loading },
);
export const RevenueChart = dynamic(() => import("./trend-charts").then((m) => m.RevenueChart), {
  ssr: false,
  loading: Loading,
});
export const CategoryChart = dynamic(() => import("./trend-charts").then((m) => m.CategoryChart), {
  ssr: false,
  loading: Loading,
});
export const EarningsChart = dynamic(() => import("./trend-charts").then((m) => m.EarningsChart), {
  ssr: false,
  loading: Loading,
});
