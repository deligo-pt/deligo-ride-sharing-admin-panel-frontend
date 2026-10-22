"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ROLE_IDS, type RoleId } from "@/config/roles";
import { useSession } from "@/components/session/session-provider";
import { initials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Admin name, role and the demo role switcher (a prototype-only control so the
 * manager can preview each role — P7 filters menus and actions by it).
 * The session comes from the server (cookie), so it renders right first time.
 */
export function UserMenu() {
  const t = useTranslations();
  const { session, setRole, signOut } = useSession();
  const { name: adminName, email, role: shownRole } = session;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2.5 px-1.5 sm:px-2"
          aria-label={t("shell.accountMenu")}
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">
              {initials(adminName)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden min-w-0 flex-col items-start leading-tight xl:flex">
            <span className="truncate text-dense font-semibold">{adminName}</span>
            <span className="text-caption truncate">{t(`roles.${shownRole}`)}</span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-dense font-semibold text-foreground">{adminName}</span>
          <span className="text-caption font-normal">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <ShieldCheck />
            <span className="flex flex-col">
              <span>{t("shell.previewAsRole")}</span>
              <span className="text-caption">{t(`roles.${shownRole}`)}</span>
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-60">
            <DropdownMenuRadioGroup
              value={shownRole}
              onValueChange={(value) => {
                setRole(value as RoleId);
                toast.success(t("shell.nowPreviewing", { role: t(`roles.${value as RoleId}`) }));
              }}
            >
              {ROLE_IDS.map((id) => (
                <DropdownMenuRadioItem key={id} value={id}>
                  {t(`roles.${id}`)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={signOut}>
          <LogOut />
          {t("shell.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
