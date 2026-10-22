import { BadgeCheck, Radar, WalletCards } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/shell/language-switcher";
import { Logo } from "@/components/shell/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";

/**
 * Sign-in pages (P6): no shell. Brand panel on the left from 1024 px; the
 * form column has its own language and theme switches.
 */
export default async function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  const t = await getTranslations("auth.brand");
  const points = [
    { icon: Radar, text: t("live") },
    { icon: BadgeCheck, text: t("verify") },
    { icon: WalletCards, text: t("finance") },
  ];

  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-linear-to-br from-brand-600 via-brand-700 to-brand-950 p-10 text-white lg:flex lg:flex-col xl:p-14">
        <RouteArt />
        <Logo className="relative [&_.text-muted-foreground]:text-white/70" />
        <div className="relative mt-auto flex max-w-md flex-col gap-6">
          <h2 className="text-section text-white">{t("title")}</h2>
          <p className="text-body text-white/80">{t("body")}</p>
          <ul className="flex flex-col gap-3">
            {points.map(({ icon: Icon, text }) => (
              <li key={text} className="text-dense flex items-center gap-3 text-white/90">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white/15">
                  <Icon aria-hidden className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-caption relative mt-10 text-white/60">{t("footer")}</p>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center justify-between gap-2 px-4 sm:px-8">
          <Logo className="lg:invisible" />
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>
        <main
          id="main"
          className="flex flex-1 justify-center px-4 pt-6 pb-12 sm:items-center sm:px-8 sm:pt-0"
        >
          <div className="w-full max-w-md">{children}</div>
        </main>
        <p className="text-caption px-4 pb-6 text-center lg:hidden">{t("footer")}</p>
      </div>
    </div>
  );
}

/** A stylised route between a pickup and a drop-off, behind the brand copy. */
function RouteArt() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 400"
      className="pointer-events-none absolute top-0 right-0 w-[min(34rem,95%)] text-white"
      fill="none"
    >
      <defs>
        <radialGradient id="auth-grid-fade" cx="60%" cy="40%" r="60%">
          <stop offset="0" stopColor="white" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="auth-grid-mask">
          <rect width="400" height="400" fill="url(#auth-grid-fade)" />
        </mask>
      </defs>
      <g opacity="0.12" stroke="currentColor" strokeWidth="1" mask="url(#auth-grid-mask)">
        {Array.from({ length: 9 }, (_, i) => (
          <path key={`h${i}`} d={`M0 ${i * 50}H400`} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <path key={`v${i}`} d={`M${i * 50} 0V400`} />
        ))}
      </g>
      <path
        d="M70 320 C 120 300, 110 230, 170 210 S 260 200, 270 140 S 320 100, 330 92"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="2 12"
      />
      <circle cx="70" cy="320" r="10" fill="currentColor" fillOpacity="0.9" />
      <circle cx="70" cy="320" r="22" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" />
      <path
        d="M330 50c-12 0-21 9-21 21 0 15 21 35 21 35s21-20 21-35c0-12-9-21-21-21Z"
        fill="currentColor"
        fillOpacity="0.9"
      />
      <circle cx="330" cy="71" r="7" className="fill-brand-700" />
    </svg>
  );
}
