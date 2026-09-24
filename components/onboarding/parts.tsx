"use client";

import { useState, type KeyboardEvent } from "react";
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
      <div className="pt-0.5 font-display text-[21px] leading-8 font-semibold tracking-[-0.02em] text-balance sm:text-[23px]">
        {text === null ? (
          children
        ) : (
          // Words settle in one at a time, like the agent is talking. Screen readers get the sentence whole.
          <span aria-label={text}>
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
      </div>
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
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: readonly string[];
  placeholder?: string;
  id?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const item = raw.trim().replace(/,$/, "");
    if (item && !value.some((v) => v.toLowerCase() === item.toLowerCase())) onChange([...value, item]);
    setDraft("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  const remaining = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border bg-background px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
        {value.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 rounded-md bg-muted py-1 pr-1 pl-2 text-[13px]">
            {item}
            <button
              type="button"
              aria-label={`Remove ${item}`}
              onClick={() => onChange(value.filter((v) => v !== item))}
              className="grid size-4 place-items-center rounded text-subtle-foreground hover:bg-background hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft && add(draft)}
          placeholder={value.length ? "" : placeholder}
          className="min-w-32 flex-1 bg-transparent px-1 py-1 text-[14px] outline-none placeholder:text-subtle-foreground"
        />
      </div>
      {remaining.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {remaining.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-border-strong px-2 py-1 text-[12.5px] text-muted-foreground transition-colors hover:border-solid hover:bg-muted hover:text-foreground"
            >
              <Plus className="size-3" />
              {s}
            </button>
          ))}
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
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T[];
  onChange: (next: T[]) => void;
  multiple?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
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
              "rounded-full border px-3.5 py-1.5 text-[13.5px] transition-colors",
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
