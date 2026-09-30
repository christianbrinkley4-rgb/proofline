"use client";

import { ThemeProvider as NextThemes } from "next-themes";

/** Light by default. Dark and "match my device" are opt-in from Settings. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
