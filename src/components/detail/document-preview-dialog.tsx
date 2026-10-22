"use client";

import Image from "next/image";
import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DocumentListItem } from "@/types/document";
import { StatusBadge } from "@/components/badges/status-badge";
import { ErrorState } from "@/components/feedback/states";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocument } from "@/hooks/queries/documents";
import { useFormat } from "@/lib/use-format";
import { KeyValueGrid, Timeline } from "./detail-parts";

/**
 * Preview of one compliance document with its review history (§18). Opening
 * it is audited by the service (`document.view`: documents are sensitive).
 * The prototype has placeholder images and PDFs — no real uploads.
 * `actions` = the approve / reject buttons the caller allows for this role.
 */
export function DocumentPreviewDialog({
  documentId,
  onOpenChange,
  actions,
}: {
  documentId: string | null;
  onOpenChange: (open: boolean) => void;
  actions?: (document: DocumentListItem) => React.ReactNode;
}) {
  return (
    <Dialog open={documentId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        {documentId && <PreviewBody documentId={documentId} actions={actions} />}
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({
  documentId,
  actions,
}: {
  documentId: string;
  actions?: (document: DocumentListItem) => React.ReactNode;
}) {
  const t = useTranslations();
  const f = useFormat();
  const query = useDocument(documentId);

  if (query.isPending) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t("documents.preview.loading")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("documents.preview.loading")}
          </DialogDescription>
        </DialogHeader>
        <Skeleton className="aspect-[800/560] w-full" aria-hidden />
      </>
    );
  }
  if (query.isError) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t("documents.preview.title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("documents.preview.title")}</DialogDescription>
        </DialogHeader>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} className="py-8" />
      </>
    );
  }

  const doc = query.data;
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex flex-wrap items-center gap-2">
          {t(`enums.documentType.${doc.type}`)}
          <StatusBadge kind="document" value={doc.status} />
        </DialogTitle>
        <DialogDescription>
          {doc.ownerName} · {doc.fileName}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="overflow-hidden rounded-lg border bg-muted">
          {doc.fileKind === "image" && doc.fileUrl ? (
            <Image
              src={doc.fileUrl}
              alt={t("documents.preview.imageAlt", { type: t(`enums.documentType.${doc.type}`) })}
              width={800}
              height={560}
              className="h-auto w-full"
            />
          ) : (
            <div className="grid aspect-[800/560] place-items-center gap-2 p-6 text-center">
              <span className="grid justify-items-center gap-2 text-muted-foreground">
                <FileText aria-hidden className="size-10" />
                <span className="text-dense font-medium text-foreground">{doc.fileName}</span>
                <span className="text-caption">{t("documents.preview.pdf")}</span>
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <KeyValueGrid
            columns={1}
            items={[
              { label: t("documents.preview.submitted"), value: f.dateTime(doc.submittedAt) },
              {
                label: t("documents.preview.expires"),
                value: doc.expiresAt ? f.date(doc.expiresAt) : t("documents.preview.noExpiry"),
              },
              ...(doc.rejectionReason
                ? [{ label: t("documents.preview.reason"), value: doc.rejectionReason }]
                : []),
            ]}
          />
          <div className="flex flex-col gap-2">
            <h3 className="text-dense font-semibold">{t("documents.preview.history")}</h3>
            <Timeline
              items={[...doc.reviewHistory].reverse().map((entry, index) => ({
                id: `${entry.at}-${index}`,
                title: t(`documents.review.${entry.status}`),
                at: entry.at,
                by: entry.by,
                description: entry.reason,
                tone:
                  entry.status === "APPROVED"
                    ? "success"
                    : entry.status === "REJECTED" || entry.status === "RESUBMISSION_REQUESTED"
                      ? "danger"
                      : "default",
              }))}
            />
          </div>
        </div>
      </div>
      {actions && <DialogFooter>{actions(doc)}</DialogFooter>}
    </>
  );
}
