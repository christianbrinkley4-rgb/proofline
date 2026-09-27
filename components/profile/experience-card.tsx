"use client";

import { useState, useTransition } from "react";
import { ChevronDown, LoaderCircle, Plus, Sparkle } from "lucide-react";
import { toast } from "sonner";
import { addFactAction, generateBulletsAction } from "@/app/app/profile/actions";
import { FactRow } from "@/components/onboarding/fact-row";
import type { FactView } from "@/components/onboarding/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EvidenceTag } from "@/components/shared/evidence-tag";
import { cn } from "@/lib/utils";
import { BulletRow, type BulletView } from "./bullet-row";
import { BulletDeck } from "./bullet-deck";
import { ExperienceEdit, type EditableExperience } from "./experience-edit";

export type ExperienceCardData = {
  id: string;
  kind: EditableExperience["kind"];
  org: string;
  title: string | null;
  dates: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  facts: FactView[];
  bullets: BulletView[];
};

const KIND_LABEL: Record<string, string> = {
  work: "Job",
  internship: "Internship",
  leadership: "Leadership",
  project: "Project",
  volunteer: "Volunteer",
  research: "Research",
  education: "Education",
};

export function ExperienceCard({ experience }: { experience: ExperienceCardData }) {
  const [showFacts, setShowFacts] = useState(experience.bullets.length === 0);
  const [pending, startTransition] = useTransition();
  const [newFact, setNewFact] = useState("");
  const confirmed = experience.facts.filter((f) => f.state === "confirmed").length;
  const waiting = experience.facts.filter((f) => f.state === "unconfirmed" || f.state === "needs_review").length;

  const write = () =>
    startTransition(async () => {
      const r = await generateBulletsAction(experience.id);
      if (r.created + r.held === 0) {
        toast("Nothing new to write yet. Tell me more about this one, or answer the questions above.");
      } else {
        toast(
          `${r.created} ${r.created === 1 ? "bullet" : "bullets"} ready${r.held ? `, ${r.held} waiting on your OK` : ""}.` +
            (r.method === "rules" ? " Drafted from your own words; edit them to make them yours." : ""),
        );
      }
    });

  return (
    <article className="rounded-xl border bg-background">
      <header className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[16px] font-semibold tracking-tight">{experience.org}</h3>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{KIND_LABEL[experience.kind] ?? experience.kind}</span>
            <ExperienceEdit
              experience={{
                id: experience.id,
                kind: experience.kind,
                org: experience.org,
                title: experience.title ?? "",
                location: experience.location ?? "",
                startDate: experience.startDate ?? "",
                endDate: experience.endDate ?? "",
              }}
            />
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {[experience.title, experience.location, experience.dates].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BulletDeck experienceId={experience.id} />
          <Button size="sm" variant={experience.bullets.length ? "outline" : "default"} onClick={write} disabled={pending || confirmed === 0}>
            {pending ? <LoaderCircle className="animate-spin" /> : <Sparkle data-icon="inline-start" />}
            {experience.bullets.length ? "Write more bullets" : "Write bullets"}
          </Button>
        </div>
      </header>

      {experience.bullets.length > 0 ? (
        <section aria-label={`Resume lines for ${experience.org}`} className="px-4 pb-4 sm:px-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <EvidenceTag kind="resume">Resume lines ({experience.bullets.length})</EvidenceTag>
            <span className="text-[12px] text-muted-foreground">Finished wording, built from the confirmed facts below.</span>
          </div>
          <ul className="space-y-2">
            {experience.bullets.map((b) => (
              <BulletRow key={b.id} bullet={b} />
            ))}
          </ul>
        </section>
      ) : (
        confirmed > 0 && (
          <p className="px-4 pb-4 text-[13px] leading-5 text-muted-foreground sm:px-5">
            No resume lines yet. <span className="text-foreground">Write bullets</span> turns the confirmed facts below into lines you can edit. This role
            stays off your resume until it has one.
          </p>
        )
      )}

      <div className="border-t">
        <button
          type="button"
          aria-expanded={showFacts}
          onClick={() => setShowFacts((s) => !s)}
          className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left text-[13px] text-muted-foreground hover:text-foreground sm:px-5"
        >
          <span className="flex flex-wrap items-center gap-2">
            <EvidenceTag kind="confirmed">Confirmed facts ({confirmed})</EvidenceTag>
            {waiting > 0 && <span className="text-pending-ink">{waiting} waiting on your yes</span>}
            <span className="hidden sm:inline">What you told me. Only these can become resume lines.</span>
          </span>
          <ChevronDown className={cn("size-4 transition-transform", showFacts && "rotate-180")} />
        </button>
        {showFacts && (
          <div className="space-y-2 px-4 pb-4 sm:px-5">
            {experience.facts.length > 0 && (
              <ul className="space-y-2">
                {experience.facts.map((f) => (
                  <FactRow key={f.id} fact={f} />
                ))}
              </ul>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const content = newFact;
                setNewFact("");
                startTransition(async () => {
                  const r = await addFactAction({ content, experienceId: experience.id, category: /\d/.test(content) ? "metric" : "experience" });
                  if (!r.ok) toast(r.error);
                });
              }}
            >
              <Input
                value={newFact}
                onChange={(e) => setNewFact(e.target.value)}
                placeholder="Add something you did or achieved here"
                aria-label={`Add a fact about ${experience.org}`}
                className="h-9"
              />
              <Button type="submit" size="sm" variant="outline" className="h-9" disabled={newFact.trim().length < 3}>
                <Plus data-icon="inline-start" />
                Add
              </Button>
            </form>
          </div>
        )}
      </div>
    </article>
  );
}
