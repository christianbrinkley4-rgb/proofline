"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/** The agent's line at the top of each step. */
export function AgentSays({ children, className }: { children: React.ReactNode; className?: string }) {
  const text = plainText(children);
  return (
    <div className={cn("flex gap-3", className)}>
      <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-ink">
        <span aria-hidden="true" className="absolute inset-0 rounded-full bg-brand/40 opacity-0 motion-safe:animate-ring-out" />
        <LogoMark className="relative size-4 [&_rect]:fill-transparent" />
      </span>
      {/* The agent's line is the step's heading, so screen readers can jump straight to it. */}
      <h1 className="pt-0.5 font-display text-[21px] leading-8 font-semibold tracking-[-0.02em] text-balance sm:text-[23px]">
        {text === null ? (
          children
        ) : (
          // Words settle in one at a time, like the agent is talking. Screen readers get the sentence whole.
          <span>
            <span className="sr-only">{text}</span>
            {text.split(/(\s+)/).map((part, i) =>
              /^\s+$/.test(part) ? (
                part
              ) : (
                <span
                  key={i}
                  aria-hidden="true"
                  className="inline-block motion-safe:animate-word-in"
                  style={{ animationDelay: `${Math.min(i * 22, 900)}ms` }}
                >
                  {part}
                </span>
              ),
            )}
          </span>
        )}
      </h1>
    </div>
  );
}

/** The string inside simple JSX children ("Hi ", name, "."), or null when there's markup to keep. */
function plainText(node: React.ReactNode): string | null {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    const parts = node.map(plainText);
    return parts.every((p) => p !== null) ? parts.join("") : null;
  }
  return null;
}

export function StepHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 pl-11 text-[14.5px] leading-6 text-muted-foreground motion-safe:animate-rise motion-safe:[animation-delay:260ms]">{children}</p>;
}

/** Free-form chips with suggestions. Enter or comma adds; backspace on empty removes the last one. */
export function ChipInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
  id,
  ariaLabel,
  visible = Infinity,
  searchKind,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: readonly string[];
  placeholder?: string;
  id?: string;
  /** For inputs without a visible <label>. */
  ariaLabel?: string;
  /** How many suggestions to show before "More ideas", so a long list doesn't bury the rest of the form on a phone. */
  visible?: number;
  searchKind?: "roles";
}) {
  const [draft, setDraft] = useState("");
  const [matches, setMatches] = useState<Array<{ value: string; label: string }>>([]);
  const [activeMatch, setActiveMatch] = useState(-1);
  const searchId = useId();
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (!searchKind || draft.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ kind: searchKind, q: draft.trim() });
        const response = await fetch(`/api/profile-options?${params}`, { signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json() as { options: Array<{ value: string; label: string }> };
        setMatches(data.options.filter((option) => !value.some((item) => item.toLowerCase() === option.value.toLowerCase())));
        setActiveMatch(-1);
      } catch {
        if (!controller.signal.aborted) setMatches([]);
      }
    }, 160);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [draft, searchKind, value]);
  const add = (raw: string) => {
    const item = raw.trim().replace(/,$/, "");
    if (item && !value.some((v) => v.toLowerCase() === item.toLowerCase())) onChange([...value, item]);
    setDraft("");
    setMatches([]);
    setActiveMatch(-1);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && matches.length) {
      e.preventDefault();
      setActiveMatch((index) => (index + 1) % matches.length);
    } else if (e.key === "ArrowUp" && matches.length) {
      e.preventDefault();
      setActiveMatch((index) => index <= 0 ? matches.length - 1 : index - 1);
    } else if (e.key === "Escape") {
      setMatches([]);
      setActiveMatch(-1);
    } else if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(e.key === "Enter" && activeMatch >= 0 && matches[activeMatch] ? matches[activeMatch].value : draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  const remaining = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-field bg-background px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
        {value.map((item) => (
          <span key={item} className="inline-flex items-center gap-0.5 rounded-md bg-muted py-0.5 pr-0.5 pl-2 text-[13px]">
            {item}
            <button
              type="button"
              aria-label={`Remove ${item}`}
              onClick={() => onChange(value.filter((v) => v !== item))}
              className="grid size-6 place-items-center rounded text-subtle-foreground hover:bg-background hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          aria-label={ariaLabel}
          role={searchKind ? "combobox" : undefined}
          aria-autocomplete={searchKind ? "list" : undefined}
          aria-expanded={searchKind ? matches.length > 0 : undefined}
          aria-controls={searchKind && matches.length ? searchId : undefined}
          aria-activedescendant={activeMatch >= 0 ? `${searchId}-${activeMatch}` : undefined}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setMatches([]); setActiveMatch(-1); }}
          onKeyDown={onKeyDown}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? "" : placeholder}
          className="min-w-32 flex-1 bg-transparent px-1 py-1 text-[14px] outline-none placeholder:text-subtle-foreground"
        />
      </div>
      {searchKind && matches.length > 0 && (
        <div id={searchId} role="listbox" className="mt-1 max-h-48 overflow-y-auto rounded-lg border bg-popover p-1 shadow-sm">
          {matches.map((option, index) => (
            <button
              id={`${searchId}-${index}`}
              key={option.value}
              type="button"
              role="option"
              aria-selected={activeMatch === index}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => add(option.value)}
              className={cn("block min-h-10 w-full rounded-md px-3 py-2 text-left text-[13px] hover:bg-muted", activeMatch === index && "bg-muted")}
            >
              {option.label}
            </button>
          ))}
          <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">Occupation names adapted from <a href="https://www.onetcenter.org/database.html" target="_blank" rel="noreferrer" className="underline">O*NET 31.0</a>, CC BY 4.0.</p>
        </div>
      )}
      {remaining.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(showAll ? remaining : remaining.slice(0, visible)).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-border-strong px-2 py-1 text-[12.5px] text-muted-foreground transition-colors hover:border-solid hover:bg-muted hover:text-foreground pointer-coarse:py-2"
            >
              <Plus className="size-3" />
              {s}
            </button>
          ))}
          {!showAll && remaining.length > visible && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="rounded-md px-2 py-1 text-[12.5px] font-medium underline-offset-4 hover:underline pointer-coarse:py-2"
            >
              More ideas ({remaining.length - visible})
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** A single-select row of pill buttons. */
export function PillChoice<T extends string>({
  options,
  value,
  onChange,
  multiple,
  label,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T[];
  onChange: (next: T[]) => void;
  multiple?: boolean;
  /** Names the group for screen readers, since a visible label can't point at several buttons. */
  label?: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            onClick={() =>
              onChange(multiple ? (selected ? value.filter((v) => v !== o.value) : [...value, o.value]) : selected ? [] : [o.value])
            }
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[13.5px] transition-colors pointer-coarse:py-2.5",
              selected ? "border-foreground bg-foreground text-background" : "bg-background hover:border-border-strong",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12.5px] text-subtle-foreground">{hint}</p>}
    </div>
  );
}
