"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DemoAccount } from "@/types/auth";
import { StatusBadge } from "@/components/badges/status-badge";
import { ErrorState } from "@/components/feedback/states";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useDemoAccounts } from "@/hooks/queries/auth";
import { useMounted } from "@/lib/use-mounted";
import { initials } from "@/lib/utils";
import { DEMO_OTP } from "@/services/auth";
import { useDemoSettings } from "@/stores/demo-settings";

/**
 * Prototype only: one account per role (plus a disabled and an invited one)
 * so the manager can sign in as anyone. Picking one fills the form.
 */
export function DemoAccounts({ onPick }: { onPick: (email: string) => void }) {
  const t = useTranslations();
  const accounts = useDemoAccounts();
  const mounted = useMounted();
  const { shortSessions, setShortSessions } = useDemoSettings();
  const active = accounts.data?.filter((a) => a.status === "ACTIVE") ?? [];
  const errorCases = accounts.data?.filter((a) => a.status !== "ACTIVE") ?? [];

  return (
    <Card className="mt-8 gap-4 py-4">
      <CardHeader className="px-4">
        <CardTitle className="text-dense font-semibold">{t("auth.demo.title")}</CardTitle>
        <CardDescription className="text-caption">
          {t("auth.demo.hint", { code: DEMO_OTP })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-2">
        {accounts.isPending && (
          <div className="flex flex-col gap-2 px-2" aria-busy>
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        )}
        {accounts.isError && (
          <ErrorState
            error={accounts.error}
            onRetry={() => void accounts.refetch()}
            className="py-6"
          />
        )}
        <ul className="flex flex-col">
          {active.map((account) => (
            <AccountRow key={account.adminId} account={account} onPick={onPick} />
          ))}
        </ul>
        {errorCases.length > 0 && (
          <>
            <p className="text-micro mt-2 px-2 pb-1 text-muted-foreground">
              {t("auth.demo.errorCases")}
            </p>
            <ul className="flex flex-col">
              {errorCases.map((account) => (
                <AccountRow key={account.adminId} account={account} onPick={onPick} />
              ))}
            </ul>
          </>
        )}
        <Separator className="my-2" />
        <label className="flex items-start gap-3 px-2 py-1">
          <Switch
            checked={mounted && shortSessions}
            onCheckedChange={setShortSessions}
            className="mt-0.5"
            aria-describedby="short-sessions-hint"
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-dense font-medium">{t("auth.demo.shortSessions")}</span>
            <span id="short-sessions-hint" className="text-caption">
              {t("auth.demo.shortSessionsHint")}
            </span>
          </span>
        </label>
      </CardContent>
    </Card>
  );
}

function AccountRow({
  account,
  onPick,
}: {
  account: DemoAccount;
  onPick: (email: string) => void;
}) {
  const t = useTranslations();
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(account.email)}
        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
            {initials(account.name)}
          </AvatarFallback>
        </Avatar>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-dense truncate font-medium">
            {account.name}{" "}
            <span className="font-normal text-muted-foreground">
              · {t(`roles.${account.roleId}`)}
            </span>
          </span>
          <span className="text-caption truncate">{account.email}</span>
        </span>
        {account.status !== "ACTIVE" ? (
          <StatusBadge kind="admin" value={account.status} />
        ) : (
          account.mfaEnabled && (
            <Badge variant="neutral" className="text-micro h-5 shrink-0">
              <ShieldCheck aria-hidden />
              {t("auth.demo.mfa")}
            </Badge>
          )
        )}
      </button>
    </li>
  );
}
