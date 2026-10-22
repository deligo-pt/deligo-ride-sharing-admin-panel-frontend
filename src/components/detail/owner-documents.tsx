"use client";

import { useState } from "react";
import type { QueryKey } from "@tanstack/react-query";
import { Check, Eye, FileText, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { DocumentListItem } from "@/types/document";
import { StatusBadge } from "@/components/badges/status-badge";
import { ReasonDialog } from "@/components/dialogs/reason-dialog";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { usePermission } from "@/components/session/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocuments } from "@/hooks/queries/documents";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { qk } from "@/lib/query-keys";
import { isServiceError } from "@/lib/service-error";
import { useFormat } from "@/lib/use-format";
import { approveDocument, rejectDocument } from "@/services/documents";
import { DocumentPreviewDialog } from "./document-preview-dialog";

/**
 * The documents one owner (driver, fleet, vehicle) has sent: preview, approve,
 * reject with the reason the owner will see (§6, §7, §18). Needs
 * `documents.view`; approve/reject need `documents.approve`. `invalidate` =
 * the owner's own queries (their checklist and status), refreshed after each
 * review. `headerAction` = an extra button next to the title ("ask for new
 * documents").
 */
export function OwnerDocuments({
  ownerId,
  invalidate,
  headerAction,
}: {
  ownerId: string;
  invalidate: QueryKey[];
  headerAction?: React.ReactNode;
}) {
  const t = useTranslations("documents.owner");
  const tType = useTranslations("enums.documentType");
  const tError = useTranslations("feedback.errors");
  const f = useFormat();
  const allowed = usePermission();
  const query = useDocuments({ ownerId, page: 1, pageSize: 50, sort: "submittedAt:desc" });
  const [preview, setPreview] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<DocumentListItem | null>(null);
  const canReview = allowed("documents", "approve");
  const keys = [qk.documents.all, qk.dashboard.all, qk.audit.all, ...invalidate];

  const onError = (error: unknown) => {
    if (isServiceError(error) && error.field === "reason") return;
    toast.error(tError(isServiceError(error) ? error.code : "UNKNOWN"));
  };
  const approve = useServiceMutation({
    mutationFn: (id: string) => approveDocument(id),
    invalidate: keys,
    onSuccess: () => toast.success(t("approved")),
    onError,
  });
  const reject = useServiceMutation({
    mutationFn: (v: { id: string; reason: string }) => rejectDocument(v.id, v.reason),
    invalidate: keys,
    onSuccess: () => toast.success(t("rejected")),
    onError,
  });

  const reviewable = (d: DocumentListItem) => ({
    approve: d.status === "PENDING" || d.status === "REJECTED",
    reject: d.status === "PENDING" || d.status === "APPROVED",
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-card-title">{t("title")}</h2>
        {headerAction}
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-3" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} className="py-8" />
        </Card>
      ) : query.data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title={t("emptyTitle")}
            description={t("emptyBody")}
            className="py-10"
          />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {query.data.items.map((doc) => (
            <li key={doc.id}>
              <Card size="sm">
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-dense font-semibold">{tType(doc.type)}</span>
                      <StatusBadge kind="document" value={doc.status} />
                    </span>
                    <span className="text-caption">
                      {t("submitted", { date: f.date(doc.submittedAt) })}
                      {doc.expiresAt && ` · ${t("expires", { date: f.date(doc.expiresAt) })}`}
                    </span>
                    {doc.rejectionReason && (
                      <span className="text-caption text-destructive">{doc.rejectionReason}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPreview(doc.id)}>
                      <Eye />
                      {t("preview")}
                    </Button>
                    {canReview && reviewable(doc).approve && (
                      <Button
                        size="sm"
                        onClick={() => approve.mutate(doc.id)}
                        disabled={approve.isPending}
                      >
                        <Check />
                        {t("approve")}
                      </Button>
                    )}
                    {canReview && reviewable(doc).reject && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setRejecting(doc)}
                      >
                        <X />
                        {t("reject")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <DocumentPreviewDialog
        documentId={preview}
        onOpenChange={(open) => !open && setPreview(null)}
        actions={(doc) =>
          canReview && (
            <>
              {reviewable(doc).reject && (
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => (setPreview(null), setRejecting(doc))}
                >
                  <X />
                  {t("reject")}
                </Button>
              )}
              {reviewable(doc).approve && (
                <Button onClick={() => approve.mutate(doc.id)} disabled={approve.isPending}>
                  <Check />
                  {t("approve")}
                </Button>
              )}
            </>
          )
        }
      />
      <ReasonDialog
        key={rejecting?.id ?? "none"}
        open={rejecting !== null}
        onOpenChange={(open) => !open && setRejecting(null)}
        title={t("rejectTitle", { type: rejecting ? tType(rejecting.type) : "" })}
        description={t("rejectBody")}
        confirmLabel={t("reject")}
        destructive
        onConfirm={(reason) => reject.mutateAsync({ id: rejecting!.id, reason })}
      />
    </div>
  );
}
