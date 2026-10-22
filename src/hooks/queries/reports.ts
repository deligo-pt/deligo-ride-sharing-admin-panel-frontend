"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { ReportType } from "@/types/analytics";
import { getReport, type ReportParams } from "@/services/reports";

export function useReport(type: ReportType, params: ReportParams) {
  return useQuery({ queryKey: qk.reports.report(type, params), queryFn: () => getReport(type, params), placeholderData: keepPreviousData });
}
