"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const FIRST_YEAR = 1900;
const LAST_YEAR = 2100;

const parse = (value: string) => {
  const found = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  return found ? { year: Number(found[1]), month: Number(found[2]) } : null;
};

/** "2026-06" as "June 2026"; anything else as an empty string. */
export function formatMonth(value: string): string {
  const parsed = parse(value);
  return parsed ? `${MONTHS[parsed.month - 1]} ${parsed.year}` : "";
}

type Props = {
  id?: string;
  /** Controlled value as "YYYY-MM", or "" for none. */
  value?: string;
  /** Starting value when the field is not controlled. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Submitted with a plain form post as "YYYY-MM". */
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

/**
 * A month and year, picked by clicking. The browser's own month control is a native
 * popup that some browsers don't have (Firefox and desktop Safari show a text box) and
 * that automation can't reach, so this one is ordinary buttons on the page: a year box with
 * arrows and the twelve months. One click on a month sets it and closes the picker.
 */
export function MonthInput({ id, value, defaultValue = "", onChange, name, required, disabled, placeholder = "Choose a month", className }: Props) {
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const selected = parse(current);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => selected?.year ?? new Date().getFullYear());
  // What is typed in the year box, which may be a half-typed year while the real year stays put.
  const [typed, setTyped] = useState(() => String(year));
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Opened low on a phone, the picker would sit under the bottom bar; bring all of it into view.
  useEffect(() => {
    if (open) panel.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open]);

  const move = (to: number) => {
    const next = Math.min(LAST_YEAR, Math.max(FIRST_YEAR, to));
    setYear(next);
    setTyped(String(next));
  };
  const commit = (next: string) => {
    setInner(next);
    onChange?.(next);
    setOpen(false);
    trigger.current?.focus();
  };
  const toggle = () => {
    if (!open) move(selected?.year ?? year);
    setOpen((was) => !was);
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="relative">
        <button
          ref={trigger}
          id={id}
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          data-value={current}
          onClick={toggle}
          className="flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-field bg-transparent px-2.5 py-1 text-left text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>{selected ? formatMonth(current) : placeholder}</span>
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
        {/* Lets the browser's own "fill this in" check work for a required month, then hands focus to the button. */}
        {required && <input tabIndex={-1} aria-hidden="true" required value={current} onChange={() => {}} onFocus={() => trigger.current?.focus()} className="pointer-events-none absolute inset-0 opacity-0" />}
        {name && <input type="hidden" name={name} value={current} disabled={disabled} />}
      </div>

      {open && !disabled && (
        <div ref={panel} id={panelId} role="group" aria-label="Choose a month" className="mt-2 w-full max-w-72 scroll-mb-28 rounded-xl border bg-background p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => move(year - 1)} disabled={year <= FIRST_YEAR} aria-label="Previous year">
              <ChevronLeft />
            </Button>
            <input
              aria-label="Year"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={typed}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                setTyped(digits);
                const typedYear = Number(digits);
                if (digits.length === 4 && typedYear >= FIRST_YEAR && typedYear <= LAST_YEAR) setYear(typedYear);
              }}
              onBlur={() => setTyped(String(year))}
              className="h-8 w-20 rounded-lg border border-field bg-transparent text-center text-base font-medium tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => move(year + 1)} disabled={year >= LAST_YEAR} aria-label="Next year">
              <ChevronRight />
            </Button>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {MONTHS.map((month, index) => {
              const here = selected?.year === year && selected.month === index + 1;
              return (
                <button
                  key={month}
                  type="button"
                  aria-label={`${month} ${year}`}
                  aria-pressed={here}
                  onClick={() => commit(`${year}-${String(index + 1).padStart(2, "0")}`)}
                  className={cn(
                    "h-10 rounded-lg border text-[13px] font-medium outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    here ? "border-primary bg-primary text-primary-foreground" : "border-transparent hover:bg-muted",
                  )}
                >
                  {month.slice(0, 3)}
                </button>
              );
            })}
          </div>
          {!required && current && (
            <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => commit("")}>
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
