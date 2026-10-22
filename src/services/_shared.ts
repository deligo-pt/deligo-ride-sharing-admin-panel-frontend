import type { AuditAction, AuditResourceType } from "@/types/audit";
import type { AdminNote } from "@/types/common";
import { ServiceError } from "@/lib/service-error";
import { latency } from "@/mock/latency";
import { getDb } from "@/mock/load";
import type { PermissionAction, PermissionModule } from "@/config/roles";
import { can } from "@/lib/permissions";
import { readSessionCookie } from "@/lib/session";

/**
 * Plumbing every service uses. Services are the only code that touches
 * `src/mock` (ride_plan.md §D.1); when the real API arrives, each service body
 * becomes a `fetch` and this file goes away.
 */

/**
 * Simulated round trip, then the (lazily loaded) database. Like the real API,
 * every call needs a session: without one it fails with UNAUTHORIZED, which
 * the query client turns into the "session expired" dialog (P6).
 */
export async function backend() {
  await latency();
  if (typeof document !== "undefined" && !readSessionCookie()) {
    throw new ServiceError("UNAUTHORIZED", "No session");
  }
  return getDb();
}

/**
 * Permission check on the "server" (requirements §20: the backend validates
 * every operation, hiding buttons is not enough). Call it first in every
 * service function: `authorize("customers", "suspend")`.
 */
export function authorize(module: PermissionModule, action: PermissionAction) {
  const session = readSessionCookie();
  if (session && !can(session.role, module, action)) {
    throw new ServiceError("FORBIDDEN", `${session.role} cannot ${action} ${module}`);
  }
}

/** Whether the signed-in role may `view` a module — for services that trim what they return per role. */
export function canView(module: PermissionModule): boolean {
  const session = readSessionCookie();
  return !session || can(session.role, module, "view");
}

/** Whether personal data of `module` goes out unmasked (the `sensitive` permission). */
export function seesPersonalData(module: PermissionModule): boolean {
  const session = readSessionCookie();
  return !session || can(session.role, module, "sensitive");
}

/** For the sign-in services only (services/auth.ts): no session needed. */
export async function publicBackend() {
  await latency();
  return getDb();
}

export type Backend = Awaited<ReturnType<typeof backend>>;

/** Audit entries for events without a known admin (sign-in with an unknown e-mail). */
export const ANONYMOUS = { id: "ANONYMOUS", name: "—" } as const;

/** The signed-in admin (session cookie) — who mutations and audit entries are attributed to. */
export function actor(): { id: string; name: string } {
  const session = readSessionCookie();
  return session ? { id: session.adminId, name: session.name } : ANONYMOUS;
}

/** Mutations happen "now" in real time (the generated data is anchored to load time). */
export const nowIso = () => new Date().toISOString();

/** §G: sensitive actions need a reason of at least 10 characters. */
export const MIN_REASON_LENGTH = 10;

export function requireReason(reason: string | undefined): string {
  const text = reason?.trim() ?? "";
  if (text.length < MIN_REASON_LENGTH) {
    throw new ServiceError("VALIDATION", `A reason of at least ${MIN_REASON_LENGTH} characters is required`, "reason");
  }
  return text;
}

export function requireText(value: string | undefined, field: string, max = 2000): string {
  const text = value?.trim() ?? "";
  if (!text) throw new ServiceError("VALIDATION", `${field} is required`, field);
  if (text.length > max) throw new ServiceError("VALIDATION", `${field} is longer than ${max} characters`, field);
  return text;
}

/** Throws CONFLICT unless the record is in one of the allowed states. */
export function assertState<S extends string>(current: S, allowed: readonly S[], what: string) {
  if (!allowed.includes(current)) {
    throw new ServiceError("CONFLICT", `Cannot ${what} while status is ${current}`);
  }
}

/** An internal note by the signed-in admin. */
export function makeNote({ seq }: Backend, text: string): AdminNote {
  const who = actor();
  return {
    id: `NOTE-${seq.note.take()}`,
    text: requireText(text, "text"),
    authorId: who.id,
    authorName: who.name,
    createdAt: nowIso(),
  };
}

type AuditInput = {
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  /** Who did it, when that is not the signed-in admin (sign-in events, P6). */
  by?: { id: string; name: string };
};

/**
 * Append-only audit entry (§21) — written by the "backend" with every
 * mutation, like the real API will. Correlation ID mimics a request ID.
 */
export function audit({ db, seq }: Backend, { by, ...entry }: AuditInput) {
  const who = by ?? actor();
  db.audit.insert({
    id: `AUD-${seq.audit.take()}`,
    adminId: who.id,
    adminName: who.name,
    at: nowIso(),
    correlationId: `req_${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16).slice(-8)}`,
    ip: "10.20.0.15",
    ...entry,
  });
}

/** Only the changed keys of a record, for audit before/after. */
export function diff<T extends object>(before: T, after: T): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after) as (keyof T)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      b[key as string] = before[key];
      a[key as string] = after[key];
    }
  }
  return { before: b, after: a };
}

export const clone = <T>(value: T): T => structuredClone(value);
