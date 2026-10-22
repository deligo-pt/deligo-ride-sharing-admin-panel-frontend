"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { RoleId } from "@/config/roles";
import { useRouter } from "@/i18n/navigation";
import { clearSessionCookie, writeSessionCookie, type Session } from "@/lib/session";
import { signOut as signOutService } from "@/services/auth";
import { setSessionStatus } from "@/stores/session-status";

type SessionValue = {
  session: Session;
  /**
   * Demo "preview as role": rewrites the cookie (so the services, which read
   * it, decide with the new role) and refetches everything — lists come back
   * masked or refused for the new role.
   */
  setRole: (role: RoleId) => void;
  /** Log out: audit, drop the cookie, go to the login page. */
  signOut: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

/**
 * The signed-in admin for every client component under `(admin)`. The layout
 * reads the session cookie on the server and passes it in, so the first
 * render already shows the right name and role (no flash, no mismatch).
 */
export function SessionProvider({
  session: initial,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [session, setSession] = useState(initial);

  // A new sign-in (another admin in this tab) arrives as a new server value.
  const [seen, setSeen] = useState(initial);
  if (seen.adminId !== initial.adminId || seen.signedInAt !== initial.signedInAt) {
    setSeen(initial);
    setSession(initial);
  }

  useEffect(() => setSessionStatus("active"), [initial.signedInAt]);

  const setRole = useCallback(
    (role: RoleId) => {
      const next = { ...session, role };
      writeSessionCookie(next);
      setSession(next);
      void queryClient.invalidateQueries();
    },
    [session, queryClient],
  );

  const signOut = useCallback(() => {
    setSessionStatus("signingOut");
    // Sent before the cookie goes (it knows who signs out); a failed call
    // (simulated outage) never keeps an admin signed in.
    void signOutService("user").catch(() => undefined);
    clearSessionCookie();
    toast.success(t("signedOut"));
    router.replace("/login");
  }, [router, t]);

  const value = useMemo(() => ({ session, setRole, signOut }), [session, setRole, signOut]);
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionValue {
  const value = use(SessionContext);
  if (!value) throw new Error("useSession() must be used inside the (admin) layout");
  return value;
}
