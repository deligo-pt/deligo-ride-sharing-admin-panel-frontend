import type { AdminInput, AdminListParams, AdminStatus, AdminUser, Role } from "@/types/admin";
import type { Page } from "@/types/common";
import { ROLE_IDS, ROLE_PERMISSIONS, type RoleId } from "@/config/roles";
import { ServiceError } from "@/lib/service-error";
import { inSet, matchesQuery, normalize, paginate, sortRows } from "@/mock/query";
import { actor, audit, authorize, backend, clone, nowIso, requireReason, type Backend } from "./_shared";

/** Admin users & roles — requirements §20. Changes need `admins.manage_admins`; only a Super Admin grants Super Admin. */

/**
 * Sort fields: name, lastLoginAt, invitedAt.
 * // API: GET /admin/admins (❌)
 */
export async function listAdmins(params: AdminListParams): Promise<Page<AdminUser>> {
  const { db } = await backend();
  authorize("admins", "view");
  const rows = db.admins
    .all()
    .filter((a) => inSet(a.roleId, params.roleId) && inSet(a.status, params.status) && matchesQuery(params.q, a.name, a.email, a.id));
  const sorted = sortRows(rows, params.sort, { name: (a) => a.name, lastLoginAt: (a) => a.lastLoginAt, invitedAt: (a) => a.invitedAt }, "name:asc");
  return paginate(sorted, params.page, params.pageSize);
}

/** // API: GET /admin/admins/:id (❌) */
export async function getAdmin(id: string): Promise<AdminUser> {
  const { db } = await backend();
  authorize("admins", "view");
  return clone(db.admins.require(id));
}

function assertCanGrant({ db }: Backend, roleId: RoleId) {
  const me = db.admins.get(actor().id);
  if (roleId === "SUPER_ADMIN" && me?.roleId !== "SUPER_ADMIN") {
    throw new ServiceError("FORBIDDEN", "Only a Super Admin can grant Super Admin");
  }
}

/** Sends an invite e-mail (simulated); the account is INVITED until first login. // API: POST /admin/admins (❌) */
export async function inviteAdmin(input: AdminInput): Promise<AdminUser> {
  const b = await backend();
  authorize("admins", "manage_admins");
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 3) throw new ServiceError("VALIDATION", "Name is required", "name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ServiceError("VALIDATION", "E-mail is not valid", "email");
  if (b.db.admins.all().some((a) => normalize(a.email) === normalize(email))) throw new ServiceError("CONFLICT", "An admin with this e-mail exists", "email");
  assertCanGrant(b, input.roleId);
  const admin = b.db.admins.insert({
    id: `ADM-${String(b.seq.admin.take() + 1).padStart(3, "0")}`,
    name,
    email,
    roleId: input.roleId,
    status: "INVITED",
    invitedAt: nowIso(),
    mfaEnabled: false,
  });
  audit(b, { action: "admin.invite", resourceType: "admin", resourceId: admin.id, after: { email, roleId: input.roleId } });
  return clone(admin);
}

/** // API: PATCH /admin/admins/:id/role (❌) */
export async function changeAdminRole(id: string, roleId: RoleId, reason: string): Promise<AdminUser> {
  const b = await backend();
  authorize("admins", "manage_admins");
  const text = requireReason(reason);
  const current = b.db.admins.require(id);
  if (id === actor().id) throw new ServiceError("FORBIDDEN", "You cannot change your own role");
  if (current.roleId === roleId) throw new ServiceError("CONFLICT", "Admin already has this role");
  assertCanGrant(b, roleId);
  const next = b.db.admins.update(id, { roleId });
  audit(b, { action: "admin.role_change", resourceType: "admin", resourceId: id, before: { roleId: current.roleId }, after: { roleId }, reason: text });
  return clone(next);
}

/** Disable or re-enable an account. // API: PATCH /admin/admins/:id/status (❌) */
export async function setAdminStatus(id: string, status: Extract<AdminStatus, "ACTIVE" | "DISABLED">, reason: string): Promise<AdminUser> {
  const b = await backend();
  authorize("admins", "manage_admins");
  const text = requireReason(reason);
  const current = b.db.admins.require(id);
  if (id === actor().id) throw new ServiceError("FORBIDDEN", "You cannot disable your own account");
  if (current.status === status) throw new ServiceError("CONFLICT", `Admin is already ${status}`);
  const next = b.db.admins.update(id, { status });
  audit(b, { action: status === "DISABLED" ? "admin.disable" : "admin.enable", resourceType: "admin", resourceId: id, before: { status: current.status }, after: { status }, reason: text });
  return clone(next);
}

/** The admin sets up two-factor again at next login. // API: POST /admin/admins/:id/reset-mfa (❌) */
export async function resetAdminMfa(id: string, reason: string): Promise<AdminUser> {
  const b = await backend();
  authorize("admins", "manage_admins");
  const text = requireReason(reason);
  b.db.admins.require(id);
  const next = b.db.admins.update(id, { mfaEnabled: false });
  audit(b, { action: "admin.reset_mfa", resourceType: "admin", resourceId: id, before: { mfaEnabled: true }, after: { mfaEnabled: false }, reason: text });
  return clone(next);
}

/**
 * The seven roles with how many admins hold each and their permissions
 * (the matrix in `config/roles.ts`, ride_plan.md §E).
 * // API: GET /admin/roles (❌)
 */
export async function listRoles(): Promise<Role[]> {
  const { db } = await backend();
  authorize("admins", "view");
  return ROLE_IDS.map((id) => ({
    id,
    adminCount: db.admins.all().filter((a) => a.roleId === id && a.status !== "DISABLED").length,
    permissions: ROLE_PERMISSIONS[id],
  }));
}
