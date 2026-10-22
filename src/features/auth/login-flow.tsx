"use client";

import { useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { useNow, useTranslations } from "next-intl";
import { toast } from "sonner";
import * as z from "zod/mini";
import type { OtpChallenge, SessionData } from "@/types/auth";
import { InlineAlert } from "@/components/feedback/inline-alert";
import { FormField } from "@/components/forms/form-field";
import { OtpInput } from "@/components/forms/otp-input";
import { PasswordInput } from "@/components/forms/password-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServiceMutation } from "@/hooks/queries/use-service-mutation";
import { Link, useRouter } from "@/i18n/navigation";
import { isServiceError } from "@/lib/service-error";
import { writeSessionCookie } from "@/lib/session";
import { DEMO_OTP, resendOtp, signIn, verifyOtp } from "@/services/auth";
import { AuthHeading } from "./auth-heading";
import { DemoAccounts } from "./demo-accounts";

/** Banner on the first step: from the URL (expired session, password changed) or from the OTP step. */
export type LoginNotice = "expired" | "reset" | "otpExpired" | "otpLocked";

const DEMO_PASSWORD = "demo-password";

/**
 * Login (requirements §3): e-mail + password → (accounts with two-factor) a
 * 6-digit code → session cookie → back to `next` or the dashboard.
 */
export function LoginFlow({
  next,
  notice: initialNotice,
}: {
  next: string | null;
  notice: LoginNotice | null;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [notice, setNotice] = useState(initialNotice);
  const [email, setEmail] = useState("");

  const finish = (session: SessionData) => {
    writeSessionCookie(session);
    // A new admin starts with an empty cache (nothing from the previous session).
    queryClient.clear();
    toast.success(t("welcome", { name: session.name.split(" ")[0] ?? session.name }));
    router.replace(next ?? "/dashboard");
  };

  if (challenge) {
    return (
      <OtpStep
        challenge={challenge}
        onVerified={finish}
        onBack={(reason) => {
          setChallenge(null);
          setNotice(reason);
        }}
      />
    );
  }

  return (
    <CredentialsStep
      defaultEmail={email}
      notice={notice}
      onSignedIn={finish}
      onOtp={(c, typed) => {
        setEmail(typed);
        setNotice(null);
        setChallenge(c);
      }}
    />
  );
}

function CredentialsStep({
  defaultEmail,
  notice,
  onSignedIn,
  onOtp,
}: {
  defaultEmail: string;
  notice: LoginNotice | null;
  onSignedIn: (session: SessionData) => void;
  onOtp: (challenge: OtpChallenge, email: string) => void;
}) {
  const t = useTranslations();
  const submitRef = useRef<HTMLButtonElement>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const schema = useMemo(() => {
    const required = t("auth.login.errors.required");
    return z.object({
      email: z
        .string()
        .check(z.trim(), z.minLength(1, required), z.email(t("auth.login.errors.email"))),
      password: z.string().check(z.minLength(1, required)),
    });
  }, [t]);
  type Values = z.infer<typeof schema>;

  const { register, handleSubmit, setValue, clearErrors, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: defaultEmail, password: "" },
  });

  const mutation = useServiceMutation({
    mutationFn: (v: Values) => signIn(v),
    invalidate: [],
    onSuccess: (result, v) =>
      result.status === "SIGNED_IN" ? onSignedIn(result.session) : onOtp(result.challenge, v.email),
    onError: (error) => {
      const field = isServiceError(error) ? error.field : undefined;
      if (field === "credentials" || field === "invited" || field === "disabled") {
        return setProblem(t(`auth.login.errors.${field}`));
      }
      setProblem(t(`feedback.errors.${isServiceError(error) ? error.code : "UNKNOWN"}`));
    },
  });

  const pick = (email: string) => {
    setValue("email", email);
    setValue("password", DEMO_PASSWORD);
    clearErrors();
    setProblem(null);
    submitRef.current?.focus();
  };

  const pending = mutation.isPending;
  return (
    <>
      <AuthHeading title={t("auth.login.title")} subtitle={t("auth.login.subtitle")} />
      <form
        onSubmit={handleSubmit((v) => {
          setProblem(null);
          mutation.mutate(v);
        })}
        className="flex flex-col gap-4"
        noValidate
      >
        {notice && !problem && (
          <InlineAlert tone={notice === "reset" ? "success" : "info"}>
            {t(`auth.login.notices.${notice}`)}
          </InlineAlert>
        )}
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
        <FormField label={t("auth.login.password")} error={formState.errors.password?.message}>
          {(p) => (
            <PasswordInput
              {...p}
              {...register("password")}
              autoComplete="current-password"
              disabled={pending}
              className="h-10"
            />
          )}
        </FormField>
        <Link
          href="/forgot-password"
          className="text-dense -mt-1 self-end font-medium text-primary hover:underline"
        >
          {t("auth.login.forgot")}
        </Link>
        <Button ref={submitRef} type="submit" size="lg" className="h-10" disabled={pending}>
          {pending ? t("auth.login.submitting") : t("auth.login.submit")}
        </Button>
      </form>
      <DemoAccounts onPick={pick} />
    </>
  );
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

function OtpStep({
  challenge: initial,
  onVerified,
  onBack,
}: {
  challenge: OtpChallenge;
  onVerified: (session: SessionData) => void;
  onBack: (reason: LoginNotice | null) => void;
}) {
  const t = useTranslations();
  const now = useNow({ updateInterval: 1000 });
  const [challenge, setChallenge] = useState(initial);
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  // Expired / locked challenges send the admin back to step 1 with a banner.
  const handleError = (error: unknown) => {
    if (isServiceError(error)) {
      if (error.field === "expired") return onBack("otpExpired");
      if (error.field === "tooManyAttempts") return onBack("otpLocked");
      if (error.field === "code") {
        setCode("");
        return setProblem(t("auth.otp.wrong", { count: Number(error.details?.attemptsLeft ?? 0) }));
      }
    }
    setProblem(t(`feedback.errors.${isServiceError(error) ? error.code : "UNKNOWN"}`));
  };

  const verify = useServiceMutation({
    mutationFn: (value: string) => verifyOtp(challenge.id, value),
    invalidate: [],
    onSuccess: onVerified,
    onError: handleError,
  });
  const resend = useServiceMutation({
    mutationFn: () => resendOtp(challenge.id),
    invalidate: [],
    onSuccess: (next) => {
      setChallenge(next);
      setCode("");
      setProblem(null);
      toast.success(t("auth.otp.resent"));
    },
    onError: handleError,
  });

  const submit = (value: string) => {
    if (value.length < 6) return setProblem(t("auth.otp.incomplete"));
    setProblem(null);
    verify.mutate(value);
  };

  const resendIn = Math.max(0, Math.ceil((Date.parse(challenge.resendAt) - now.getTime()) / 1000));
  const busy = verify.isPending || resend.isPending;

  return (
    <>
      <span
        className="mb-4 grid size-12 place-items-center rounded-full bg-accent text-accent-foreground"
        aria-hidden
      >
        <MailCheck className="size-6" />
      </span>
      <AuthHeading
        title={t("auth.otp.title")}
        subtitle={t("auth.otp.body", { email: challenge.sentTo })}
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(code);
        }}
        className="flex flex-col gap-4"
        noValidate
      >
        {problem && <InlineAlert tone="danger">{problem}</InlineAlert>}
        <FormField label={t("auth.otp.label")} hint={t("auth.otp.demoCode", { code: DEMO_OTP })}>
          {(p) => (
            <OtpInput
              {...p}
              aria-invalid={problem ? true : p["aria-invalid"]}
              value={code}
              autoFocus
              disabled={verify.isPending}
              onChange={(value) => {
                setCode(value);
                setProblem(null);
                // Typing or pasting the last digit submits.
                if (value.length === 6 && !busy) submit(value);
              }}
            />
          )}
        </FormField>
        <Button type="submit" size="lg" className="h-10" disabled={busy}>
          {verify.isPending ? t("auth.otp.verifying") : t("auth.otp.submit")}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            className="-ml-2.5"
            onClick={() => onBack(null)}
            disabled={verify.isPending}
          >
            <ArrowLeft aria-hidden />
            {t("auth.otp.back")}
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={() => resend.mutate(undefined)}
            disabled={busy || resendIn > 0}
          >
            {resendIn > 0
              ? t("auth.otp.resendIn", { time: clock(resendIn) })
              : t("auth.otp.resend")}
          </Button>
        </div>
      </form>
    </>
  );
}
