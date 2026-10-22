import { Breadcrumbs } from "./breadcrumbs";
import { CommandPalette } from "./command-palette";
import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { NotificationsBell } from "./notifications-bell";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:gap-3 sm:px-6 lg:px-8">
      <MobileNav />
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <CommandPalette />
        <LanguageSwitcher />
        <ThemeToggle />
        <NotificationsBell />
        <UserMenu />
      </div>
    </header>
  );
}
