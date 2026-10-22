"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { checkResetToken, listDemoAccounts } from "@/services/auth";

export function useDemoAccounts() {
  return useQuery({
    queryKey: qk.auth.demoAccounts(),
    queryFn: listDemoAccounts,
    staleTime: Infinity,
  });
}

export function useResetToken(token: string) {
  return useQuery({
    queryKey: qk.auth.resetToken(token),
    queryFn: () => checkResetToken(token),
    enabled: token.length > 0,
  });
}
