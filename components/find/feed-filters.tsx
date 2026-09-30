"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { resetFeedFiltersAction, saveFeedFiltersAction } from "@/app/app/find/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FEED_TYPE_LABEL, FEED_TYPES, MIN_SCORES, type FeedFilters as Filters } from "@/lib/jobs/feed/filters";
import { cn } from "@/lib/utils";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending} className="px-4">
      {pending && <Loader2 className="animate-spin" />}
      {pending ? "Updating" : "Show jobs"}
    </Button>
  );
}

const fieldLabel = "text-[12.5px] font-medium text-muted-foreground";

/** Saved on every change, so the feed reopens this way. Chips and the minimum apply at once; text applies on Enter or Show jobs. */
export function FeedFilters({ filters }: { filters: Filters }) {
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const apply = () => form.current?.requestSubmit();
  const summary = [
    filters.keywords || "Any role",
    filters.places || "Anywhere in the U.S.",
    filters.types.length ? filters.types.map((t) => FEED_TYPE_LABEL[t]).join(", ") : "No job types",
    filters.minScore ? `Fit ${filters.minScore}+` : null,
  ].filter(Boolean).join(" · ");

  return (
    <form ref={form} action={saveFeedFiltersAction} className="rounded-2xl border bg-background p-4 sm:p-5">
      {/* On phones the filters fold into one line so the jobs start above the fold. */}
      <div className={cn("flex items-center gap-3 sm:hidden", open && "hidden")}>
        <p className="min-w-0 flex-1 truncate text-[13.5px] text-muted-foreground">{summary}</p>
        <Button type="button" variant="outline" size="lg" onClick={() => setOpen(true)} aria-expanded={open}>
          <SlidersHorizontal />
          Edit filters
        </Button>
      </div>
      <div className={cn(!open && "hidden sm:block")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid min-w-0 gap-1.5">
            <span className={fieldLabel}>Role keywords</span>
            <Input name="keywords" defaultValue={filters.keywords} placeholder="accounting, tax, data analyst" maxLength={200} className="h-9" />
          </label>
          <label className="grid min-w-0 gap-1.5">
            <span className={fieldLabel}>Places</span>
            <Input name="places" defaultValue={filters.places} placeholder="Anywhere in the U.S." maxLength={200} className="h-9" />
          </label>
        </div>

        <fieldset className="mt-4">
          <legend className={fieldLabel}>Job type</legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {FEED_TYPES.map((type) => (
              <label key={type} className="cursor-pointer">
                <input type="checkbox" name="types" value={type} defaultChecked={filters.types.includes(type)} onChange={apply} className="peer sr-only" />
                <span
                  className={cn(
                    "inline-flex h-8 items-center rounded-full border px-3 text-[13px] transition-colors",
                    "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                    "text-muted-foreground hover:bg-muted peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground",
                  )}
                >
                  {FEED_TYPE_LABEL[type]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 flex flex-wrap items-end gap-x-5 gap-y-3">
          <label className="flex h-9 cursor-pointer items-center gap-2 text-[13.5px]">
            <input type="checkbox" name="remote" defaultChecked={filters.remote} onChange={apply} className="size-4 accent-[var(--primary)]" />
            Include remote jobs
          </label>
          <label className="grid gap-1.5">
            <span className={fieldLabel}>Minimum fit</span>
            <select
              name="minScore"
              defaultValue={String(filters.minScore)}
              onChange={apply}
              className="h-9 rounded-lg border border-input bg-background px-2.5 text-[13.5px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {MIN_SCORES.map((score) => (
                <option key={score} value={score}>
                  {score === 0 ? "Any score" : `${score} or higher`}
                </option>
              ))}
            </select>
          </label>
          <div className="ml-auto flex items-center gap-2">
            <Button type="submit" variant="ghost" size="lg" formAction={resetFeedFiltersAction} className="text-muted-foreground">
              Use my profile
            </Button>
            <Submit />
          </div>
        </div>
        <p className="mt-3 text-[12px] text-subtle-foreground">
          U.S. listings only for now. Separate several places with semicolons, like Raleigh, NC; Richmond, VA.
        </p>
      </div>
    </form>
  );
}
