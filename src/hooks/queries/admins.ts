"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { AdminListParams } from "@/types/admin";
import { getAdmin, listAdmins, listRoles } from "@/services/admins";

export function useAdmins(params: AdminListParams) {
  return useQuery({ queryKey: qk.admins.list(params), queryFn: () => listAdmins(params), placeholderData: keepPreviousData });
}

export function useAdmin(id: string) {
  return useQuery({ queryKey: qk.admins.detail(id), queryFn: () => getAdmin(id) });
}

export function useRoles() {
  return useQuery({ queryKey: qk.admins.roles(), queryFn: listRoles });
}
