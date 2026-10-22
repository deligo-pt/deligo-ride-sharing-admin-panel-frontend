"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { DateRange } from "@/types/common";
import type { PaymentListParams } from "@/types/payment";
import { getPayment, getPaymentSummary, listPayments } from "@/services/payments";

export function usePayments(params: PaymentListParams) {
  return useQuery({ queryKey: qk.payments.list(params), queryFn: () => listPayments(params), placeholderData: keepPreviousData });
}

export function usePayment(id: string) {
  return useQuery({ queryKey: qk.payments.detail(id), queryFn: () => getPayment(id) });
}

export function usePaymentSummary(range: DateRange) {
  return useQuery({ queryKey: qk.payments.summary(range), queryFn: () => getPaymentSummary(range) });
}
