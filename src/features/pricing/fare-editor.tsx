"use client";

import { useState } from "react";
import { Check, Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { toast } from "sonner";
import type { PricingRule, PricingRuleInput } from "@/types/pricing";
import type { RideCategory } from "@/types/vehicle";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { DetailSkeleton, ErrorState } from "@/components/feedback/states";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActivePricing, usePricingRule } from "@/hooks/queries/pricing";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { Link, useRouter } from "@/i18n/navigation";
import { qk } from "@/lib/query-keys";
import { isServiceError } from "@/lib/service-error";
import { cn } from "@/lib/utils";
import { createPricingDraft, updatePricingDraft } from "@/services/pricing";
import { FareForm } from "./fare-form";
import { FarePreviewStep } from "./fare-preview";
import { FarePublishStep } from "./fare-publish";
import { CATEGORIES, toInput } from "./pricing-utils";

const STEPS = ["values", "preview", "publish"] as const;

function Steps({ step }: { step: number }) {
  const t = useTranslations("pricing.editor.steps");
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-label={t("label")}>
      {STEPS.map((key, i) => (
        <li
          key={key}
          aria-current={i === step ? "step" : undefined}
          className={cn("text-dense flex items-center gap-2", i === step ? "font-semibold" : "text-muted-foreground")}
        >
          <span
            className={cn(
              "grid size-6 place-items-center rounded-full border text-xs",
              i < step && "border-success bg-success text-white",
              i === step && "border-primary bg-primary text-primary-foreground",
            )}
          >
            {i < step ? <Check aria-hidden className="size-3.5" /> : i + 1}
          </span>
          {t(key)}
        </li>
      ))}
    </ol>
  );
}

/** The three steps for one category, starting from `initial` (the fare in force, or a draft being continued). */
function Steps3({
  initial,
  current,
  draftId,
  withCategoryPicker,
  onCategory,
}: {
  initial: PricingRuleInput;
  current?: PricingRule;
  draftId?: string;
  withCategoryPicker: boolean;
  onCategory: (category: RideCategory) => void;
}) {
  const t = useTranslations("pricing.editor");
  const tc = useTranslations("enums.rideCategory");
  const tError = useTranslations("feedback.errors");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<PricingRuleInput>(initial);

  const draft = useServiceMutation({
    mutationFn: (input: PricingRuleInput) => (draftId ? updatePricingDraft(draftId, input) : createPricingDraft(input)),
    invalidate: [qk.pricing.all, qk.audit.all],
    onSuccess: (rule) => {
      toast.success(t("draftSaved", { category: tc(rule.category), n: rule.version }));
      router.push("/pricing?tab=history");
    },
    onError: (error) => toast.error(tError(isServiceError(error) ? error.code : "UNKNOWN")),
  });

  return (
    <div className="flex flex-col gap-4">
      <Steps step={step} />
      {step === 0 && (
        <>
          {withCategoryPicker && (
            <FormField label={t("category")} className="max-w-xs">
              {(p) => (
                <Select value={initial.category} onValueChange={(v) => onCategory(v as RideCategory)}>
                  <SelectTrigger {...p} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {tc(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}
          <FareForm
            initial={values}
            saving={draft.isPending}
            onSubmit={(v) => {
              setValues(v);
              setStep(1);
            }}
            onSaveDraft={(v) => draft.mutate(v)}
            cancel={
              <Button asChild variant="ghost">
                <Link href="/pricing">{t("cancel")}</Link>
              </Button>
            }
          />
        </>
      )}
      {step === 1 && (
        <FarePreviewStep values={values} current={current} onBack={() => setStep(0)} onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <FarePublishStep values={values} current={current} draftId={draftId} onBack={() => setStep(1)} />
      )}
    </div>
  );
}

function Header({ category, continuing }: { category: RideCategory; continuing: boolean }) {
  const t = useTranslations("pricing.editor");
  const tc = useTranslations("enums.rideCategory");
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-page-title">{t(continuing ? "titleDraft" : "title", { category: tc(category) })}</h1>
      <p className="text-dense text-muted-foreground">{t("subtitle")}</p>
    </div>
  );
}

/** Starting from the fare in force: a new version is a copy to change. */
function FromActive({ category, setCategory }: { category: RideCategory; setCategory: (c: RideCategory) => void }) {
  const t = useTranslations("pricing.editor");
  const active = useActivePricing();
  if (active.isPending) return <DetailSkeleton />;
  if (active.isError) return <ErrorState error={active.error} onRetry={() => active.refetch()} />;
  const current = active.data.find((r) => r.category === category && !r.zoneId);
  if (!current) return <InlineAlert tone="warning">{t("noActive")}</InlineAlert>;
  return (
    <>
      <Header category={category} continuing={false} />
      <Steps3
        key={category}
        initial={toInput(current)}
        current={current}
        withCategoryPicker
        onCategory={setCategory}
      />
    </>
  );
}

/** Continuing a saved draft. */
function FromDraft({ id }: { id: string }) {
  const t = useTranslations("pricing.editor");
  const draft = usePricingRule(id);
  const active = useActivePricing();
  if (draft.isPending || active.isPending) return <DetailSkeleton />;
  if (draft.isError) return <ErrorState error={draft.error} onRetry={() => draft.refetch()} />;
  if (active.isError) return <ErrorState error={active.error} onRetry={() => active.refetch()} />;
  if (draft.data.status !== "DRAFT")
    return (
      <InlineAlert tone="warning">
        <span className="flex items-center gap-2">
          <Info aria-hidden className="size-4 shrink-0" />
          {t("notADraft")}
        </span>
      </InlineAlert>
    );
  const current = active.data.find((r) => r.category === draft.data.category && !r.zoneId);
  return (
    <>
      <Header category={draft.data.category} continuing />
      <Steps3
        initial={toInput(draft.data)}
        current={current}
        draftId={draft.data.id}
        withCategoryPicker={false}
        onCategory={() => undefined}
      />
    </>
  );
}

/**
 * New fare version (§11): ① values → ② preview against the fare in force →
 * ③ effective date and ⚠ publish. Needs `pricing.modify_pricing`. Opened as
 * `/pricing/new?category=ECONOMY`, or `&draft=PRC-…` to continue a saved draft.
 */
export function FareEditor() {
  const [params, setParams] = useQueryStates(
    {
      category: parseAsStringLiteral(CATEGORIES).withDefault("ECONOMY"),
      draft: parseAsString,
    },
    { history: "replace", clearOnDefault: false, scroll: false },
  );
  return (
    <div className="flex max-w-5xl flex-col gap-4">
      {params.draft ? (
        <FromDraft id={params.draft} />
      ) : (
        <FromActive category={params.category} setCategory={(category) => setParams({ category })} />
      )}
    </div>
  );
}
