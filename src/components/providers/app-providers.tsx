"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { makeQueryClient } from "@/lib/query-client";

/**
 * App-wide client providers. Theme follows the OS until the user picks one
 * (stored by next-themes); the `.dark` class drives the dark tokens. One
 * QueryClient per browser tab (useState, so it survives re-renders).
 */

/*
 * next-themes' anti-flash <script> runs from the server HTML. When the root
 * layout mounts in the browser (language switch, not-found) React 19 warns
 * "Encountered a script tag" — the browser copy is inert, so mark it as data.
 * The tag has suppressHydrationWarning, so the differing `type` is safe.
 */
const THEME_SCRIPT_PROPS = {
  type: typeof window === "undefined" ? "text/javascript" : "text/plain",
};
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  return (
    <NuqsAdapter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          scriptProps={THEME_SCRIPT_PROPS}
        >
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster richColors closeButton position="top-right" />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </NuqsAdapter>
  );
}
