import type { RoleId } from "@/config/roles";
import type { AdminStatus } from "@/types/admin";

/**
 * The 15 back-office staff, written by hand so every generator can name them
 * (note authors, ticket assignees, audit entries) without generating anything.
 * ADM-001 is the demo login (stores/demo-session.ts).
 */
export type AdminSeed = {
  id: string;
  name: string;
  roleId: RoleId;
  status: AdminStatus;
  mfaEnabled: boolean;
};

export const ADMIN_SEEDS: readonly AdminSeed[] = [
  { id: "ADM-001", name: "Ana Martins", roleId: "SUPER_ADMIN", status: "ACTIVE", mfaEnabled: true },
  { id: "ADM-002", name: "Ricardo Sousa", roleId: "SUPER_ADMIN", status: "ACTIVE", mfaEnabled: true },
  { id: "ADM-003", name: "Marta Oliveira", roleId: "OPERATIONS_ADMIN", status: "ACTIVE", mfaEnabled: true },
  { id: "ADM-004", name: "Tiago Fernandes", roleId: "OPERATIONS_ADMIN", status: "ACTIVE", mfaEnabled: false },
  { id: "ADM-005", name: "Beatriz Lopes", roleId: "SUPPORT_AGENT", status: "ACTIVE", mfaEnabled: true },
  { id: "ADM-006", name: "Diogo Pereira", roleId: "SUPPORT_AGENT", status: "ACTIVE", mfaEnabled: false },
  { id: "ADM-007", name: "Carolina Santos", roleId: "SUPPORT_AGENT", status: "ACTIVE", mfaEnabled: true },
  { id: "ADM-008", name: "Hugo Almeida", roleId: "SUPPORT_AGENT", status: "DISABLED", mfaEnabled: false },
  { id: "ADM-009", name: "Sofia Rodrigues", roleId: "VERIFICATION_OFFICER", status: "ACTIVE", mfaEnabled: true },
  { id: "ADM-010", name: "Pedro Gonçalves", roleId: "VERIFICATION_OFFICER", status: "ACTIVE", mfaEnabled: true },
  { id: "ADM-011", name: "Inês Carvalho", roleId: "FINANCE_ADMIN", status: "ACTIVE", mfaEnabled: true },
  { id: "ADM-012", name: "Miguel Ribeiro", roleId: "FINANCE_ADMIN", status: "ACTIVE", mfaEnabled: true },
  { id: "ADM-013", name: "Joana Teixeira", roleId: "FLEET_OPS_MANAGER", status: "ACTIVE", mfaEnabled: false },
  { id: "ADM-014", name: "Rui Marques", roleId: "READ_ONLY_ANALYST", status: "ACTIVE", mfaEnabled: false },
  { id: "ADM-015", name: "Catarina Mendes", roleId: "READ_ONLY_ANALYST", status: "INVITED", mfaEnabled: false },
];

export const adminName = (id: string) => ADMIN_SEEDS.find((a) => a.id === id)?.name ?? id;

/** Active admins with a role — for assigning generated work (reviews, tickets). */
export const adminsWithRole = (...roles: RoleId[]) =>
  ADMIN_SEEDS.filter((a) => a.status === "ACTIVE" && roles.includes(a.roleId));
