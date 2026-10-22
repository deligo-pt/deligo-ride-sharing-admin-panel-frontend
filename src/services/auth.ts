import type { AdminUser } from "@/types/admin";
import type {
  DemoAccount,
  OtpChallenge,
  PasswordResetRequest,
  ResetTokenInfo,
  SessionData,
  SignInInput,
  SignInResult,
} from "@/types/auth";
import { maskEmail } from "@/lib/format";
import { meetsPasswordRules } from "@/lib/password";
import { ServiceError } from "@/lib/service-error";
import { normalize } from "@/mock/query";
import { ANONYMOUS, actor, audit, nowIso, publicBackend, type Backend } from "./_shared";

/**
 * Admin authentication — requirements §3. Demo rules (ride_plan.md P6): any
 * password is accepted for an existing active account; accounts with
 * two-factor get a 6-digit code, always 123456. Every sign-in event is
 * audited (`auth.*`). The real API keeps all of this server-side and answers
 * failed sign-ins with one generic error, as here.
 */

export const DEMO_OTP = "123456";
const OTP_TTL_MS = 5 * 60_000;
const OTP_RESEND_MS = 30_000;
const OTP_MAX_ATTEMPTS = 5;
const RESET_TTL_MS = 30 * 60_000;

type Challenge = {
  id: string;
  adminId: string;
  expiresAt: number;
  resendAt: number;
  attempts: number;
};

// "Server memory": OTP challenges last until the page reloads.
const challenges = new Map<string, Challenge>();

// Used reset links stand in for the server's token table. They are kept in
// localStorage so a used link stays used after a reload or in another tab.
const USED_LINKS_KEY = "deligo-ride-admin:used-reset-links";
const usedInPage = new Set<string>();

function usedResetTokens(): string[] {
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(USED_LINKS_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function markResetTokenUsed(token: string) {
  try {
    window.localStorage.setItem(
      USED_LINKS_KEY,
      JSON.stringify([...usedResetTokens().slice(-49), token]),
    );
  } catch {
    // Blocked storage: the link is refused for the rest of this page only.
  }
  usedInPage.add(token);
}

const randomId = () => Math.random().toString(36).slice(2, 12);

function findByEmail({ db }: Backend, email: string): AdminUser | undefined {
  const wanted = normalize(email.trim());
  return db.admins.all().find((a) => normalize(a.email) === wanted);
}

function startSession(b: Backend, admin: AdminUser): SessionData {
  const signedInAt = nowIso();
  b.db.admins.update(admin.id, { lastLoginAt: signedInAt });
  audit(b, {
    action: "auth.login",
    resourceType: "auth",
    resourceId: "session",
    after: { mfa: admin.mfaEnabled },
    by: { id: admin.id, name: admin.name },
  });
  return {
    adminId: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.roleId,
    mfa: admin.mfaEnabled,
    signedInAt,
  };
}

function challengeView(c: Challenge, admin: AdminUser): OtpChallenge {
  return {
    id: c.id,
    sentTo: maskEmail(admin.email),
    expiresAt: new Date(c.expiresAt).toISOString(),
    resendAt: new Date(c.resendAt).toISOString(),
  };
}

/**
 * Step 1: e-mail + password. Unknown e-mail and wrong password give the same
 * VALIDATION error (field `credentials`) so the form never reveals which
 * accounts exist. Disabled and not-yet-accepted accounts get FORBIDDEN with
 * field `disabled` / `invited`.
 * // API: POST /admin/auth/login (❌ — backend has mock headers only)
 */
export async function signIn(input: SignInInput): Promise<SignInResult> {
  const b = await publicBackend();
  const email = input.email.trim();
  if (!email) throw new ServiceError("VALIDATION", "E-mail is required", "email");
  if (!input.password) throw new ServiceError("VALIDATION", "Password is required", "password");

  const admin = findByEmail(b, email);
  if (!admin) {
    audit(b, {
      action: "auth.login_failed",
      resourceType: "auth",
      resourceId: "session",
      after: { email: maskEmail(email), cause: "unknown_account" },
      by: ANONYMOUS,
    });
    throw new ServiceError("VALIDATION", "E-mail or password is incorrect", "credentials");
  }
  const by = { id: admin.id, name: admin.name };
  if (admin.status !== "ACTIVE") {
    audit(b, {
      action: "auth.login_failed",
      resourceType: "auth",
      resourceId: "session",
      after: { cause: admin.status.toLowerCase() },
      by,
    });
    throw new ServiceError(
      "FORBIDDEN",
      `Account is ${admin.status}`,
      admin.status === "INVITED" ? "invited" : "disabled",
    );
  }

  if (!admin.mfaEnabled) return { status: "SIGNED_IN", session: startSession(b, admin) };

  const now = Date.now();
  const challenge: Challenge = {
    id: `otp_${randomId()}`,
    adminId: admin.id,
    expiresAt: now + OTP_TTL_MS,
    resendAt: now + OTP_RESEND_MS,
    attempts: 0,
  };
  challenges.set(challenge.id, challenge);
  return { status: "OTP_REQUIRED", challenge: challengeView(challenge, admin) };
}

function liveChallenge(b: Backend, id: string): { challenge: Challenge; admin: AdminUser } {
  const challenge = challenges.get(id);
  if (!challenge || challenge.expiresAt < Date.now()) {
    challenges.delete(id);
    throw new ServiceError("CONFLICT", "The code expired — sign in again", "expired");
  }
  return { challenge, admin: b.db.admins.require(challenge.adminId) };
}

/**
 * Step 2: the 6-digit code. A wrong code is VALIDATION on `code` with
 * `details.attemptsLeft`; after 5 wrong codes the challenge is dropped
 * (CONFLICT `tooManyAttempts`) and the admin starts again.
 * // API: POST /admin/auth/otp/verify (❌)
 */
export async function verifyOtp(challengeId: string, code: string): Promise<SessionData> {
  const b = await publicBackend();
  const { challenge, admin } = liveChallenge(b, challengeId);
  const by = { id: admin.id, name: admin.name };

  if (code.trim() !== DEMO_OTP) {
    challenge.attempts += 1;
    const attemptsLeft = OTP_MAX_ATTEMPTS - challenge.attempts;
    if (attemptsLeft <= 0) {
      challenges.delete(challengeId);
      audit(b, {
        action: "auth.otp_locked",
        resourceType: "auth",
        resourceId: "session",
        after: { attempts: challenge.attempts },
        by,
      });
      throw new ServiceError("CONFLICT", "Too many wrong codes", "tooManyAttempts");
    }
    audit(b, {
      action: "auth.otp_failed",
      resourceType: "auth",
      resourceId: "session",
      after: { attemptsLeft },
      by,
    });
    throw new ServiceError("VALIDATION", "The code is not correct", "code", { attemptsLeft });
  }

  challenges.delete(challengeId);
  return startSession(b, admin);
}

/** A new code (same demo value); allowed 30 s after the last one. // API: POST /admin/auth/otp/resend (❌) */
export async function resendOtp(challengeId: string): Promise<OtpChallenge> {
  const b = await publicBackend();
  const { challenge, admin } = liveChallenge(b, challengeId);
  const now = Date.now();
  if (now < challenge.resendAt) {
    throw new ServiceError("CONFLICT", "Wait before asking for another code", "tooSoon", {
      seconds: Math.ceil((challenge.resendAt - now) / 1000),
    });
  }
  challenge.expiresAt = now + OTP_TTL_MS;
  challenge.resendAt = now + OTP_RESEND_MS;
  return challengeView(challenge, admin);
}

/**
 * Ends the session on the "server" and audits it. Like a real request, it
 * captures who is signed out when it is sent, so the caller can drop the
 * cookie right after calling it (without waiting for the answer).
 * // API: POST /admin/auth/logout (❌)
 */
export function signOut(cause: "user" | "idle"): Promise<void> {
  const by = actor();
  return publicBackend().then((b) => {
    if (by.id === ANONYMOUS.id) return;
    audit(b, {
      action: cause === "idle" ? "auth.session_expired" : "auth.logout",
      resourceType: "auth",
      resourceId: "session",
      by,
    });
  });
}

// Reset links: base64url { a: adminId, e: expiry ms, n: nonce } — readable after a reload.
function encodeToken(adminId: string, expiresAt: number) {
  return btoa(JSON.stringify({ a: adminId, e: expiresAt, n: randomId() }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function readToken(b: Backend, token: string): { admin: AdminUser; expiresAt: number } {
  let parsed: { a?: unknown; e?: unknown } = {};
  try {
    parsed = JSON.parse(atob(token.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    // Falls through to "invalid".
  }
  const admin = typeof parsed.a === "string" ? b.db.admins.get(parsed.a) : undefined;
  if (!admin || typeof parsed.e !== "number" || admin.status === "DISABLED") {
    throw new ServiceError("NOT_FOUND", "This reset link is not valid", "invalid");
  }
  if (parsed.e < Date.now() || usedInPage.has(token) || usedResetTokens().includes(token)) {
    throw new ServiceError("CONFLICT", "This reset link expired or was already used", "expired");
  }
  return { admin, expiresAt: parsed.e };
}

/**
 * Always "succeeds" so the form never reveals whether an account exists.
 * // API: POST /admin/auth/password/forgot (❌)
 */
export async function requestPasswordReset(email: string): Promise<PasswordResetRequest> {
  const b = await publicBackend();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    throw new ServiceError("VALIDATION", "E-mail is not valid", "email");
  const admin = findByEmail(b, email);
  if (!admin || admin.status === "DISABLED") return {};
  audit(b, {
    action: "auth.password_reset_requested",
    resourceType: "auth",
    resourceId: admin.id,
    by: { id: admin.id, name: admin.name },
  });
  return { demoResetToken: encodeToken(admin.id, Date.now() + RESET_TTL_MS) };
}

/** Checks a reset link before showing the form. // API: GET /admin/auth/password/reset/:token (❌) */
export async function checkResetToken(token: string): Promise<ResetTokenInfo> {
  const b = await publicBackend();
  const { admin, expiresAt } = readToken(b, token);
  return { sentTo: maskEmail(admin.email), expiresAt: new Date(expiresAt).toISOString() };
}

/**
 * Sets the new password; the link is single-use. An INVITED admin becomes
 * ACTIVE here (choosing a password accepts the invitation).
 * // API: POST /admin/auth/password/reset (❌)
 */
export async function resetPassword(token: string, password: string): Promise<void> {
  const b = await publicBackend();
  const { admin } = readToken(b, token);
  if (!meetsPasswordRules(password)) {
    throw new ServiceError("VALIDATION", "The password does not meet the rules", "password");
  }
  markResetTokenUsed(token);
  if (admin.status === "INVITED") b.db.admins.update(admin.id, { status: "ACTIVE" });
  audit(b, {
    action: "auth.password_reset",
    resourceType: "auth",
    resourceId: admin.id,
    by: { id: admin.id, name: admin.name },
  });
}

const DEMO_ACCOUNT_IDS = [
  "ADM-001",
  "ADM-003",
  "ADM-005",
  "ADM-009",
  "ADM-011",
  "ADM-013",
  "ADM-014",
  "ADM-008",
  "ADM-015",
];

/**
 * Demo only (not part of the future API): one account per role, then a
 * disabled and an invited account to show the error messages.
 */
export async function listDemoAccounts(): Promise<DemoAccount[]> {
  const { db } = await publicBackend();
  return DEMO_ACCOUNT_IDS.map((id) => db.admins.require(id)).map((a) => ({
    adminId: a.id,
    name: a.name,
    email: a.email,
    roleId: a.roleId,
    status: a.status,
    mfaEnabled: a.mfaEnabled,
  }));
}
