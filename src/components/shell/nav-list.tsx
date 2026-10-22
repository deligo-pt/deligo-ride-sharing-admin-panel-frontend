"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { findNavItem, type NavGroup, type NavGroupKey, type ModuleKey } from "@/config/nav";
import { useAllowedNav } from "@/components/session/permissions";
import { Link, usePathname } from "@/i18n/navigation";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * The grouped menu, shared by the desktop sidebar and the mobile drawer.
 *
 * Each group is a drawer: its heading opens it and closes whichever was open
 * (one at a time). The group holding the current page starts open and opens
 * again when the page changes from elsewhere (⌘K, a breadcrumb).
 * `collapsed` = the icon rail: one icon per group, clicking it pops the
 * group's pages out to the right. Only modules the role can view are listed.
 */
export function NavList({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const tShell = useTranslations("shell");
  const nav = useAllowedNav();
  const pathname = usePathname();
  const active = findNavItem(pathname);
  const activeKey = active?.item.key;
  const activeGroup = active?.group.key ?? null;

  const [openGroup, setOpenGroup] = useState<NavGroupKey | null>(activeGroup);
  // Follow navigation: when the current page moves to another group, open it.
  // (State adjusted during render — React's documented alternative to an effect.)
  const [seenGroup, setSeenGroup] = useState(activeGroup);
  if (activeGroup !== seenGroup) {
    setSeenGroup(activeGroup);
    if (activeGroup) setOpenGroup(activeGroup);
  }

  return (
    <nav aria-label={tShell("mainMenu")} className="flex flex-col gap-1">
      {nav.map((group) =>
        collapsed ? (
          <RailGroup
            key={group.key}
            group={group}
            activeKey={activeKey}
            current={group.key === activeGroup}
            onNavigate={onNavigate}
          />
        ) : (
          <DrawerGroup
            key={group.key}
            group={group}
            activeKey={activeKey}
            current={group.key === activeGroup}
            open={openGroup === group.key}
            onToggle={() => setOpenGroup((key) => (key === group.key ? null : group.key))}
            onNavigate={onNavigate}
          />
        ),
      )}
    </nav>
  );
}

type GroupProps = {
  group: NavGroup;
  activeKey: ModuleKey | undefined;
  /** The current page lives in this group. */
  current: boolean;
  onNavigate?: () => void;
};

function DrawerGroup({
  group,
  activeKey,
  current,
  open,
  onToggle,
  onNavigate,
}: GroupProps & { open: boolean; onToggle: () => void }) {
  const t = useTranslations("nav");
  // useId, not the group key: the desktop sidebar and the mobile drawer can both be in the DOM.
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "group flex h-9 w-full items-center gap-3 rounded-md px-3 text-dense font-semibold text-sidebar-foreground transition-colors outline-none",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        )}
      >
        <group.icon
          aria-hidden
          className={cn(
            "size-4 shrink-0 transition-colors",
            current || open
              ? "text-primary"
              : "text-muted-foreground group-hover:text-sidebar-accent-foreground",
          )}
        />
        <span className="flex-1 truncate text-left">{t(`groups.${group.key}`)}</span>
        {/* A closed drawer still shows where the current page is. */}
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full bg-primary transition-opacity duration-200",
            current && !open ? "opacity-100" : "opacity-0",
          )}
        />
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-300 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>

      {/* grid-rows 0fr → 1fr animates to the content's real height; inert keeps
          the hidden links out of the tab order and the accessibility tree. */}
      <div
        id={panelId}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className="mt-0.5 mb-1 ml-5 flex flex-col gap-0.5 border-l border-sidebar-border pl-2">
            {group.items.map((item, index) => (
              <li
                key={item.key}
                // Links slide in one after another when the drawer opens; all leave together.
                style={{ transitionDelay: open ? `${60 + index * 40}ms` : "0ms" }}
                className={cn(
                  "transition-[opacity,translate] duration-300 motion-reduce:transition-none",
                  open ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0",
                )}
              >
                <ItemLink item={item} active={item.key === activeKey} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function RailGroup({ group, activeKey, current, onNavigate }: GroupProps) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const label = t(`groups.${group.key}`);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={label}
              className={cn(
                "group mx-auto grid size-10 place-items-center rounded-md transition-colors outline-none",
                "hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                (current || open) && "bg-sidebar-accent",
              )}
            >
              <group.icon
                aria-hidden
                className={cn(
                  "size-[18px]",
                  current || open
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-sidebar-accent-foreground",
                )}
              />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        {!open && <TooltipContent side="right">{label}</TooltipContent>}
      </Tooltip>
      <PopoverContent side="right" align="start" sideOffset={12} className="w-56 gap-1 p-1.5">
        <p className="text-micro px-2 pt-1 pb-1 text-muted-foreground">{label}</p>
        {group.items.map((item) => (
          <ItemLink
            key={item.key}
            item={item}
            active={item.key === activeKey}
            onNavigate={() => {
              setOpen(false);
              onNavigate?.();
            }}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}

function ItemLink({
  item,
  active,
  onNavigate,
}: {
  item: NavGroup["items"][number];
  active: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-9 items-center gap-3 rounded-md px-3 text-dense font-medium text-sidebar-foreground transition-colors outline-none",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        active && "bg-sidebar-accent text-sidebar-accent-foreground",
      )}
    >
      <item.icon
        aria-hidden
        className={cn(
          "size-4 shrink-0",
          active
            ? "text-primary"
            : "text-muted-foreground group-hover:text-sidebar-accent-foreground",
        )}
      />
      <span className="truncate">{t(`items.${item.key}`)}</span>
    </Link>
  );
}
