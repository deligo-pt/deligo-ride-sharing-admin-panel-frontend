import { ROLE_IDS, type RoleId } from "@/config/roles";
import type { SessionData } from "@/types/auth";

/**
 * The demo session (P6). One cookie is the single source of truth: the proxy
 * reads it to protect routes, the `(admin)` layout reads it to render the
 * signed-in admin, and services read it in the browser for the audit actor.
 *
 * Prototype only — the real API sets an HttpOnly, signed session cookie (or
 * short-lived token + refresh) itself; nothing here is a security boundary.
 * The value is base64url JSON so names like "Gonçalves" survive any cookie
 * encoding.
 */
export const SESSION_COOKIE = "deligo-session";

/** Absolute lifetime; the 30-minute idle timeout is enforced by SessionWatcher. */
export const SESSION_MAX_AGE_S = 12 * 60 * 60;

/** `role` is the account's role; the P7 "preview as role" switcher changes it for the demo. */
export type Session = SessionData;

/** Pages reachable without a session. Signed-in admins are sent from these to the dashboard. */
export const GUEST_PATHS = ["/login", "/forgot-password"] as const;
/** Reachable with or without a session (an e-mailed link may be opened while signed in). */
export const OPEN_PATHS = ["/reset-password"] as const;

const matches = (path: string, list: readonly string[]) =>
  list.some((p) => path === p || path.startsWith(`${p}/`));
export const isGuestPath = (path: string) => matches(path, GUEST_PATHS);
export const isOpenPath = (path: string) => matches(path, OPEN_PATHS);

function toBase64Url(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function encodeSession(session: Session): string {
  return toBase64Url(JSON.stringify(session));
}

/** A valid session or null — a tampered or outdated cookie counts as signed out. */
export function parseSession(value: string | undefined | null): Session | null {
  if (!value) return null;
  try {
    const raw: unknown = JSON.parse(fromBase64Url(value));
    if (!raw || typeof raw !== "object") return null;
    const s = raw as Record<string, unknown>;
    if (
      typeof s.adminId !== "string" ||
      typeof s.name !== "string" ||
      typeof s.email !== "string" ||
      typeof s.signedInAt !== "string" ||
      typeof s.mfa !== "boolean" ||
      !ROLE_IDS.includes(s.role as RoleId)
    ) {
      return null;
    }
    return {
      adminId: s.adminId,
      name: s.name,
      email: s.email,
      role: s.role as RoleId,
      mfa: s.mfa,
      signedInAt: s.signedInAt,
    };
  } catch {
    return null;
  }
}

/**
 * Where to go after sign-in. Only same-site paths are accepted ("/rides?x=1"),
 * never "//evil.com" or "https://…" — an open redirect is a classic phishing aid.
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\"))
    return null;
  if (isGuestPath(next.split("?")[0] ?? "")) return null;
  return next;
}

// Browser helpers (call from event handlers / effects only).

export function readSessionCookie(): Session | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie.split("; ").find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return parseSession(entry?.slice(SESSION_COOKIE.length + 1));
}

export function writeSessionCookie(session: Session) {
  document.cookie = `${SESSION_COOKIE}=${encodeSession(session)}; path=/; max-age=${SESSION_MAX_AGE_S}; samesite=lax`;
}

export function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
