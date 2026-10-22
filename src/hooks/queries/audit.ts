"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { AuditListParams } from "@/types/audit";
import { getAuditLog, listAuditLogs } from "@/services/audit";

export function useAuditLogs(params: AuditListParams) {
  return useQuery({ queryKey: qk.audit.list(params), queryFn: () => listAuditLogs(params), placeholderData: keepPreviousData });
}

export function useAuditLog(id: string) {
  return useQuery({ queryKey: qk.audit.detail(id), queryFn: () => getAuditLog(id) });
}
