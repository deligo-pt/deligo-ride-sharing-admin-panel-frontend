"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AdminNote } from "@/types/common";
import { Can } from "@/components/session/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { PermissionModule } from "@/config/roles";
import { ActivityList } from "./detail-parts";

/**
 * Internal notes (§5, §6, §7…): the list plus an "add note" form for roles
 * with `<module>.edit`. `onAdd` runs the mutation and resolves when saved, so
 * the box empties only on success.
 */
export function NotesCard({
  module,
  notes,
  placeholder,
  addLabel,
  emptyLabel,
  onAdd,
}: {
  module: PermissionModule;
  notes: AdminNote[];
  placeholder: string;
  addLabel: string;
  emptyLabel: string;
  onAdd: (text: string) => Promise<unknown>;
}) {
  const t = useTranslations("dialogs");
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setPending(true);
    try {
      await onAdd(value);
      setText("");
    } catch {
      // The caller shows the error; keep the text so nothing is lost.
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <Can module={module} action="edit">
          <form className="flex flex-col gap-2" onSubmit={submit}>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              aria-label={addLabel}
              rows={3}
              maxLength={2000}
            />
            <Button type="submit" size="sm" className="self-end" disabled={!text.trim() || pending}>
              {pending ? t("working") : addLabel}
            </Button>
          </form>
        </Can>
        <ActivityList entries={notes} emptyLabel={emptyLabel} />
      </CardContent>
    </Card>
  );
}
