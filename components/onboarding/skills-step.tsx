"use client";

import { useState, useTransition } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { saveSkillsAction } from "@/app/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { AgentSays, ChipInput, StepHint } from "./parts";
import { suggestedSkillsFor } from "@/lib/fit/suggested-skills";
import type { ExperienceView, FactView } from "./types";

export function SkillsStep({ skills, experiences, onBack, onSaved }: { skills: FactView[]; experiences: ExperienceView[]; onBack: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(skills.filter((s) => s.state !== "rejected").map((s) => s.content));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fromResume = skills.some((s) => s.source === "resume_parsed" && s.state !== "confirmed");

  const save = () =>
    startTransition(async () => {
      setError(null);
      try {
        await saveSkillsAction(value);
        onSaved();
      } catch {
        setError("Couldn't save your skills. Check your connection and try again.");
      }
    });

  return (
    <div>
      {/* Goals come next, so this isn't the last step. */}
      <AgentSays>Almost done. What tools and skills can you actually use on day one?</AgentSays>
      <StepHint>
        {fromResume
          ? "I pulled these from your resume. Remove anything you couldn't use in an interview tomorrow."
          : "Software, languages, certifications. Only list what you could show someone."}
      </StepHint>
      <div className="mt-8 space-y-6 sm:pl-11">
        <ChipInput value={value} onChange={setValue} suggestions={suggestedSkillsFor(experiences)} placeholder="Type a skill and press Enter" ariaLabel="Add a skill" />
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button size="xl" disabled={pending} onClick={save}>
            {pending && <LoaderCircle className="animate-spin" />}
            Continue
            {!pending && <ArrowRight data-icon="inline-end" />}
          </Button>
          <button type="button" onClick={onBack} className="-my-2 py-2 text-[13.5px] text-muted-foreground hover:text-foreground">
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
