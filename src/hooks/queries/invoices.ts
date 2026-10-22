"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { InvoiceListParams } from "@/types/invoice";
import { getInvoice, getTaxSummary, listInvoices } from "@/services/invoices";

export function useInvoices(params: InvoiceListParams) {
  return useQuery({ queryKey: qk.invoices.list(params), queryFn: () => listInvoices(params), placeholderData: keepPreviousData });
}

export function useInvoice(id: string) {
  return useQuery({ queryKey: qk.invoices.detail(id), queryFn: () => getInvoice(id) });
}

export function useTaxSummary() {
  return useQuery({ queryKey: qk.invoices.tax(), queryFn: getTaxSummary });
}
