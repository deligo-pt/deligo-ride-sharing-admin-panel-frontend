import { NextResponse, type NextRequest } from "next/server";
import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { SESSION_COOKIE, isGuestPath, isOpenPath, parseSession } from "@/lib/session";

// Next 16 "proxy" (formerly middleware).
// 1. next-intl adds the locale prefix — `/` → `/pt`, `/rides` → `/pt/rides`.
// 2. Route protection (P6, an optimistic cookie check): signed out → the
//    login page with `?next=`; signed in → away from login / forgot password.
const intl = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const [, locale, ...rest] = pathname.split("/");

  // Unprefixed paths are only redirected by next-intl; the next request lands here again.
  if (locale && hasLocale(routing.locales, locale)) {
    const path = `/${rest.join("/")}`;
    const signedIn = parseSession(request.cookies.get(SESSION_COOKIE)?.value) !== null;

    if (signedIn && isGuestPath(path)) {
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
    }
    if (!signedIn && !isGuestPath(path) && !isOpenPath(path)) {
      const login = new URL(`/${locale}/login`, request.url);
      if (path !== "/") login.searchParams.set("next", `${path}${search}`);
      return NextResponse.redirect(login);
    }
  }

  return intl(request);
}

export const config = {
  // Everything except Next internals, Vercel internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
