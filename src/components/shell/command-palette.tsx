"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

// cmdk (~30 kB gz) loads the first time the palette opens, not with every page.
const CommandPaletteDialog = dynamic(() => import("./command-palette-dialog"), { ssr: false });

/** ⌘K / Ctrl+K: jump to any module. Later phases can add records (rides, drivers) as groups. */
export function CommandPalette() {
  const t = useTranslations("shell");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const show = (next: boolean) => {
    if (next) setLoaded(true);
    setOpen(next);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setLoaded(true);
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => show(true)}
        className="h-9 w-9 justify-center px-0 text-muted-foreground sm:w-64 sm:justify-start sm:px-3"
        aria-label={t("searchLabel")}
      >
        <Search />
        <span className="hidden flex-1 text-left font-normal sm:inline">{t("search")}</span>
        <kbd className="hidden rounded border bg-muted px-1.5 font-mono text-[10px] font-medium sm:inline">
          Ctrl K
        </kbd>
      </Button>
      {loaded && <CommandPaletteDialog open={open} onOpenChange={show} />}
    </>
  );
}
