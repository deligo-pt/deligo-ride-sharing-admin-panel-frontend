"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isServiceError } from "@/lib/service-error";
import { cn } from "@/lib/utils";

/** Same minimum as services/_shared.ts `requireReason`. */
const MIN = 10;

/**
 * Sensitive or destructive actions (§G): the admin writes a reason (≥ 10
 * characters), it goes to the mutation and ends up in the audit log. Stays
 * open while saving; a VALIDATION error on `reason` shows under the field;
 * other errors are the caller's (toast). `blocked` = the action is not
 * possible right now (e.g. suspending someone on a ride): the message shows
 * above the field and the confirm button stays disabled. `checking` = the
 * caller is still finding that out.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  blocked,
  checking = false,
  extra,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  blocked?: React.ReactNode;
  checking?: boolean;
  /** More fields above the reason (a fleet picker, a document checklist). The caller keeps their state. */
  extra?: React.ReactNode;
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  const t = useTranslations();
  const id = useId();
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const length = reason.trim().length;
  const tooShort = length < MIN;

  const close = (next: boolean) => {
    if (pending) return;
    if (!next) {
      setReason("");
      setTouched(false);
      setServerError(null);
    }
    onOpenChange(next);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (tooShort) return;
    setPending(true);
    setServerError(null);
    try {
      await onConfirm(reason.trim());
      setPending(false);
      close(false);
    } catch (error) {
      setPending(false);
      if (isServiceError(error) && error.field === "reason") setServerError(error.message);
    }
  };

  const showError = !blocked && ((touched && tooShort) || serverError);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {blocked && <InlineAlert tone="danger">{blocked}</InlineAlert>}
          {extra}
          <div className="flex flex-col gap-2">
            <Label htmlFor={id}>{t("dialogs.reasonLabel")}</Label>
            <Textarea
              id={id}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder={t("dialogs.reasonPlaceholder")}
              rows={4}
              maxLength={500}
              aria-invalid={Boolean(showError)}
              aria-describedby={`${id}-hint`}
              autoFocus
            />
            <p id={`${id}-hint`} className={cn("text-caption", showError && "text-destructive")}>
              {showError
                ? t("dialogs.reasonTooShort", { min: MIN })
                : t("dialogs.reasonCount", { count: length, min: MIN })}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={pending}>
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              disabled={pending || checking || Boolean(blocked)}
            >
              {pending || checking ? t("dialogs.working") : (confirmLabel ?? t("common.confirm"))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
