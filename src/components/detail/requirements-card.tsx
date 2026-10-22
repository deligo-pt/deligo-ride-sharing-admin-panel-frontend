"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, Clock, FileX, Hourglass } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DriverEligibility, DriverRequirement, RequirementState } from "@/types/driver";
import { ErrorState } from "@/components/feedback/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const STATE_STYLE: Record<
  RequirementState,
  { icon: typeof CheckCircle2; badge: "success" | "info" | "danger" | "warning" | "neutral" }
> = {
  OK: { icon: CheckCircle2, badge: "success" },
  PENDING: { icon: Hourglass, badge: "info" },
  REJECTED: { icon: FileX, badge: "danger" },
  EXPIRED: { icon: Clock, badge: "warning" },
  MISSING: { icon: CircleAlert, badge: "neutral" },
};

/** "Citizen card or residence permit" — the alternatives of one requirement. */
export function useRequirementLabel() {
  const t = useTranslations("enums.documentType");
  return (requirement: DriverRequirement) =>
    requirement.options.map((type) => t(type)).join(` ${t("or")} `);
}

/** State names ("Valid", "Waiting for review"…) shared by every checklist. */
export function useRequirementStateLabel() {
  const t = useTranslations("documents.requirementState");
  return (state: RequirementState) => t(state);
}

/**
 * Checklist of mandatory documents and whether each is valid — a driver's
 * eligibility (§6), a fleet's onboarding (§7). The owner can only be approved
 * when every line is OK; otherwise this list is the reason. The caller passes
 * the query and the texts for its own module.
 */
export function RequirementsCard({
  query,
  title,
  description,
  okLabel,
  unmetLabel,
}: {
  query: UseQueryResult<DriverEligibility>;
  title: string;
  description: string;
  okLabel: string;
  unmetLabel: (count: number) => string;
}) {
  const label = useRequirementLabel();
  const stateLabel = useRequirementStateLabel();
  const unmet = query.data?.requirements.filter((r) => r.state !== "OK").length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-title flex flex-wrap items-center gap-2">
          {title}
          {query.data && (
            <Badge variant={query.data.eligible ? "success" : "warning"} className="text-micro h-5">
              {query.data.eligible ? okLabel : unmetLabel(unmet)}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <div className="flex flex-col gap-2" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} className="py-6" />
        ) : (
          <ul className="flex flex-col divide-y">
            {query.data.requirements.map((r) => {
              const { icon: Icon, badge } = STATE_STYLE[r.state];
              return (
                <li key={r.options.join("|")} className="flex items-center gap-3 py-2.5">
                  <Icon
                    aria-hidden
                    className={
                      r.state === "OK"
                        ? "size-4 shrink-0 text-success"
                        : "size-4 shrink-0 text-muted-foreground"
                    }
                  />
                  <span className="text-dense min-w-0 flex-1">{label(r)}</span>
                  <Badge variant={badge} className="text-micro h-5 shrink-0">
                    {stateLabel(r.state)}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
