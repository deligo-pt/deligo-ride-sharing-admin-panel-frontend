"use client";

import { useTranslations } from "next-intl";
import { useAllowedNav } from "@/components/session/permissions";
import { useRouter } from "@/i18n/navigation";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/**
 * The palette itself (cmdk + dialog). Loaded on first open by
 * `command-palette.tsx`, so cmdk is not in every page's first-load JS.
 */
export default function CommandPaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const nav = useAllowedNav();

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("shell.searchTitle")}
      description={t("shell.searchDescription")}
    >
      <Command>
        <CommandInput placeholder={t("shell.searchPlaceholder")} />
        <CommandList>
          <CommandEmpty>{t("common.noResults")}</CommandEmpty>
          {nav.map((group) => (
            <CommandGroup key={group.key} heading={t(`nav.groups.${group.key}`)}>
              {group.items.map((item) => {
                const label = t(`nav.items.${item.key}`);
                return (
                  <CommandItem
                    key={item.key}
                    value={`${label} ${item.keywords?.join(" ") ?? ""}`}
                    onSelect={() => go(item.href)}
                  >
                    <item.icon aria-hidden />
                    {label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
