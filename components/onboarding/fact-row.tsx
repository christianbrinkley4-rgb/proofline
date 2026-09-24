"use client";

import { useState, useTransition } from "react";
import { Check, CircleAlert, Pencil, X } from "lucide-react";
import { confirmFactAction, rejectFactAction, reviseFactAction } from "@/app/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FactView } from "./types";

/** Where a proposal came from, so the person knows who is asking them to confirm it. */
function origin(fact: FactView): string | null {
  if (fact.source === "connector") return `Suggested by ${fact.sourceDetail?.trim() || "your connected AI"}`;
  if (fact.source === "resume_parsed") return "From your resume";
  if (fact.source === "agent_proposed" || fact.source === "inferred") return "Proofline's suggestion";
  return null;
}

/** One fact with Yes / No / Edit. Confirmed facts show a check and can still be corrected. */
export function FactRow({ fact }: { fact: FactView }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fact.content);
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState<FactView["state"] | null>(null);
  const state = local ?? fact.state;

  if (state === "rejected") return null;

  const run = (fn: () => Promise<void>, optimistic?: FactView["state"]) => {
    if (optimistic) setLocal(optimistic);
    startTransition(fn);
  };

  return (
    <li
      className={cn(
        "rounded-lg border p-3 transition-colors",
        state === "confirmed" ? "bg-background" : "border-pending/40 bg-pending-soft/60",
        pending && "opacity-70",
      )}
    >
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setEditing(false);
            run(() => reviseFactAction(fact.id, draft), "confirmed");
          }}
        >
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} className="bg-background text-[14px]" autoFocus />
          <div className="mt-2 flex gap-2">
            <Button type="submit" size="sm">
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-start gap-3">
          {state === "confirmed" ? (
            <Check className="mt-0.5 size-4 shrink-0 text-brand" strokeWidth={2.5} aria-label="Confirmed" />
          ) : (
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-pending" aria-label="Needs your OK" />
          )}
          <p className="min-w-0 flex-1 text-[14px] leading-6">
            {fact.content}
            {state !== "confirmed" && origin(fact) && <span className="block text-[11.5px] leading-4 text-muted-foreground">{origin(fact)}</span>}
          </p>
          <div className="flex shrink-0 gap-1">
            {state !== "confirmed" && (
              <>
                <Button size="xs" onClick={() => run(() => confirmFactAction(fact.id), "confirmed")}>
                  Yes
                </Button>
                <Button size="xs" variant="outline" className="bg-background" onClick={() => run(() => rejectFactAction(fact.id), "rejected")}>
                  No
                </Button>
              </>
            )}
            <Button size="icon-xs" variant="ghost" aria-label="Edit" onClick={() => setEditing(true)}>
              <Pencil />
            </Button>
            {state === "confirmed" && (
              <Button size="icon-xs" variant="ghost" aria-label="Remove" onClick={() => run(() => rejectFactAction(fact.id), "rejected")}>
                <X />
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
