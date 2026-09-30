"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Match my device", icon: Monitor },
] as const;

const subscribe = () => () => {};

/** Three-way appearance picker. Renders unselected on the server so nothing flickers. */
export function ThemeChoice() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const current = mounted ? (theme ?? "light") : null;
  return (
    <div role="radiogroup" aria-label="Appearance" className="grid gap-2 sm:grid-cols-3">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(value)}
            className={cn(
              "flex min-h-11 items-center gap-2.5 rounded-lg border px-3 text-left text-[13.5px] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected ? "border-foreground/70 bg-muted font-medium" : "hover:bg-muted/60",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.75} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
