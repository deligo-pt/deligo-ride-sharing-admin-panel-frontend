import { SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <main className="grid flex-1 place-items-center p-8">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-accent text-accent-foreground">
          <SearchX aria-hidden className="size-7" />
        </span>
        <h1 className="text-page-title">{t("title")}</h1>
        <p className="text-dense text-muted-foreground">{t("body")}</p>
        <Button asChild>
          <Link href="/dashboard">{t("home")}</Link>
        </Button>
      </div>
    </main>
  );
}
