"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import type { DocumentListParams } from "@/types/document";
import { getDocument, getDocumentSummary, listDocuments } from "@/services/documents";

export function useDocuments(params: DocumentListParams) {
  return useQuery({ queryKey: qk.documents.list(params), queryFn: () => listDocuments(params), placeholderData: keepPreviousData });
}

export function useDocument(id: string) {
  return useQuery({ queryKey: qk.documents.detail(id), queryFn: () => getDocument(id) });
}

export function useDocumentSummary() {
  return useQuery({ queryKey: qk.documents.summary(), queryFn: getDocumentSummary });
}
