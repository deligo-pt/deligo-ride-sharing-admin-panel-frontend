"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { IncidentListParams, TicketListParams } from "@/types/support";
import { getIncident, getTicket, listIncidents, listTickets } from "@/services/support";

export function useTickets(params: TicketListParams) {
  return useQuery({ queryKey: qk.support.list(params), queryFn: () => listTickets(params), placeholderData: keepPreviousData });
}

export function useTicket(id: string) {
  return useQuery({ queryKey: qk.support.detail(id), queryFn: () => getTicket(id) });
}

export function useIncidents(params: IncidentListParams) {
  return useQuery({ queryKey: qk.support.incidents(params), queryFn: () => listIncidents(params), placeholderData: keepPreviousData });
}

export function useIncident(id: string) {
  return useQuery({ queryKey: qk.support.incident(id), queryFn: () => getIncident(id) });
}
