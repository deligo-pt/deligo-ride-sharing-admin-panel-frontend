import { cookies } from "next/headers";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { RouteGuard } from "@/components/session/permissions";
import { SessionProvider } from "@/components/session/session-provider";
import { SessionWatcher } from "@/components/session/session-watcher";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { Topbar } from "@/components/shell/topbar";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { SESSION_COOKIE, parseSession } from "@/lib/session";
import { SIDEBAR_COOKIE } from "@/lib/sidebar-cookie";

export default async function AdminLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  const store = await cookies();
  // The proxy already sent signed-out visitors to the login page; this covers a bad cookie.
  const session = parseSession(store.get(SESSION_COOKIE)?.value);
  if (!session)
    return redirect({
      href: "/login",
      locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale,
    });

  // Read on the server so the sidebar renders at the remembered width — no flash.
  const t = await getTranslations("shell");
  const collapsed = store.get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <SessionProvider session={session}>
      <div className="flex min-h-svh">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {t("skipToContent")}
        </a>
        <AppSidebar initialCollapsed={collapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8"
          >
            <RouteGuard>{children}</RouteGuard>
          </main>
        </div>
        <SessionWatcher />
      </div>
    </SessionProvider>
  );
}
