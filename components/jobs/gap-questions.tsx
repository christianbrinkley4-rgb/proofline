"use client";

import { useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, CircleSlash, Clock, LoaderCircle, Undo2 } from "lucide-react";
import { declineGapAction, reopenGapAction } from "@/app/app/jobs/[id]/gap-actions";
import { answerGapQuestionAction } from "@/app/app/jobs/[id]/tailor-actions";
import { ConfirmBox } from "@/components/facts/confirm-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { earnPath, type EarnPath } from "@/lib/fit/earn";
import { inSentence, skillFromAnswer } from "@/lib/fit/gaps";
import { cn } from "@/lib/utils";

export type GapQuestion = { id: string; skill: string; kind: "required" | "listed" | "preferred" | "keyword" };
type Place = { id: string; name: string };

const KIND_LABEL: Record<GapQuestion["kind"], string> = { required: "Required", listed: "In the duties", preferred: "Nice to have", keyword: "Posting keyword" };
const NEW_KINDS = [
  ["project", "Class or personal project"],
  ["work", "Job"],
  ["internship", "Internship"],
  ["leadership", "Club or leadership"],
  ["volunteer", "Volunteering"],
] as const;

/**
 * "The posting asks for X. Have you done anything like it?" A confirmed answer
 * becomes a fact in the person's words and the resume rebuilds. "Not yet"
 * dismisses it, and it isn't asked again.
 */
export function GapQuestions({ jobId, gaps, declined, places }: { jobId: string; gaps: GapQuestion[]; declined: string[]; places: Place[] }) {
  if (!gaps.length && !declined.length) {
    return <p className="rounded-xl border border-dashed p-4 text-[13.5px] text-muted-foreground">What you&apos;ve confirmed already covers what this posting names. Nothing to ask.</p>;
  }
  return (
    <div className="space-y-3">
      {gaps.map((gap, i) => (
        <GapCard key={gap.id} jobId={jobId} gap={gap} places={places} defaultOpen={i === 0} />
      ))}
      {declined.length > 0 && <Declined jobId={jobId} skills={declined} />}
      <EarnPaths jobId={jobId} skills={declined} />
    </div>
  );
}

function GapCard({ jobId, gap, places, defaultOpen }: { jobId: string; gap: GapQuestion; places: Place[]; defaultOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [where, setWhere] = useState(places[0]?.id ?? "new");
  const [org, setOrg] = useState("");
  const [kind, setKind] = useState<(typeof NEW_KINDS)[number][0]>("project");
  const [text, setText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const hintId = useId();
  const name = gap.skill.split(/\s+or\s+/i)[0];
  const unnamed = text.trim().length >= 15 && !skillFromAnswer(gap.skill, text);

  const save = () =>
    start(async () => {
      setError("");
      const result = await answerGapQuestionAction({
        jobId,
        skill: gap.skill,
        experienceId: where === "new" ? null : where,
        newPlace: where === "new" ? { org, kind } : null,
        text,
        confirmed: confirmed as true,
      }).catch(() => ({ ok: false as const, error: "Couldn't save your answer. Your words are still here; try again." }));
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        requestAnimationFrame(() => {
          errorRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
          errorRef.current?.focus();
        });
        return;
      }
      router.refresh();
    });

  return (
    <div className={cn("rounded-xl border bg-background p-4", open && "border-border-strong")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className={cn("inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium", gap.kind === "required" ? "bg-pending-soft text-pending-ink" : "bg-muted text-muted-foreground")}>{KIND_LABEL[gap.kind]}</span>
          <p className="mt-1.5 text-[15px] font-medium">
            {`The posting asks for ${inSentence(gap.skill)}. Have you done anything like it?`}
          </p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">If you have, say where and what you did. Your words go on a resume only when you confirm them.</p>
        </div>
        {!open && (
          <div className="flex shrink-0 gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              Yes, I have
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await declineGapAction({ jobId, skill: gap.skill }).catch(() => null);
                  router.refresh();
                })
              }
            >
              Not yet
            </Button>
          </div>
        )}
      </div>

      {open && (
        <form
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-[12.5px]">
              <span>Where?</span>
              <select value={where} onChange={(e) => setWhere(e.target.value)} className="h-10 w-full rounded-md border bg-background px-2 text-[14px]">
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value="new">Somewhere else</option>
              </select>
            </label>
            {where === "new" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1.5 text-[12.5px]">
                  <span>Name</span>
                  <Input value={org} onChange={(e) => setOrg(e.target.value)} maxLength={160} placeholder="Employer, class, or club" className="h-10" />
                </label>
                <label className="space-y-1.5 text-[12.5px]">
                  <span>Kind</span>
                  <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="h-10 w-full rounded-md border bg-background px-2 text-[14px]">
                    {NEW_KINDS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
          <label className="space-y-1.5 text-[12.5px]">
            <span>{`What did you do with ${inSentence(name)}? Write it as one resume line. A number helps if you remember one.`}</span>
            <span id={hintId} className="block text-muted-foreground">{`Name ${inSentence(name)} in your answer if that is what you used. If you have not used it, choose Not yet.`}</span>
            <Textarea aria-describedby={hintId} aria-invalid={unnamed || undefined} value={text} onChange={(e) => { setText(e.target.value); setConfirmed(false); }} rows={2} maxLength={400} placeholder={`Used ${name} to ...`} className="text-[14px] leading-6" />
          </label>
          {unnamed && <p className="text-[12px] text-pending-ink">{`Name ${inSentence(name)} in your line before rebuilding. If you have not used it, choose Not yet instead.`}</p>}
          <ConfirmBox checked={confirmed} onChange={setConfirmed} />
          {error && (
            <p ref={errorRef} tabIndex={-1} role="alert" className="text-[12.5px] text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || unnamed || !confirmed || text.trim().length < 15 || (where === "new" && !org.trim())}>
              {pending ? <LoaderCircle className="animate-spin" /> : null}
              {pending ? "Saving and rebuilding" : "Confirm and rebuild my resume"}
              {!pending && <ArrowRight data-icon="inline-end" />}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => start(async () => {
              await declineGapAction({ jobId, skill: gap.skill });
              router.refresh();
            })}>Not yet</Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Declined({ jobId, skills }: { jobId: string; skills: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
      <CircleSlash className="size-3.5" />
      <span>Not yet, so not asked again:</span>
      {skills.map((s) => (
        <button
          key={s}
          type="button"
          disabled={pending}
          title="Changed your mind? Ask me again."
          onClick={() =>
            start(async () => {
              await reopenGapAction({ jobId, skill: s });
              router.refresh();
            })
          }
          className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 hover:bg-muted"
        >
          {s}
          <Undo2 className="size-3" />
        </button>
      ))}
    </div>
  );
}

/**
 * For each "Not yet" that a small project can honestly earn: what to build, how
 * long it takes, and a free resource. Doing it and answering the question is how
 * it reaches the resume; nothing here is claimed for the person.
 */
function EarnPaths({ jobId, skills }: { jobId: string; skills: string[] }) {
  // One card per skill: "Excel" and "Excel (pivot tables)" declined separately share a path.
  const bySkill = new Map<string, { declined: string; path: EarnPath }>();
  for (const declined of skills) {
    const path = earnPath(declined);
    if (path && !bySkill.has(path.skill)) bySkill.set(path.skill, { declined, path });
  }
  const paths = [...bySkill.values()];
  if (!paths.length) return null;
  return (
    <section className="rounded-xl border bg-muted/30 p-4">
      <h3 className="text-[14px] font-semibold">Ways to earn what&apos;s missing</h3>
      <p className="mt-0.5 text-[12.5px] leading-5 text-muted-foreground">
        Each one ends in something real you can describe. When you&apos;ve done it, tell me about it and it can go on your resume.
      </p>
      <ul className="mt-3 space-y-2.5">
        {paths.map(({ declined, path }) => (
          <EarnCard key={path.skill} jobId={jobId} declined={declined} path={path} />
        ))}
      </ul>
    </section>
  );
}

function EarnCard({ jobId, declined, path }: { jobId: string; declined: string; path: EarnPath }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <li className="rounded-lg border bg-background p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[13.5px] font-medium">{path.skill}</p>
        <span className="inline-flex items-center gap-1 text-[12px] text-subtle-foreground">
          <Clock className="size-3" aria-hidden="true" />
          {path.time}
        </span>
      </div>
      <p className="mt-1 text-[13px] leading-5">{path.project}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        {path.resource && (
          <a href={path.resource.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-medium underline-offset-2 hover:underline">
            Free: {path.resource.name}
            <ArrowUpRight className="size-3" aria-hidden="true" />
          </a>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await reopenGapAction({ jobId, skill: declined });
              router.refresh();
            })
          }
        >
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          I did it, ask me again
        </Button>
      </div>
    </li>
  );
}
