"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import * as z from "zod/mini";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { FormField } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { Link } from "@/i18n/navigation";
import { isServiceError } from "@/lib/service-error";
import { requestPasswordReset } from "@/services/auth";
import { AuthHeading } from "./auth-heading";

/**
 * Forgot password (§3 "password reset and recovery"). The answer is the same
 * whether or not the account exists. Demo: no e-mail goes out, so the
 * "sent" screen offers the link itself.
 */
export function ForgotPasswordForm() {
  const t = useTranslations();
  const [sent, setSent] = useState<{ email: string; token?: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .check(
            z.trim(),
            z.minLength(1, t("auth.login.errors.required")),
            z.email(t("auth.login.errors.email")),
          ),
      }),
    [t],
  );
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const mutation = useServiceMutation({
    mutationFn: (v: Values) => requestPasswordReset(v.email),
    invalidate: [],
    onSuccess: (result, v) => setSent({ email: v.email, token: result.demoResetToken }),
    onError: (error) =>
      setProblem(t(`feedback.errors.${isServiceError(error) ? error.code : "UNKNOWN"}`)),
  });

  if (sent) {
    return (
      <>
        <span
          className="mb-4 grid size-12 place-items-center rounded-full bg-accent text-accent-foreground"
          aria-hidden
        >
          <MailCheck className="size-6" />
        </span>
        <AuthHeading
          title={t("auth.forgot.sentTitle")}
          subtitle={t("auth.forgot.sentBody", { email: sent.email })}
        />
        <InlineAlert tone="info">
          {sent.token ? (
            <span className="flex flex-col items-start gap-2">
              {t("auth.forgot.demoLink")}
              <Button asChild size="sm">
                <Link href={{ pathname: "/reset-password", query: { token: sent.token } }}>
                  {t("auth.forgot.openLink")}
                </Link>
              </Button>
            </span>
          ) : (
            t("auth.forgot.demoNoAccount")
          )}
        </InlineAlert>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" className="-ml-2.5" asChild>
            <Link href="/login">
              <ArrowLeft aria-hidden />
              {t("auth.forgot.back")}
            </Link>
          </Button>
          <Button variant="link" onClick={() => setSent(null)}>
            {t("auth.forgot.tryAnother")}
          </Button>
        </div>
      </>
    );
  }

  const pending = mutation.isPending;
  return (
    <>
      <AuthHeading title={t("auth.forgot.title")} subtitle={t("auth.forgot.subtitle")} />
      <form
        onSubmit={handleSubmit((v) => {
          setProblem(null);
          mutation.mutate(v);
        })}
        className="flex flex-col gap-4"
        noValidate
      >
        {problem && <InlineAlert tone="danger">{problem}</InlineAlert>}
        <FormField label={t("auth.login.email")} error={formState.errors.email?.message}>
          {(p) => (
            <Input
              {...p}
              {...register("email")}
              type="email"
              autoComplete="username"
              inputMode="email"
              autoFocus
              disabled={pending}
              className="h-10"
            />
          )}
        </FormField>
        <Button type="submit" size="lg" className="h-10" disabled={pending}>
          {pending ? t("auth.forgot.sending") : t("auth.forgot.submit")}
        </Button>
        <Button variant="ghost" className="self-start -ml-2.5" asChild>
          <Link href="/login">
            <ArrowLeft aria-hidden />
            {t("auth.forgot.back")}
          </Link>
        </Button>
      </form>
    </>
  );
}
