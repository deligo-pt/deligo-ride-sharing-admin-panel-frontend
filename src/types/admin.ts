import type { PermissionMatrix, RoleId } from "@/config/roles";
import type { ISODate, ListParams } from "./common";

export type AdminStatus = "ACTIVE" | "INVITED" | "DISABLED";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  roleId: RoleId;
  status: AdminStatus;
  lastLoginAt?: ISODate;
  invitedAt: ISODate;
  mfaEnabled: boolean;
};

export type AdminInput = Pick<AdminUser, "name" | "email" | "roleId">;

export type AdminListParams = ListParams & { roleId?: RoleId[]; status?: AdminStatus[] };

export type { PermissionAction, PermissionModule } from "@/config/roles";

export type Role = {
  id: RoleId;
  /** Admins with this role (computed). */
  adminCount: number;
  permissions: PermissionMatrix;
};
