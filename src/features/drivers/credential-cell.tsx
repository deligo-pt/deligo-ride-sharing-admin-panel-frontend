"use client";

import { useNow } from "next-intl";
import type { DriverCredential } from "@/types/driver";
import { StatusBadge } from "@/components/badges/status-badge";
import { useFormat } from "@/lib/use-format";

/**
 * Licence or TVDE certificate in a table or card: expiry date, and a badge
 * when it ends within 30 days ("Expiring soon") or already ended (§6).
 */
export function CredentialCell({
  credential,
}: {
  credential: Pick<DriverCredential, "expiresAt" | "status">;
}) {
  const f = useFormat();
  const now = useNow({ updateInterval: 3_600_000 });
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-dense whitespace-nowrap tabular-nums">
        {f.date(credential.expiresAt)}
      </span>
      {credential.status === "VALID" ? (
        <span className="text-caption">{f.relative(credential.expiresAt, now)}</span>
      ) : (
        <StatusBadge kind="credential" value={credential.status} />
      )}
    </div>
  );
}
