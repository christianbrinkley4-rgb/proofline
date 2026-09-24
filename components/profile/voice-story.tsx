"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Mic, Sparkle, Square } from "lucide-react";
import { toast } from "sonner";
import { answerQuestionAction } from "@/app/app/onboarding/actions";
import { rewriteWithAnswersAction, speakExperienceAction, type ExperienceDrafts } from "@/app/app/profile/actions";
import { cleanDictationAction } from "@/app/app/voice-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MicButton } from "@/components/voice/mic-button";
import { useDictation } from "@/components/voice/use-dictation";
import { cleanTranscript, guessDetails } from "@/lib/voice/transcript";
import { cn } from "@/lib/utils";

const KINDS = [
  ["work", "Job"],
  ["internship", "Internship"],
  ["leadership", "Leadership"],
  ["project", "Project"],
  ["volunteer", "Volunteering"],
  ["research", "Research"],
] as const;
type Kind = (typeof KINDS)[number][0];

/**
 * Talk about something you did; get resume bullets. What you say becomes confirmed
 * facts (your words), bullets follow X-Y-Z, and every missing number comes back as
 * a question you can answer out loud.
 */
export function VoiceStory() {
  const router = useRouter();
  const dictation = useDictation();
  const [text, setText] = useState("");
  const [org, setOrg] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind>("work");
  const [kindEdited, setKindEdited] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState<ExperienceDrafts | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const applyGuesses = (said: string) => {
    const g = guessDetails(said);
    if (!org && g.org) setOrg(g.org);
    if (!title && g.title) setTitle(g.title);
    if (!kindEdited) setKind(g.kind);
  };

  const stop = async () => {
    const said = dictation.stop();
    if (!said.length) return;
    setCleaning(true);
    const cleaned = await cleanDictationAction(said).then((r) => r.text).catch(() => cleanTranscript(said));
    setCleaning(false);
    const next = text ? `${text}\n\n${cleaned}` : cleaned;
    setText(next);
    applyGuesses(next);
  };

  const heard = [...dictation.segments, dictation.interim].filter(Boolean).join(" ");

  if (result) {
    const remaining = result.questions;
    return (
      <section className="mt-8 rounded-xl border bg-background p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Sparkle className="size-4 text-brand" />
          <h2 className="text-[17px] font-semibold tracking-tight">Your bullets for {org}</h2>
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">Action verb first, then the result, the number, and how you did it. Built only from what you said.</p>
        <ul className="mt-4 space-y-2">
          {result.bullets.map((b) => (
            <li key={b.id} className="flex items-start gap-3 rounded-lg border p-3 text-[13.5px] leading-6">
              <span className={cn("mt-0.5 rounded px-1.5 text-[11px] font-medium tabular-nums", (b.score ?? 0) >= 80 ? "bg-brand-soft text-brand-ink" : "bg-muted text-muted-foreground")}>
                {b.score ?? "--"}
              </span>
              <span className="flex-1">{b.text}</span>
              {!b.ready && <span className="text-[11.5px] text-pending-ink">Needs your OK</span>}
            </li>
          ))}
          {!result.bullets.length && <li className="text-[13px] text-muted-foreground">Nothing bullet-ready yet. Answer the questions below and I&apos;ll try again.</li>}
        </ul>

        {remaining.length > 0 && (
          <div className="mt-5 rounded-lg border border-pending/40 bg-pending-soft/50 p-4">
            <p className="text-[13.5px] font-medium">Numbers make these stronger. Answer what you can:</p>
            <ul className="mt-3 space-y-3">
              {remaining.map((q) => (
                <li key={q.id}>
                  <label htmlFor={`q-${q.id}`} className="text-[13px]">
                    {q.prompt}
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <Input
                      id={`q-${q.id}`}
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      placeholder="An estimate is fine, or skip"
                      className="bg-background"
                    />
                    <MicButton size="md" label="Answer out loud" onText={(t) => setAnswers((a) => ({ ...a, [q.id]: `${a[q.id] ? `${a[q.id]} ` : ""}${t.replace(/\.$/, "")}` }))} />
                  </div>
                </li>
              ))}
            </ul>
            <Button
              className="mt-4"
              disabled={pending || !remaining.some((q) => answers[q.id]?.trim())}
              onClick={() =>
                startTransition(async () => {
                  setError("");
                  try {
                    for (const q of remaining) {
                      const a = answers[q.id]?.trim();
                      if (!a) continue;
                      const status = await answerQuestionAction(q.id, a);
                      if (!status) throw new Error("One answer could not be saved. Refresh the page and try again.");
                    }
                    setResult(await rewriteWithAnswersAction(result.experienceId));
                    setAnswers({});
                    toast("Rewrote your bullets with your numbers.");
                    router.refresh();
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : "Could not rewrite the bullets. Try again.");
                  }
                })
              }
            >
              {pending ? <LoaderCircle className="animate-spin" /> : null}
              Rewrite with my numbers
            </Button>
            {error && <p role="alert" className="mt-2 text-[12.5px] text-destructive">{error}</p>}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setResult(null);
              setText("");
              setOrg("");
              setTitle("");
              setAnswers({});
              setKind("work");
              setKindEdited(false);
              setError("");
            }}
          >
            <Mic data-icon="inline-start" />
            Talk about something else
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-xl border bg-background p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="text-[17px] font-semibold tracking-tight">Talk it out</h2>
          <p className="mt-1 text-[13.5px] leading-6 text-muted-foreground">
            Tell me about a job, class, project, or something you&apos;re proud of, like you&apos;d tell a friend. Say what you did, how much or how often, and what changed. I&apos;ll turn it into resume bullets.
          </p>
        </div>
        {dictation.supported ? (
          <button
            type="button"
            onClick={() => (dictation.listening ? void stop() : dictation.start())}
            disabled={cleaning}
            aria-pressed={dictation.listening}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              dictation.listening ? "bg-destructive text-white" : "bg-foreground text-background hover:bg-foreground/85",
            )}
          >
            {cleaning ? <LoaderCircle className="size-4 animate-spin" /> : dictation.listening ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4" />}
            {cleaning ? "Cleaning up" : dictation.listening ? "Done talking" : text ? "Keep talking" : "Start talking"}
          </button>
        ) : (
          <p className="max-w-56 text-[12px] text-muted-foreground">Voice works in Chrome, Edge, and Safari. You can type below instead.</p>
        )}
      </div>

      {dictation.listening && (
        <div aria-live="polite" className="mt-4 rounded-lg border border-dashed p-3 text-[13.5px] leading-6 text-muted-foreground">
          <span className="mr-2 inline-block size-2 rounded-full bg-destructive motion-safe:animate-pulse" />
          {heard || "Listening..."}
        </div>
      )}
      {dictation.error && <p role="alert" className="mt-3 text-[12.5px] text-destructive">{dictation.error}</p>}

      {!dictation.listening && (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            startTransition(async () => {
              try {
                const r = await speakExperienceAction({ text, org, title, kind });
                if (!r.ok) {
                  setError(r.error);
                  return;
                }
                setResult(r);
                router.refresh();
              } catch {
                setError("Could not save this experience. Try again.");
              }
            });
          }}
        >
          <label className="space-y-1.5 text-[12.5px] sm:col-span-3">
            <span>What I heard (fix anything I got wrong)</span>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={() => applyGuesses(text)} rows={5} maxLength={8000} className="text-[14px] leading-6" />
          </label>
          <label className="space-y-1.5 text-[12.5px]">
            <span>Where was this?</span>
            <Input value={org} onChange={(e) => setOrg(e.target.value)} required maxLength={160} placeholder="Company, club, class, or project" />
          </label>
          <label className="space-y-1.5 text-[12.5px]">
            <span>Your role <span className="text-muted-foreground">(optional)</span></span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
          </label>
          <label className="space-y-1.5 text-[12.5px]">
            <span>Kind</span>
            <select value={kind} onChange={(e) => { setKind(e.target.value as Kind); setKindEdited(true); }} className="h-9 w-full rounded-md border bg-background px-2 text-[13.5px]">
              {KINDS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          {error && <p role="alert" className="text-[12.5px] text-destructive sm:col-span-3">{error}</p>}
          <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
            <Button type="submit" disabled={pending || text.trim().length < 20 || !org.trim()}>
              {pending ? <LoaderCircle className="animate-spin" /> : <Check data-icon="inline-start" />}
              Turn this into resume bullets
            </Button>
            <span className="text-[12px] text-muted-foreground">Saved to your profile as your own words. Numbers only come from you.</span>
          </div>
        </form>
      )}
    </section>
  );
}
