"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { writeSidebarCookie } from "@/lib/sidebar-cookie";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { NavList } from "./nav-list";

/**
 * Desktop sidebar (≥1024 px): 264 px, slides down to a 72 px icon rail.
 * The slider is the round handle on the right edge, next to the logo — same
 * idea as the DeliGo food admin's chevron. The width eases with a slight
 * overshoot and the logo spins once per toggle.
 */
export function AppSidebar({ initialCollapsed }: { initialCollapsed: boolean }) {
  const t = useTranslations("shell");
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = () => {
    setCollapsed((value) => {
      writeSidebarCookie(!value);
      return !value;
    });
  };

  const toggleLabel = collapsed ? t("expandSidebar") : t("collapseSidebar");

  return (
    // z-40 keeps the handle above the sticky top bar (z-30) it overlaps.
    <aside
      className={cn(
        "sticky top-0 z-40 hidden h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex",
        "transition-[width] duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)] motion-reduce:transition-none",
        collapsed ? "w-[72px]" : "w-[264px]",
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center overflow-hidden border-b border-sidebar-border px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <Link
          href="/dashboard"
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <Logo
            compact={collapsed}
            markClassName={cn(
              "transition-transform duration-500 motion-reduce:transition-none",
              collapsed ? "rotate-[360deg]" : "rotate-0",
            )}
          />
        </Link>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggle}
            aria-label={toggleLabel}
            aria-expanded={!collapsed}
            className={cn(
              "absolute top-5 -right-3 grid size-6 place-items-center rounded-full border border-sidebar-border bg-background text-muted-foreground shadow-sm transition-colors outline-none",
              "hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            )}
          >
            <ChevronLeft
              aria-hidden
              className={cn(
                "size-3.5 transition-transform duration-300 motion-reduce:transition-none",
                collapsed && "rotate-180",
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{toggleLabel}</TooltipContent>
      </Tooltip>

      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <div className={cn("p-3", collapsed && "px-2")}>
          <NavList collapsed={collapsed} />
        </div>
      </div>
    </aside>
  );
}
