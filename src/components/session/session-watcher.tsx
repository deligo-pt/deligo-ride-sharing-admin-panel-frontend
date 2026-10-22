"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, LogIn, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { clearSessionCookie, readSessionCookie } from "@/lib/session";
import { signOut as signOutService } from "@/services/auth";
import { useDemoSettings } from "@/stores/demo-settings";
import { setSessionStatus, useSessionStatus } from "@/stores/session-status";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useSession } from "./session-provider";

/** Shared by every tab, so activity in one keeps the others signed in. */
const LAST_ACTIVE_KEY = "deligo-ride-admin:last-active";
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;

const TIMING = {
  normal: { idleMs: 30 * 60_000, warnMs: 60_000 },
  /** Demo setting: see the whole flow in a minute. */
  short: { idleMs: 60_000, warnMs: 20_000 },
};

function readLastActive() {
  try {
    return Number(window.localStorage.getItem(LAST_ACTIVE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeLastActive(at: number) {
  try {
    window.localStorage.setItem(LAST_ACTIVE_KEY, String(at));
  } catch {
    // Blocked storage: this tab still tracks its own activity.
  }
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * Idle timeout (requirements §3 "automatic handling of expired sessions"):
 * after 30 minutes without activity in any tab — a warning with a countdown
 * first — the session ends and a dialog sends the admin to the login page,
 * back to the same page afterwards. The same dialog opens when a call comes
 * back UNAUTHORIZED or the session ended in another tab.
 */
export function SessionWatcher() {
  const t = useTranslations("auth.session");
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useSession();
  const { status, cause } = useSessionStatus();
  const { idleMs, warnMs } = TIMING[useDemoSettings((s) => s.shortSessions) ? "short" : "normal"];
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActive = useRef(0);
  const warning = useRef(false);

  useEffect(() => {
    if (status !== "active") return;
    const start = Date.now();
    lastActive.current = start;
    writeLastActive(start);
    let lastWrite = start;

    const onActivity = () => {
      // While the warning is up, only "Stay signed in" counts.
      if (warning.current) return;
      const now = Date.now();
      lastActive.current = now;
      if (now - lastWrite > 5_000) {
        lastWrite = now;
        writeLastActive(now);
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVE_KEY)
        lastActive.current = Math.max(lastActive.current, readLastActive());
    };

    const timer = window.setInterval(() => {
      if (!readSessionCookie()) {
        setSessionStatus("expired", "ended");
        return;
      }
      const left = idleMs - (Date.now() - Math.max(lastActive.current, readLastActive()));
      if (left <= 0) {
        setSessionStatus("expired", "idle");
        // The audit call captures who first; the cookie goes at once, so
        // "Sign in again" can never race a still-valid cookie in the proxy.
        void signOutService("idle").catch(() => undefined);
        clearSessionCookie();
      } else if (left <= warnMs) {
        warning.current = true;
        setSecondsLeft(Math.ceil(left / 1000));
      } else if (warning.current) {
        // Another tab chose "Stay signed in".
        warning.current = false;
        setSecondsLeft(null);
      }
    }, 1_000);

    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, onActivity, { passive: true }));
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(timer);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity));
      window.removeEventListener("storage", onStorage);
      warning.current = false;
      setSecondsLeft(null);
    };
  }, [status, idleMs, warnMs]);

  const staySignedIn = () => {
    const now = Date.now();
    lastActive.current = now;
    writeLastActive(now);
    warning.current = false;
    setSecondsLeft(null);
  };

  const signInAgain = () => {
    const next = `${pathname}${window.location.search}`;
    router.replace(`/login?reason=expired&next=${encodeURIComponent(next)}`);
  };

  return (
    <>
      <AlertDialog
        open={status === "active" && secondsLeft !== null}
        onOpenChange={(open) => !open && staySignedIn()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <span
              className="grid size-11 place-items-center rounded-full bg-warning-soft text-warning"
              aria-hidden
            >
              <Clock className="size-5" />
            </span>
            <AlertDialogTitle>{t("warningTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("warningBody", { time: clock(secondsLeft ?? 0) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={signOut}>
              <LogOut aria-hidden />
              {t("signOutNow")}
            </Button>
            <Button onClick={staySignedIn} autoFocus>
              {t("stay")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Can't be dismissed: the only way on is to sign in again. */}
      <AlertDialog open={status === "expired"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <span
              className="grid size-11 place-items-center rounded-full bg-accent text-accent-foreground"
              aria-hidden
            >
              <LogIn className="size-5" />
            </span>
            <AlertDialogTitle>{t("expiredTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {cause === "idle"
                ? t("expiredIdle", { minutes: Math.round(idleMs / 60_000) })
                : t("expiredEnded")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={signInAgain} autoFocus>
              {t("signInAgain")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
