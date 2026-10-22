"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { NotificationListParams } from "@/types/notification";
import { getNotification, listNotifications } from "@/services/notifications";

export function useNotifications(params: NotificationListParams) {
  return useQuery({ queryKey: qk.notifications.list(params), queryFn: () => listNotifications(params), placeholderData: keepPreviousData });
}

export function useNotification(id: string) {
  return useQuery({ queryKey: qk.notifications.detail(id), queryFn: () => getNotification(id) });
}
