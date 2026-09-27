"use client";

import { useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { confirmFactsAction } from "@/app/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { FactRow } from "./fact-row";
import { AgentSays, StepHint } from "./parts";
import type { ExperienceView, FactView } from "./types";

export function ReviewStep({
  experiences,
  looseFacts,
  onContinue,
}: {
  experiences: ExperienceView[];
  looseFacts: FactView[];
  onContinue: () => void;
}) {
  const withFacts = experiences.filter((e) => e.facts.some((f) => f.state !== "rejected"));
  const waiting = [...experiences.flatMap((e) => e.facts), ...looseFacts].filter((f) => f.state === "unconfirmed" || f.state === "needs_review").length;

  return (
    <div>
      <AgentSays>Here&apos;s what I found. Is each of these true?</AgentSays>
      <StepHint>
        Say yes to what&apos;s accurate, no to what isn&apos;t, and fix anything that&apos;s close. Only confirmed lines can go on a
        resume. {waiting > 0 ? `${waiting} waiting on you.` : "All set."}
      </StepHint>

      <div className="mt-8 space-y-6 sm:pl-11">
        {withFacts.map((exp) => (
          <ExperienceGroup key={exp.id} experience={exp} />
        ))}
        {looseFacts.some((f) => f.state !== "rejected") && (
          <section>
            <h3 className="text-[14px] font-semibold">Education and honors</h3>
            <ul className="mt-2 space-y-2">
              {looseFacts.map((f) => (
                <FactRow key={f.id} fact={f} />
              ))}
            </ul>
          </section>
        )}
        <Button size="xl" onClick={onContinue}>
          {waiting > 0 ? "Continue, I'll finish the rest later" : "Continue"}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}

function ExperienceGroup({ experience }: { experience: ExperienceView }) {
  const [pending, startTransition] = useTransition();
  const unconfirmed = experience.facts.filter((f) => f.state === "unconfirmed" || f.state === "needs_review");
  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-semibold">{experience.org}</h3>
          <p className="truncate text-[12.5px] text-muted-foreground">
            {[experience.title, experience.dates].filter(Boolean).join(" · ")}
          </p>
        </div>
        {unconfirmed.length > 1 && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => startTransition(() => confirmFactsAction(unconfirmed.map((f) => f.id)))}
          >
            {unconfirmed.length === 2 ? "Both are right" : `All ${unconfirmed.length} are right`}
          </Button>
        )}
      </div>
      <ul className="mt-2 space-y-2">
        {experience.facts.map((f) => (
          <FactRow key={f.id} fact={f} />
        ))}
      </ul>
    </section>
  );
}
