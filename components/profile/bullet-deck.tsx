"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { answerSuggestionAction, bankStatsAction, nextSuggestionsAction } from "@/app/app/profile/suggest-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Suggestion = Awaited<ReturnType<typeof nextSuggestionsAction>>[number];
type Reason = "not_true" | "true_but_weak" | "wording";

export function BulletDeck({ experienceId }: { experienceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<Suggestion[]>([]);
  const [count, setCount] = useState(0);
  const [slotValue, setSlotValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [choosingReason, setChoosingReason] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const [pending, startTransition] = useTransition();
  const card = cards[0];

  const load = () => startTransition(async () => {
    try {
      setError(null);
      const [next, stats] = await Promise.all([nextSuggestionsAction(experienceId), bankStatsAction()]);
      setCards(next);
      setCount(stats.active);
    } catch {
      setError("Could not load suggestions. Try again.");
    }
  });

  const show = () => { setOpen(true); load(); };
  const answer = (reply: "yes" | "no", reason?: Reason) => {
    if (!card || pending || submitting.current) return;
    submitting.current = true;
    startTransition(async () => {
      try {
        setError(null);
        const result = await answerSuggestionAction(card.id, { answer: reply, reason, slotValue, editedText: editing ? editedText : undefined });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSlotValue("");
        setEditedText("");
        setEditing(false);
        setChoosingReason(false);
        const [next, stats] = await Promise.all([nextSuggestionsAction(experienceId), bankStatsAction()]);
        setCards(next);
        setCount(stats.active);
        router.refresh();
      } catch {
        setError("Could not refresh your bank. Try again.");
      } finally {
        submitting.current = false;
      }
    });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key.toLowerCase() === "y") answer("yes");
      if (event.key.toLowerCase() === "n") setChoosingReason(true);
      if (event.key.toLowerCase() === "e" && card) {
        setEditing(true);
        setEditedText(card.slot ? card.text.replace(`[${card.slot}]`, slotValue || `[${card.slot}]`) : card.text);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <Button size="sm" variant="outline" onClick={show}>Build my bullet bank</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Build my bullet bank</DialogTitle>
            <DialogDescription>Is this something you did? Only your yes puts it in your bank.</DialogDescription>
          </DialogHeader>
          <p className="text-[13px] tabular-nums text-muted-foreground">{count} bullets in your bank</p>
          {error && (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
              <span>{error}</span>
              <Button type="button" size="sm" variant="outline" onClick={load}>Refresh suggestions</Button>
            </div>
          )}
          {card ? (
            <div key={card.id} className="min-w-0 space-y-4 motion-safe:animate-view-in">
              <div className="rounded-lg border bg-muted p-4">
                <p className="text-[11px] text-muted-foreground">{card.kind === "reframe" ? "Another way to say it" : "Did you do this?"}</p>
                <p className="mt-2 break-words text-[16px] leading-7">{card.text}</p>
              </div>
              {card.generator === "onet-31.0" && (
                <p className="text-[11px] leading-5 text-muted-foreground">
                  Adapted from the <a className="underline" href="https://www.onetcenter.org/database.html" target="_blank" rel="noreferrer">O*NET 31.0 Database</a> by the U.S. Department of Labor, Employment and Training Administration, under <a className="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Proofline changed the wording. USDOL/ETA has not approved these changes.
                </p>
              )}
              {card.slot && (
                <label className="block text-[13px]">
                  <span>Fill in {card.slot}</span>
                  <Input value={slotValue} onChange={(event) => setSlotValue(event.target.value)} className="mt-2" placeholder={card.slot === "how many?" ? "A number you can explain" : "Your own answer"} />
                </label>
              )}
              {editing && (
                <label className="block text-[13px]">
                  <span>Your wording</span>
                  <textarea className="mt-2 min-h-28 w-full rounded-md border bg-background p-3 text-[14px]" value={editedText} onChange={(event) => setEditedText(event.target.value)} />
                </label>
              )}
              {choosingReason ? (
                <div className="space-y-2">
                  <p className="text-[13px] text-muted-foreground">What was off?</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => answer("no", "not_true")}>Not something I did</Button>
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => answer("no", "true_but_weak")}>True, but weak</Button>
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => answer("no", "wording")}>Wording is off</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" aria-keyshortcuts="Y" disabled={pending || Boolean(card.slot && (!slotValue.trim() || (card.slot === "how many?" && !/\d/.test(slotValue))))} onClick={() => answer("yes")}>Yes <span aria-hidden="true" className="hidden text-[11px] opacity-70 sm:inline">Y</span></Button>
                  <Button size="sm" aria-keyshortcuts="N" variant="outline" disabled={pending} onClick={() => setChoosingReason(true)}>No <span aria-hidden="true" className="hidden text-[11px] opacity-70 sm:inline">N</span></Button>
                  <Button size="sm" aria-keyshortcuts="E" variant="outline" disabled={pending} onClick={() => { setEditing(true); setEditedText(card.slot ? card.text.replace(`[${card.slot}]`, slotValue || `[${card.slot}]`) : card.text); }}>Edit <span aria-hidden="true" className="hidden text-[11px] opacity-70 sm:inline">E</span></Button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-[14px] text-muted-foreground">
              {pending ? <LoaderCircle className="size-5 animate-spin" /> : "No more suggestions for this experience yet. Add something you did to get new angles."}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
