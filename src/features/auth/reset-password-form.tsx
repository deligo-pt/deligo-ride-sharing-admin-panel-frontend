"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Circle, LinkIcon } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import * as z from "zod/mini";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { FormField } from "@/components/forms/form-field";
import { PasswordInput } from "@/components/forms/password-input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useResetToken } from "@/hooks/queries/auth";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { Link, useRouter } from "@/i18n/navigation";
import {
  PASSWORD_MIN_LENGTH,
  meetsPasswordRules,
  passwordRules,
  type PasswordRule,
} from "@/lib/password";
import { isServiceError } from "@/lib/service-error";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { resetPassword } from "@/services/auth";
import { AuthHeading } from "./auth-heading";

const RULES: PasswordRule[] = ["length", "cases", "number", "symbol"];

/** The page an e-mailed reset link opens: check the link, then choose a password. */
export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations();
  const format = useFormat();
  const link = useResetToken(token);

  if (token && link.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-4 h-10" />
        <Skeleton className="h-10" />
      </div>
    );
  }

  if (!token || link.isError || !link.data) {
    const expired = isServiceError(link.error) && link.error.field === "expired";
    const network = isServiceError(link.error) && link.error.code === "NETWORK";
    return (
      <>
        <span
          className="mb-4 grid size-12 place-items-center rounded-full bg-danger-soft text-destructive"
          aria-hidden
        >
          <LinkIcon className="size-6" />
        </span>
        <AuthHeading title={t("auth.reset.invalidTitle")} />
        <InlineAlert tone="danger">
          {network
            ? t("feedback.errors.NETWORK")
            : expired
              ? t("auth.reset.expired")
              : t("auth.reset.invalid")}
        </InlineAlert>
        <div className="mt-6 flex flex-wrap gap-2">
          {network ? (
            <Button onClick={() => void link.refetch()}>{t("common.retry")}</Button>
          ) : (
            <Button asChild>
              <Link href="/forgot-password">{t("auth.reset.requestNew")}</Link>
            </Button>
          )}
          <Button variant="ghost" asChild>
            <Link href="/login">{t("auth.forgot.back")}</Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <AuthHeading
        title={t("auth.reset.title")}
        subtitle={t("auth.reset.subtitle", {
          email: link.data.sentTo,
          time: format.dateTime(link.data.expiresAt),
        })}
      />
      <NewPasswordForm token={token} />
    </>
  );
}

function NewPasswordForm({ token }: { token: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z
        .object({
          password: z.string().check(z.refine(meetsPasswordRules, t("auth.reset.weak"))),
          confirm: z.string(),
        })
        .check(
          z.refine((v) => v.password === v.confirm, {
            message: t("auth.reset.mismatch"),
            path: ["confirm"],
          }),
        ),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, control, setError, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm: "" },
  });
  const password = useWatch({ control, name: "password" });
  const rules = passwordRules(password);

  const mutation = useServiceMutation({
    mutationFn: (v: Values) => resetPassword(token, v.password),
    invalidate: [],
    onSuccess: () => {
      toast.success(t("auth.login.notices.reset"));
      router.replace("/login?reset=done");
    },
    onError: (error) => {
      if (isServiceError(error)) {
        if (error.field === "password")
          return setError("password", { message: t("auth.reset.weak") });
        if (error.field === "expired") return setProblem(t("auth.reset.expired"));
      }
      setProblem(t(`feedback.errors.${isServiceError(error) ? error.code : "UNKNOWN"}`));
    },
  });

  const pending = mutation.isPending;
  return (
    <form
      onSubmit={handleSubmit((v) => {
        setProblem(null);
        mutation.mutate(v);
      })}
      className="flex flex-col gap-4"
      noValidate
    >
      {problem && <InlineAlert tone="danger">{problem}</InlineAlert>}
      <FormField label={t("auth.reset.password")} error={formState.errors.password?.message}>
        {(p) => (
          <PasswordInput
            {...p}
            {...register("password")}
            aria-describedby={[p["aria-describedby"], "password-rules"].filter(Boolean).join(" ")}
            autoComplete="new-password"
            autoFocus
            disabled={pending}
            className="h-10"
          />
        )}
      </FormField>
      <div id="password-rules" className="rounded-lg bg-muted/60 px-3 py-2.5">
        <p className="text-caption mb-1.5 font-medium">{t("auth.reset.rulesTitle")}</p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {RULES.map((rule) => (
            <li
              key={rule}
              className={cn(
                "text-caption flex items-center gap-1.5",
                rules[rule] && "text-success",
              )}
            >
              {rules[rule] ? (
                <Check aria-hidden className="size-3.5" />
              ) : (
                <Circle aria-hidden className="size-3" />
              )}
              {t(`auth.reset.rules.${rule}`, { min: PASSWORD_MIN_LENGTH })}
            </li>
          ))}
        </ul>
      </div>
      <FormField label={t("auth.reset.confirm")} error={formState.errors.confirm?.message}>
        {(p) => (
          <PasswordInput
            {...p}
            {...register("confirm")}
            autoComplete="new-password"
            disabled={pending}
            className="h-10"
          />
        )}
      </FormField>
      <Button type="submit" size="lg" className="h-10" disabled={pending}>
        {pending ? t("auth.reset.saving") : t("auth.reset.submit")}
      </Button>
    </form>
  );
}
