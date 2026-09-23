"use client";

import { useState, useTransition } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { saveSkillsAction } from "@/app/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { AgentSays, ChipInput, StepHint } from "./parts";
import type { FactView } from "./types";

const SUGGESTED = ["Excel", "Google Sheets", "QuickBooks", "SQL", "Python", "Tableau", "Power BI", "PowerPoint", "Salesforce", "Spanish"] as const;

export function SkillsStep({ skills, onBack, onSaved }: { skills: FactView[]; onBack: () => void; onSaved: () => void }) {
  const [value, setValue] = useState(skills.filter((s) => s.state !== "rejected").map((s) => s.content));
  const [pending, startTransition] = useTransition();
  const fromResume = skills.some((s) => s.source === "resume_parsed" && s.state !== "confirmed");

  return (
    <div>
      <AgentSays>Last one. What tools and skills can you actually use on day one?</AgentSays>
      <StepHint>
        {fromResume
          ? "I pulled these from your resume. Remove anything you couldn't use in an interview tomorrow."
          : "Software, languages, certifications. Only list what you could show someone."}
      </StepHint>
      <div className="mt-8 space-y-6 sm:pl-11">
        <ChipInput value={value} onChange={setValue} suggestions={SUGGESTED} placeholder="Type a skill and press Enter" />
        <div className="flex items-center gap-3">
          <Button size="xl" disabled={pending} onClick={() => startTransition(async () => { await saveSkillsAction(value); onSaved(); })}>
            {pending && <LoaderCircle className="animate-spin" />}
            Finish setup
            {!pending && <ArrowRight data-icon="inline-end" />}
          </Button>
          <button type="button" onClick={onBack} className="text-[13.5px] text-muted-foreground hover:text-foreground">
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
