"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, CircleSlash, LoaderCircle, Undo2 } from "lucide-react";
import { answerGapAction, declineGapAction, reopenGapAction, type GapResult } from "@/app/app/jobs/[id]/gap-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MicButton } from "@/components/voice/mic-button";
import { inSentence, type Gap, type GapKind } from "@/lib/fit/gaps";
import { cn } from "@/lib/utils";

type Experience = { id: string; org: string; title: string | null };
type Done = Extract<GapResult, { ok: true }> & { skill: string };

const KIND_LABEL: Record<GapKind, string> = { required: "Required", preferred: "Nice to have", keyword: "In the posting" };
const NEW_KINDS = [
  ["project", "Class or personal project"],
  ["work", "Job"],
  ["internship", "Internship"],
  ["leadership", "Club or leadership"],
  ["volunteer", "Volunteering"],
  ["research", "Research"],
] as const;

/**
 * Closes the gap between a posting and a resume, one question at a time. Answers
 * become the student's own confirmed facts and new bullets; nothing is invented.
 */
export function GapCoach({
  jobId,
  gaps,
  declined,
  experiences,
  advice,
  onAnswered,
}: {
  jobId: string;
  gaps: Gap[];
  /** Skills in this posting the student marked "not yet". */
  declined: string[];
  experiences: Experience[];
  /** Gaps a sentence can't close. */
  advice: string[];
  onAnswered?: () => void;
}) {
  const [done, setDone] = useState<Done[]>([]);
  const open = gaps.filter((g) => !done.some((d) => d.skill === g.skill));

  return (
    <div className="space-y-3">
      {done.map((d) => (
        <div key={d.skill} className="rounded-xl border border-brand/30 bg-brand-soft/60 p-4 motion-safe:animate-view-in">
          <p className="flex items-center gap-2 text-[14px] font-medium">
            <Check className="size-4 text-brand-ink" strokeWidth={3} />
            Added {inSentence(d.skill)} from {d.org}.
            {d.after !== d.before && (
              <span className="text-brand-ink tabular-nums">
                Fit {d.before} → {d.after}
              </span>
            )}
          </p>
          {d.bullets.length > 0 && (
            <ul className="mt-2 space-y-1 pl-6 text-[13px] leading-5">
              {d.bullets.map((b) => (
                <li key={b.text} className="list-disc">
                  {b.text}
                  {!b.ready && <span className="ml-1 text-pending-ink">(needs your OK on Profile)</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      {open.map((gap, i) => (
        <GapCard
          key={gap.id}
          jobId={jobId}
          gap={gap}
          experiences={experiences}
          defaultOpen={i === 0 && done.length === 0}
          onDone={(result) => {
            setDone((d) => [...d, { ...result, skill: gap.skill }]);
            onAnswered?.();
          }}
        />
      ))}

      {open.length === 0 && done.length === 0 && (
        <p className="rounded-xl border border-dashed p-4 text-[13.5px] text-muted-foreground">
          Your confirmed facts already cover every skill this posting names.
        </p>
      )}

      {declined.length > 0 && <Declined jobId={jobId} skills={declined} />}

      {advice.length > 0 && (
        <div className="rounded-xl bg-muted/50 p-4">
          <p className="text-[12.5px] font-medium text-muted-foreground">Can&apos;t be fixed with a sentence</p>
          <ul className="mt-1.5 space-y-1 text-[13px] leading-5 text-muted-foreground">
            {advice.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function GapCard({ jobId, gap, experiences, defaultOpen, onDone }: { jobId: string; gap: Gap; experiences: Experience[]; defaultOpen: boolean; onDone: (r: Extract<GapResult, { ok: true }>) => void }) {
  const router = useRouter();
  const [answering, setAnswering] = useState(defaultOpen);
  const [where, setWhere] = useState(experiences[0]?.id ?? "new");
  const [org, setOrg] = useState("");
  const [kind, setKind] = useState<(typeof NEW_KINDS)[number][0]>("project");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      setError("");
      const result = await answerGapAction({
        jobId,
        skill: gap.skill,
        experienceId: where === "new" ? null : where,
        newPlace: where === "new" ? { org, kind } : null,
        text,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onDone(result);
      router.refresh();
    });

  return (
    <div className={cn("rounded-xl border bg-background p-4 transition-colors", answering && "border-border-strong")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              "inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium",
              gap.kind === "required" ? "bg-pending-soft text-pending-ink" : "bg-muted text-muted-foreground",
            )}
          >
            {KIND_LABEL[gap.kind]}
          </span>
          <p className="mt-1.5 text-[15px] font-medium">{gap.question}</p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{gap.why}</p>
        </div>
        {!answering && (
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setAnswering(true)}>
              I&apos;ve done this
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await declineGapAction({ jobId, skill: gap.skill });
                  router.refresh();
                })
              }
            >
              Not yet
            </Button>
          </div>
        )}
      </div>

      {answering && (
        <form
          className="mt-4 grid gap-3 motion-safe:animate-view-in"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-[12.5px]">
              <span>Where?</span>
              <select value={where} onChange={(e) => setWhere(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-[13.5px]">
                {experiences.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title ? `${x.title}, ${x.org}` : x.org}
                  </option>
                ))}
                <option value="new">Somewhere else (a class, project, or club)</option>
              </select>
            </label>
            {where === "new" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1.5 text-[12.5px]">
                  <span>Name</span>
                  <Input value={org} onChange={(e) => setOrg(e.target.value)} maxLength={160} placeholder="ACCT 310, Finance Club" required />
                </label>
                <label className="space-y-1.5 text-[12.5px]">
                  <span>Kind</span>
                  <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="h-9 w-full rounded-md border bg-background px-2 text-[13.5px]">
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
            <span>What did you do with {gap.skill.split(/\s+or\s+/i)[0]}? A number helps if you remember one.</span>
            <div className="flex gap-2">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Posted weekly journal entries for 12 vendor accounts during month-end close"
                className="text-[14px] leading-6"
              />
              <MicButton size="md" label="Say it instead" onText={(t) => setText((x) => (x ? `${x} ${t}` : t))} />
            </div>
          </label>
          {error && (
            <p role="alert" className="text-[12.5px] text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending || text.trim().length < 15 || (where === "new" && !org.trim())}>
              {pending ? <LoaderCircle className="animate-spin" /> : null}
              Add it to my resume
              {!pending && <ArrowRight data-icon="inline-end" />}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAnswering(false)}>
              Cancel
            </Button>
            <span className="text-[12px] text-muted-foreground">Saved as your own words. Only what you write here is used.</span>
          </div>
        </form>
      )}
    </div>
  );
}

function Declined({ jobId, skills }: { jobId: string; skills: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted-foreground">
      <CircleSlash className="size-3.5" />
      <span>Not yet:</span>
      {skills.map((s) => (
        <button
          key={s}
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await reopenGapAction({ jobId, skill: s });
              router.refresh();
            })
          }
          className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 hover:bg-muted"
          title="Changed your mind? Ask me again."
        >
          {s}
          <Undo2 className="size-3" />
        </button>
      ))}
      <span className="w-full pl-5 text-[12px] text-subtle-foreground sm:w-auto sm:pl-0">
        Practice these before claiming them. A short course or class project can become real evidence later.
      </span>
    </div>
  );
}
