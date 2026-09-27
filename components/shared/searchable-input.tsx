"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Kind = "roles" | "schools" | "degrees" | "fields";
type Option = { value: string; label: string };

/** Search helps people find a standard name; their own wording always remains valid. */
export function SearchableInput({
  id, name, kind, value, onChange, placeholder, required, maxLength, className,
}: {
  id: string;
  name?: string;
  kind: Kind;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  className?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const minLength = kind === "schools" ? 2 : 0;

  useEffect(() => {
    if (!open || value.trim().length < minLength) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setFailed(false);
        const params = new URLSearchParams({ kind, q: value.trim() });
        const response = await fetch(`/api/profile-options?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search unavailable");
        const data = await response.json() as { options: Option[] };
        setOptions(data.options);
        setActive(-1);
      } catch {
        if (!controller.signal.aborted) {
          setFailed(true);
          setOptions([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 160);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [kind, open, value, minLength]);

  const choose = (option: Option) => {
    onChange(option.value);
    setOpen(false);
    setActive(-1);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") setOpen(false);
    if (event.key === "ArrowDown" && options.length) {
      event.preventDefault();
      setOpen(true);
      setActive((current) => (current + 1) % options.length);
    }
    if (event.key === "ArrowUp" && options.length) {
      event.preventDefault();
      setActive((current) => (current <= 0 ? options.length - 1 : current - 1));
    }
    if (event.key === "Enter" && open && active >= 0 && options[active]) {
      event.preventDefault();
      choose(options[active]);
    }
  };
  const showList = open && (options.length > 0 || loading || failed || value.trim().length >= minLength);

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        maxLength={maxLength}
        value={value}
        onChange={(event) => { onChange(event.target.value); setOptions([]); setActive(-1); setOpen(true); }}
        onFocus={() => { setOpen(true); setOptions([]); }}
        onBlur={() => window.setTimeout(() => { setOpen(false); setLoading(false); }, 100)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={showList ? listId : undefined}
        aria-activedescendant={active >= 0 && showList ? `${listId}-${active}` : undefined}
        className={cn("h-10", className)}
      />
      {showList && (
        <div id={listId} role="listbox" className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
          {loading && !options.length && <p className="px-3 py-2 text-[12px] text-muted-foreground">Searching…</p>}
          {failed && <p className="px-3 py-2 text-[12px] text-muted-foreground">Search is unavailable. You can still type your answer.</p>}
          {!loading && !failed && !options.length && <p className="px-3 py-2 text-[12px] text-muted-foreground">No match. Keep your own wording if it is right.</p>}
          {options.map((option, index) => (
            <button
              id={`${listId}-${index}`}
              key={`${option.label}-${index}`}
              type="button"
              role="option"
              aria-selected={index === active}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
              className={cn("block min-h-10 w-full rounded-md px-3 py-2 text-left text-[13px] hover:bg-muted", index === active && "bg-muted")}
            >
              {option.label}
            </button>
          ))}
          {kind === "roles" && options.length > 0 && (
            <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">Occupation names adapted from <a href="https://www.onetcenter.org/database.html" target="_blank" rel="noreferrer" className="underline">O*NET 31.0</a>, CC BY 4.0.</p>
          )}
        </div>
      )}
    </div>
  );
}
