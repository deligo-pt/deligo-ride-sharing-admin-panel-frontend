"use client";

import { useCallback, useMemo } from "react";
import { LayoutDashboard } from "lucide-react";
import { useTranslations } from "next-intl";
import { NAV, type NavGroup } from "@/config/nav";
import type { PermissionAction, PermissionModule } from "@/config/roles";
import { NoAccess } from "@/components/feedback/states";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/i18n/navigation";
import { can, routeRequirement } from "@/lib/permissions";
import { useSession } from "./session-provider";

/**
 * Permission-aware UI (P7). Hiding a button is never the only check: the
 * services refuse the same actions with FORBIDDEN (requirements §20).
 *
 *   const allowed = usePermission();
 *   allowed("customers", "suspend")
 *   <Can module="customers" action="export"><ExportButton … /></Can>
 */
export function usePermission() {
  const { role } = useSession().session;
  return useCallback(
    (module: PermissionModule, action: PermissionAction) => can(role, module, action),
    [role],
  );
}

export function Can({
  module,
  action,
  children,
  fallback = null,
}: {
  module: PermissionModule;
  action: PermissionAction;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return usePermission()(module, action) ? children : fallback;
}

/** The menu without the modules the role can't view (sidebar, drawer, ⌘K). Empty groups disappear. */
export function useAllowedNav(): NavGroup[] {
  const allowed = usePermission();
  return useMemo(
    () =>
      NAV.map((group) => ({
        ...group,
        items: group.items.filter((item) => allowed(item.key, "view")),
      })).filter((group) => group.items.length > 0),
    [allowed],
  );
}

/**
 * Wraps every `(admin)` page: a URL typed or bookmarked for a module the
 * role can't open shows "No access" instead of the page. Follows the role
 * switcher instantly (it reads the session context).
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const t = useTranslations("feedback");
  const pathname = usePathname();
  const allowed = usePermission();
  const requirement = routeRequirement(pathname);

  if (requirement && !allowed(requirement.module, requirement.action)) {
    return (
      <NoAccess
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">
              <LayoutDashboard aria-hidden />
              {t("noAccessHome")}
            </Link>
          </Button>
        }
      />
    );
  }
  return children;
}
