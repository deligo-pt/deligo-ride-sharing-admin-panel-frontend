import { findNavItem } from "@/config/nav";
import {
  ROLE_PERMISSIONS,
  type PermissionAction,
  type PermissionModule,
  type RoleId,
} from "@/config/roles";

/**
 * Role-based access (requirements §20, ride_plan.md §E). Pure functions, so
 * the screens (`usePermission`, `<Can>`), the route guard and the services
 * (the stand-in backend) all decide the same way.
 */
export function can(role: RoleId, module: PermissionModule, action: PermissionAction): boolean {
  return ROLE_PERMISSIONS[role][module]?.includes(action) ?? false;
}

export type Requirement = { module: PermissionModule; action: PermissionAction };

/**
 * Pages that need more than `view` of their module. Checked longest-first;
 * every other page under a menu entry needs `view` of that entry's module.
 */
const ROUTE_RULES: { path: `/${string}`; requires: Requirement }[] = [
  { path: "/vehicles/new", requires: { module: "vehicles", action: "create" } },
  { path: "/pricing/new", requires: { module: "pricing", action: "modify_pricing" } },
];

/** What the current page needs, or null for pages outside the menu (design-system). */
export function routeRequirement(pathname: string): Requirement | null {
  // Pages with an id in the middle: /vehicles/VEH-5012/edit.
  if (/^\/vehicles\/[^/]+\/edit$/.test(pathname)) return { module: "vehicles", action: "edit" };
  const rule = ROUTE_RULES.find((r) => pathname === r.path || pathname.startsWith(`${r.path}/`));
  if (rule) return rule.requires;
  const nav = findNavItem(pathname);
  return nav ? { module: nav.item.key, action: "view" } : null;
}
