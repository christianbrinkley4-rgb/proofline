"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Check, LoaderCircle, Plus } from "lucide-react";
import {
  addExperienceAction,
  answerQuestionAction,
  skipQuestionAction,
  type ExperienceFormInput,
} from "@/app/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EvidenceTag } from "@/components/shared/evidence-tag";
import { AgentSays, Field, PillChoice, StepHint } from "./parts";
import type { ExperienceView, QuestionView } from "./types";

const KINDS = [
  { value: "work", label: "Job" },
  { value: "internship", label: "Internship" },
  { value: "leadership", label: "Club or team" },
  { value: "project", label: "Project" },
  { value: "volunteer", label: "Volunteer" },
  { value: "research", label: "Research" },
] as const;

const EMPTY: ExperienceFormInput = { kind: "work", org: "", title: "", location: "", startDate: "", endDate: "", notes: "" };

export function ExperienceStep({
  experiences,
  onBack,
  onContinue,
}: {
  experiences: ExperienceView[];
  onBack: () => void;
  onContinue: () => void;
}) {
  const [adding, setAdding] = useState(experiences.length === 0);
  const openQuestions = experiences.flatMap((e) => e.questions.map((q) => ({ ...q, org: e.org })));

  return (
    <div>
      <AgentSays>
        {experiences.length === 0
          ? "What have you done? Paid work, helping family, projects, training, and volunteering all count. Write it the way you'd explain it to a friend."
          : "Anything else I should know about? Work, projects, responsibilities, and things you've learned all count."}
      </AgentSays>
      <StepHint>
        Don&apos;t worry about sounding professional. I&apos;ll ask for the numbers that make it strong, and I&apos;ll never make one up.
      </StepHint>

      <div className="mt-8 space-y-6 sm:pl-11">
        {openQuestions.length > 0 && (
          <section aria-label="Questions from your agent" className="space-y-3">
            {openQuestions.slice(0, 3).map((q) => (
              <QuestionCard key={q.id} question={q} org={q.org} />
            ))}
            {openQuestions.length > 3 && (
              <p className="text-[12.5px] text-subtle-foreground">{openQuestions.length - 3} more saved for later on your profile.</p>
            )}
          </section>
        )}

        {experiences.length > 0 && (
          <ul className="divide-y rounded-xl border bg-background">
            {experiences.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium">{e.org}</div>
                  <div className="truncate text-[12.5px] text-muted-foreground">{[e.title, e.dates].filter(Boolean).join(" · ")}</div>
                </div>
                <span className="shrink-0 text-[12px] text-subtle-foreground tabular-nums">
                  {e.facts.filter((f) => f.state === "confirmed").length} facts
                </span>
              </li>
            ))}
          </ul>
        )}

        {adding ? (
          <ExperienceForm onDone={() => setAdding(false)} onCancel={experiences.length ? () => setAdding(false) : undefined} />
        ) : (
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus data-icon="inline-start" />
            Add another
          </Button>
        )}

        <div className="flex items-center gap-3 border-t pt-6">
          <Button size="xl" onClick={onContinue}>
            {experiences.length === 0 ? "Continue for now" : "That's everything for now"}
            <ArrowRight data-icon="inline-end" />
          </Button>
          <button type="button" onClick={onBack} className="-my-2 py-2 text-[13.5px] text-muted-foreground hover:text-foreground">
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

function ExperienceForm({ onDone, onCancel }: { onDone: () => void; onCancel?: () => void }) {
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof ExperienceFormInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));
  // A couple of words ("cashier. stocking.") saves, but can only become a one-word bullet.
  const noteLength = values.notes.trim().length;
  const thin = noteLength > 0 && noteLength < 60;

  return (
    <form
      className="space-y-5 rounded-xl border bg-background p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await addExperienceAction(values).catch(() => ({ ok: false as const, error: "Couldn't save. Check your connection and try again." }));
          if (!result.ok) return setError(result.error);
          setValues(EMPTY);
          setError(null);
          onDone();
        });
      }}
    >
      <PillChoice label="Kind of experience" options={KINDS} value={[values.kind]} onChange={(v) => v[0] && setValues((s) => ({ ...s, kind: v[0] }))} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Where" htmlFor="org">
          <Input id="org" value={values.org} onChange={set("org")} placeholder="Employer, household, group, or project" required className="h-10" />
        </Field>
        <Field label="Your role" htmlFor="title">
          <Input id="title" value={values.title} onChange={set("title")} placeholder="Bookkeeping assistant" className="h-10" />
        </Field>
        <Field label="Started" htmlFor="startDate">
          <Input id="startDate" type="month" value={values.startDate} onChange={set("startDate")} className="h-10" />
        </Field>
        <Field label="Ended" htmlFor="endDate" hint="Leave blank if you're still there.">
          <Input id="endDate" type="month" value={values.endDate} onChange={set("endDate")} className="h-10" />
        </Field>
      </div>
      <Field label="What did you do there?" htmlFor="notes" hint="A few sentences is plenty. Rough is fine.">
        <Textarea
          id="notes"
          rows={5}
          value={values.notes}
          onChange={set("notes")}
          aria-describedby={thin ? "notes-thin" : undefined}
          placeholder="I did the books part-time for a dental office. Mostly paying vendors in QuickBooks and matching statements. Found some double payments once."
          className="text-[14px] leading-6"
        />
      </Field>
      {thin && (
        <p id="notes-thin" className="-mt-3 text-[12.5px] leading-5 text-pending-ink">
          A little more helps: what you did, how often, and who it helped. I can only write bullets from what you tell me, so a few words become a thin resume line.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <LoaderCircle className="animate-spin" />}
          Save
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export function QuestionCard({ question, org }: { question: QuestionView; org?: string }) {
  const [answer, setAnswer] = useState(question.proposedValue ?? "");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<"saved" | "skipped" | null>(null);
  const [error, setError] = useState("");
  function respond(value: string) {
    setError("");
    startTransition(async () => {
      try {
        const status = await answerQuestionAction(question.id, value);
        setDone(status === "dismissed" ? "skipped" : "saved");
      } catch {
        setError("Couldn't save your answer. Please try again.");
      }
    });
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-background px-4 py-3 text-[13.5px] text-muted-foreground motion-safe:animate-view-in">
        <Check className="size-4 text-brand" strokeWidth={2.5} />
        {done === "skipped" ? "Skipped." : "Got it. Response recorded."}
      </div>
    );
  }

  return (
    <form
      className="rounded-lg border border-pending/40 bg-pending-soft/60 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!answer.trim()) return;
        respond(answer);

      }}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <EvidenceTag kind="question">Question, optional</EvidenceTag>
        {org && <span className="text-[12px] font-medium text-pending-ink">{org}</span>}
      </div>
      <p className="mt-1.5 text-[14.5px] leading-6">{question.prompt}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {question.kind === "yes_no" ? (
          <>
            <Button type="button" size="sm" onClick={() => respond("yes")}>
              Yes
            </Button>
            <Button type="button" size="sm" variant="outline" className="bg-background" onClick={() => respond("no")}>
              No
            </Button>
          </>
        ) : (
          <>
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              inputMode={question.kind === "number" ? "numeric" : "text"}
              aria-label={question.prompt}
              placeholder={question.kind === "number" ? "A number" : "Your answer"}
              className="h-9 min-w-0 flex-1 bg-background"
            />
            <Button type="submit" size="sm" className="h-9" disabled={pending || !answer.trim()}>
              Save
            </Button>
          </>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9"
          disabled={pending}
          onClick={() => startTransition(async () => { try { await skipQuestionAction(question.id); setDone("skipped"); } catch { setError("Couldn't skip this question. Please try again."); } })}
        >
          Skip
        </Button>
      </div>
      <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
        Your answer is saved as a fact in your own words. Not sure? Skip it rather than guess.
      </p>
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </form>
  );
}
