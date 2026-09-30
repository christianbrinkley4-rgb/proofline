"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";
import { answerSuggestionAction, nextSuggestionsAction, reviewSuggestionAction } from "@/app/app/profile/suggest-actions";
import { ConfirmBox } from "@/components/facts/confirm-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { composeRecallXyz, recallXyzDefaults } from "@/lib/resume/recall-xyz";

type Wording = Extract<Awaited<ReturnType<typeof reviewSuggestionAction>>, { ok: true }>;

type Suggestion = Awaited<ReturnType<typeof nextSuggestionsAction>>[number];

/**
 * One common task at a time for a role. "Yes, I did this" opens a short form in
 * the person's own words: only what they did is required; how much, how, and
 * what came of it are optional and never guessed. Save rereads the whole line
 * (AI when available), and nothing is saved until they tick that it's true.
 */
export function RoleRecall({ experienceId, name }: { experienceId: string; name: string }) {
  const router = useRouter();
  const [card, setCard] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [measure, setMeasure] = useState("");
  const [method, setMethod] = useState("");
  const [result, setResult] = useState("");
  const [wording, setWording] = useState<Wording | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [fallbackAvailable, setFallbackAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let active = true;
    nextSuggestionsAction(experienceId, 1, "recall").then((cards) => {
      if (active) { setCard(cards[0] ?? null); setLoading(false); }
    }).catch(() => {
      if (active) { setError("Couldn't load a task for this role. Try again."); setLoading(false); }
    });
    return () => { active = false; };
  }, [experienceId]);

  const next = async () => {
    const cards = await nextSuggestionsAction(experienceId, 1, "recall");
    setCard(cards[0] ?? null);
    setEditing(false); setText(""); setMeasure(""); setMethod(""); setResult(""); setConfirmed(false); setWording(null); setFallbackAvailable(false);
  };
  const reload = () => start(async () => {
    setError(null);
    try { await next(); } catch { setError("Couldn't load a task for this role. Try again."); }
  });
  const edited = (set: (value: string) => void) => (value: string) => { set(value); setConfirmed(false); setWording(null); setError(null); };

  const defaults = card ? card.xyzDefaults ?? recallXyzDefaults(card.text) : null;
  const needsResult = card?.slot === "what changed?";
  let preview = "";
  let previewError: string | null = null;
  try {
    if (defaults) preview = editing ? composeRecallXyz(text, { measure, method, result }, true) : composeRecallXyz(defaults.action, defaults, true);
  } catch (err) {
    previewError = err instanceof Error ? err.message : "Finish the line before saving it.";
  }
  const canSave = Boolean(text.trim()) && !previewError && measure.length <= 80 && (!needsResult || Boolean(result.trim()));

  const answer = (reply: "yes" | "no", mode: "model" | "rules" = "model") => {
    if (!card || pending) return;
    start(async () => {
      setError(null); setFallbackAvailable(false);
      try {
        let checked = wording;
        if (reply === "yes" && !checked) {
          const review = await reviewSuggestionAction(card.id, { editedText: text, xyz: { measure, method, result }, mode });
          if (!review.ok) { setError(review.error); setFallbackAvailable("fallbackAvailable" in review && review.fallbackAvailable === true); return; }
          checked = review;
          // A reworded line is shown for a fresh look before anything is saved.
          if (review.text !== preview || review.method === "rules") { setWording(review); setConfirmed(false); return; }
        }
        const response = await answerSuggestionAction(card.id, {
          answer: reply, reason: reply === "no" ? "not_true" : undefined,
          editedText: reply === "yes" ? text : undefined,
          reviewedText: reply === "yes" ? checked?.text : undefined,
          reviewId: reply === "yes" ? checked?.reviewId : undefined,
          xyz: reply === "yes" ? { measure, method, result } : undefined, confirmed: reply === "yes" ? confirmed : undefined,
        });
        if (!response.ok) { setError(response.error); return; }
        if (response.status === "accepted" && checked) { const line = checked.text; setSaved((lines) => [line, ...lines]); }
        // Refresh saved facts even if fetching the next task fails.
        router.refresh();
        await next();
      } catch { setError("Couldn't save this one. Your answers are still here. Try again."); }
    });
  };

  const startEditing = () => {
    if (!defaults) return;
    // The task's own method stays in "What you did" so the person edits one sentence, not fragments.
    setText([defaults.action, defaults.method].filter(Boolean).join(" "));
    setMeasure(defaults.measure); setMethod(""); setResult(defaults.result);
    setConfirmed(false); setEditing(true);
  };

  return (
    <section aria-label={`Find more lines for ${name}`} className="mt-3 rounded-lg border border-brand/25 bg-brand-soft/30 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[14px] font-semibold">{paused ? "Paused" : !editing ? "Did you do this?" : wording ? "Check your line" : "Put it in your own words"}</h4>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setPaused((value) => !value)}>
          {paused ? "Keep going" : "Pause"}
        </Button>
      </div>
      {saved.length > 0 && (
        <div role="status" className="mt-2 rounded-md bg-background/70 px-3 py-2 text-[12.5px] leading-5">
          <p className="flex items-center gap-1.5 font-medium text-brand-ink"><Check className="size-3.5" /> Saved {saved.length} new {saved.length === 1 ? "line" : "lines"} to {name}</p>
          <p className="mt-0.5 text-muted-foreground">{saved[0]}</p>
        </div>
      )}
      {!paused && <>
        {!editing && !loading && card && <p className="mt-1 text-[13px] leading-5 text-muted-foreground">A task that&apos;s common in roles like this one. If you did it, you&apos;ll put it in your own words next.</p>}
        {error && <div role="alert" className="mt-3 space-y-2 text-[13px] text-destructive">
          <p>{error}</p>
          {editing ? <div className="flex flex-wrap gap-2">
            {fallbackAvailable && !wording && <Button type="button" size="sm" variant="outline" disabled={pending || !canSave} onClick={() => answer("yes", "rules")}>Check it without AI</Button>}
          </div> : <button type="button" className="underline" disabled={pending} onClick={reload}>Show the next task</button>}
        </div>}
        {loading ? <p role="status" className="mt-3 flex items-center gap-2 text-[13px]"><LoaderCircle className="size-4 animate-spin" /> Finding a task for this role...</p> : card ? <div key={card.id} className="mt-3 space-y-3">
          {!editing ? <>
            <div className="rounded-xl border bg-background p-4 shadow-sm">
              <p className="break-words text-[17px] font-medium leading-7 tracking-tight">{preview || previewError}</p>
              {needsResult && <p className="mt-2 text-[13px] text-muted-foreground">What came of it?</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={pending} onClick={startEditing}>Yes, I did this</Button>
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => answer("no")}>{pending && <LoaderCircle className="animate-spin" />} No, show another</Button>
            </div>
          </> : wording ? <>
            <div className="rounded-xl border bg-background p-4 shadow-sm">
              <p className="text-[12px] font-medium text-muted-foreground">{wording.method === "rules" ? "Your line, checked without AI" : "Here's your line, tightened up"}</p>
              <p className="mt-1 break-words text-[17px] font-medium leading-7 tracking-tight">{wording.text}</p>
              <p className="mt-2 text-[12px] leading-5 text-muted-foreground">{wording.method === "rules" ? "AI hasn't read this one. Read the whole line before you save it." : "Same facts as your answers, reworded to read well on a resume. Save it only if it still describes what you did."}</p>
            </div>
            <fieldset disabled={pending}><ConfirmBox checked={confirmed} onChange={setConfirmed} /></fieldset>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={pending || !confirmed} onClick={() => answer("yes")}>{pending && <LoaderCircle className="animate-spin" />} {pending ? "Saving..." : "Save this line"}</Button>
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => { setWording(null); setConfirmed(false); setError(null); }}>Change my answers</Button>
            </div>
          </> : <>
            <label className="block text-[13px] font-medium">What you did
              <span className="block text-[12px] font-normal text-muted-foreground">Change anything that isn&apos;t quite how it went.</span>
              <Textarea disabled={pending} className="mt-1.5 min-h-20 font-normal" value={text} maxLength={300} onChange={(event) => edited(setText)(event.target.value)} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[13px] font-medium">How much or how often <span className="font-normal text-muted-foreground">(optional)</span>
                <Input disabled={pending} className="mt-1.5 font-normal" value={measure} maxLength={80} placeholder="e.g. 40 clients a month" onChange={(event) => edited(setMeasure)(event.target.value)} />
              </label>
              <label className="block text-[13px] font-medium">How you did it <span className="font-normal text-muted-foreground">(optional)</span>
                <Input disabled={pending} className="mt-1.5 font-normal" value={method} maxLength={120} placeholder="e.g. using Salesforce" onChange={(event) => edited(setMethod)(event.target.value)} />
              </label>
            </div>
            <label className="block text-[13px] font-medium">What came of it {needsResult ? "" : <span className="font-normal text-muted-foreground">(optional)</span>}
              <Input disabled={pending} className="mt-1.5 font-normal" value={result} maxLength={100} placeholder="e.g. 12 more appointments a month" onChange={(event) => edited(setResult)(event.target.value)} />
            </label>
            <p className="text-[12px] leading-5 text-muted-foreground">A number makes a line stronger, but only add one you could explain in an interview. A line without one still counts.</p>
            <div className="rounded-xl border bg-background p-4">
              <p className="text-[12px] font-medium text-muted-foreground">Your line so far</p>
              <p className="mt-1 break-words text-[15px] leading-6">{preview || <span className="text-muted-foreground">Start with what you did.</span>}</p>
              {previewError && text.trim() && <p role="alert" className="mt-2 text-[12px] text-destructive">{previewError}</p>}
            </div>
            <fieldset disabled={pending}><ConfirmBox checked={confirmed} onChange={setConfirmed} /></fieldset>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={pending || !canSave || !confirmed} onClick={() => answer("yes")}>{pending && <LoaderCircle className="animate-spin" />} {pending ? "Checking the wording..." : "Save line"}</Button>
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => answer("no")}>Skip this one</Button>
            </div>
            <p className="text-[11.5px] leading-5 text-subtle-foreground">Saving has AI reread the line for grammar and flow. It keeps your facts and numbers and shows you any change first.</p>
          </>}
          <details className="text-[12px] leading-5 text-muted-foreground">
            <summary className="cursor-pointer font-medium">Why this task?</summary>
            {card.occupation ? <p className="mt-2">It&apos;s a common part of {card.occupation.toLowerCase()} work, and it&apos;s related to this role. It becomes a line only if you say you did it.</p> : <p className="mt-2">It&apos;s related to this role. It becomes a line only if you say you did it.</p>}
            {card.generator === "onet-31.0" && <p className="mt-2 text-[11px]">Adapted from the <a className="underline" href="https://www.onetcenter.org/database.html" target="_blank" rel="noreferrer">O*NET 31.0 Database</a>, USDOL/ETA, under <a className="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Proofline changed the wording; USDOL/ETA has not approved these changes.</p>}
          </details>
        </div> : <div className="mt-3 text-[13px] leading-5 text-muted-foreground"><p>That&apos;s every common task we have for this role. Add a line of your own below, or make the role title more specific so we can find related work.</p><Button type="button" size="sm" variant="outline" className="mt-2" disabled={pending} onClick={reload}>Check again</Button></div>}
      </>}
    </section>
  );
}
