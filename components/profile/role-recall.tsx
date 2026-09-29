"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { answerSuggestionAction, nextSuggestionsAction, reviewSuggestionAction } from "@/app/app/profile/suggest-actions";
import { RecallMeasure } from "./recall-measure";
import { ConfirmBox } from "@/components/facts/confirm-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { composeRecallXyz, recallXyzDefaults } from "@/lib/resume/recall-xyz";

type Wording = Extract<Awaited<ReturnType<typeof reviewSuggestionAction>>, { ok: true }>;

type Suggestion = Awaited<ReturnType<typeof nextSuggestionsAction>>[number];

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
  const [saved, setSaved] = useState(0);
  const [fallbackAvailable, setFallbackAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let active = true;
    nextSuggestionsAction(experienceId, 1, "recall").then((cards) => {
      if (active) { setCard(cards[0] ?? null); setLoading(false); }
    }).catch(() => {
      if (active) { setError("Could not load the next question. Try again."); setLoading(false); }
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
    try { await next(); } catch { setError("Could not load the next question. Try again."); }
  });
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
        if (response.status === "accepted") setSaved((count) => count + 1);
        // Refresh saved facts even if fetching the next prompt fails.
        router.refresh();
        await next();
      } catch { setError("Could not finish this question. Your answers are still here. Try again."); }
    });
  };

  const defaults = card ? card.xyzDefaults ?? recallXyzDefaults(card.text) : null;
  let preview = "";
  const canSave = Boolean(text.trim() && measure.trim() && method.trim() && ![text, measure, method, result].some((part) => /[\[\]\n\r]/.test(part)) && measure.length <= 80);
  let previewError: string | null = null;
  try {
    if (defaults) preview = composeRecallXyz(editing ? text : defaults.action, editing ? { measure, method, result } : defaults, true);

  } catch (error) {
    previewError = error instanceof Error ? error.message : "Finish the bullet before saving it.";
    if (!preview) preview = editing ? [text, measure, method, result].filter(Boolean).join(" · ") : previewError;
  }

  return (
    <section aria-label={`Remember more about ${name}`} className="mt-3 rounded-lg border border-brand/25 bg-brand-soft/30 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[14px] font-semibold">Find another line</h4>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setPaused((value) => !value)}>
          {paused ? "Keep going" : "Pause questions"}
        </Button>
      </div>
      {saved > 0 && <p role="status" className="mt-1 text-[12px] text-brand-ink">{saved} new {saved === 1 ? "line" : "lines"} saved for this role.</p>}
      {!paused && <>
        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">These are different tasks related to this experience. Confirm the ones you also did; your saved lines stay in your bank.</p>
        {error && <div role="alert" className="mt-3 space-y-2 text-[13px] text-destructive">
          <p>{error}</p>
          {editing ? <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={pending || !canSave || !confirmed} onClick={() => answer("yes")}>Try again</Button>
            {fallbackAvailable && !wording && <Button type="button" size="sm" variant="outline" disabled={pending || !canSave} onClick={() => answer("yes", "rules")}>Use basic wording check</Button>}
          </div> : <button type="button" className="underline" disabled={pending} onClick={reload}>Load next question</button>}
        </div>}
        {loading ? <p role="status" className="mt-3 flex items-center gap-2 text-[13px]"><LoaderCircle className="size-4 animate-spin" /> Finding a question for this role...</p> : card ? <div key={card.id} className="mt-3 space-y-3">
          <div className="rounded-xl border bg-background p-4 shadow-sm">
            <p className="mb-3 inline-flex rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">New task to consider</p>
            <p className="text-[12px] font-medium text-muted-foreground">{wording ? wording.method === "rules" ? "Review this draft" : "Did you mean this?" : editing ? "Your draft bullet" : card.slot ? "What detail can you add?" : "Have you also done this?"}</p>
            <p className="mt-1 break-words text-[17px] font-medium leading-7 tracking-tight">{wording?.text ?? preview}{!editing && card.slot === "what changed?" ? ", resulting in [what changed?]" : ""}</p>
            {!wording && previewError && preview !== previewError && <p role="alert" className="mt-2 text-[12px] text-destructive">{previewError}</p>}
            <p className="mt-3 text-[11px] text-muted-foreground">{editing ? wording ? wording.message : "Save reviews this sentence with AI. You can confirm any suggested revision." : "X: accomplishment · Y: measure · Z: method. The blanks are yours to fill."}</p>
          </div>
          {editing ? <>
            {!wording && <>
            <label className="block text-[13px]">X · What you accomplished
              <Textarea disabled={pending} className="mt-1 min-h-24" value={text} maxLength={300} onChange={(event) => { setText(event.target.value); setConfirmed(false); setWording(null); }} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <RecallMeasure disabled={pending} value={measure} onChange={(value) => { setMeasure(value); setConfirmed(false); setWording(null); }} />
              <label className="block text-[13px]">Z · How you did it
                <Input disabled={pending} className="mt-1" value={method} maxLength={120} placeholder="Using a tool, or doing a specific action" onChange={(event) => { setMethod(event.target.value); setConfirmed(false); setWording(null); }} />
              </label>
            </div>
            <label className="block text-[13px]">What changed{card.slot === "what changed?" ? "" : " (optional)"}
              <Input disabled={pending} className="mt-1" value={result} maxLength={100} placeholder="A result you can support, including a % if known" onChange={(event) => { setResult(event.target.value); setConfirmed(false); setWording(null); }} />
            </label>
            <p className="text-[12px] leading-5 text-muted-foreground">Use a real count or frequency if you do not know a percentage. Check the line above before saving.</p>
            </>}
            {wording && <p className="text-[12px] leading-5 text-muted-foreground">The revised line has not been saved. Confirm it only if it still describes your work.</p>}
            <fieldset disabled={pending}><ConfirmBox checked={confirmed} onChange={setConfirmed} /></fieldset>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={pending || !canSave || !confirmed || !text.trim() || !measure.trim() || !method.trim() || Boolean(card.slot === "what changed?" && !result.trim())} onClick={() => answer("yes")}>{pending && <LoaderCircle className="animate-spin" />} {pending ? "Checking and saving..." : wording ? "Use this wording and save" : "Save and next question"}</Button>
              {wording && <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => { setWording(null); setConfirmed(false); setError(null); }}>Edit my answers</Button>}
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => answer("no")}>No, next question</Button>
            </div>
          </> : <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={() => { if (!defaults) return; setText(defaults.action); setMeasure(defaults.measure); setMethod(defaults.method); setResult(defaults.result); setConfirmed(false); setEditing(true); }}>Yes, this fits</Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => answer("no")}>{pending && <LoaderCircle className="animate-spin" />} No, next question</Button>
          </div>}
          <details className="text-[12px] leading-5 text-muted-foreground">
            <summary className="cursor-pointer font-medium">Why this card?</summary>
            {card.occupation ? <p className="mt-2">This task is common in {card.occupation.toLowerCase()} work and is related to this experience. Your saved work helps us choose relevant tasks. Confirm only the parts you did.</p> : <p className="mt-2">This is another task to consider for this experience. It becomes a fact only if you confirm it.</p>}
            {card.generator === "onet-31.0" && <p className="mt-2 text-[11px]">Adapted from the <a className="underline" href="https://www.onetcenter.org/database.html" target="_blank" rel="noreferrer">O*NET 31.0 Database</a>, USDOL/ETA, under <a className="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Proofline changed the wording; USDOL/ETA has not approved these changes.</p>}
          </details>
        </div> : <div className="mt-3 text-[13px] leading-5 text-muted-foreground"><p>No different tasks are available for this experience right now. Add a specific example of your work or a clearer role title to help us find related tasks.</p><Button type="button" size="sm" variant="outline" className="mt-2" disabled={pending} onClick={reload}>Check for more questions</Button></div>}
      </>}
    </section>
  );
}
