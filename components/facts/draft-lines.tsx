"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Pencil, Plus, Sparkles, X } from "lucide-react";
import { keepLineAction, saveRoleNotesAction, undoKeepAction } from "@/app/app/facts/draft-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { draftBullets, draftWithAnswer, type DraftLine } from "@/lib/resume/draft-bullets";
import { cn } from "@/lib/utils";

type Origin = "draft" | "resume" | "edited" | "own";

type Card = {
  key: string;
  text: string;
  origin: Origin;
  /** What the person typed that this card came from, for the server's number check. */
  sources: string[];
  draft: Pick<DraftLine, "action" | "result" | "question" | "example"> | null;
  state: "pending" | "editing" | "kept";
  answer: string;
  /** The number question is dismissed or answered. */
  asked: boolean;
  error: string | null;
  factId: string | null;
};

export type DraftLinesProps = {
  experienceId: string;
  kind: string;
  /** Past tense when the role is over, present while it's current. */
  ended: boolean;
  /** What they said the role involved, if they already wrote it. */
  description?: string;
  /** Lines read from their own resume for this role, shown as cards to keep. */
  imported?: string[];
  /** Lines this role already has, so a draft never repeats one. */
  existing?: string[];
  /** Draft from the description as soon as this opens. */
  autoDraft?: boolean;
  /** Called with the number of lines kept so far. */
  onKeptChange?: (kept: number) => void;
  className?: string;
};

/** Two lines that differ only in case or punctuation are the same line. */
const sameLine = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const fromDraft = (line: DraftLine, description: string): Card => ({
  key: `${line.key}-${line.text}`,
  text: line.text,
  origin: "draft",
  sources: [description],
  draft: line,
  state: "pending",
  answer: "",
  asked: !line.question,
  error: null,
  factId: null,
});

const fromResume = (text: string, i: number): Card => ({
  key: `r${i}-${text}`,
  text,
  origin: "resume",
  sources: [text],
  draft: null,
  state: "pending",
  answer: "",
  asked: true,
  error: null,
  factId: null,
});

/**
 * Recommended resume lines for one role. The person describes the role in plain
 * words, Proofline drafts two to four lines from it, and they Keep, Edit, or Drop
 * each one. Only a kept or edited line becomes a confirmed fact; a draft never
 * reaches a resume, and a dropped one is gone.
 */
export function DraftLines({ experienceId, kind, ended, description: initial = "", imported = [], existing = [], autoDraft = false, onKeptChange, className }: DraftLinesProps) {
  const saved = new Set(existing.map(sameLine));
  const router = useRouter();
  const [description, setDescription] = useState(initial);
  const [drafted, setDrafted] = useState(false);
  const [cards, setCards] = useState<Card[]>(() => {
    const fromFile = imported.map(fromResume);
    const drafts = autoDraft && initial.trim() ? draftBullets({ kind, ended, description: initial }).filter((l) => !saved.has(sameLine(l.text))).map((l) => fromDraft(l, initial)) : [];
    return [...fromFile, ...drafts];
  });
  const [thin, setThin] = useState(false);
  // Lines from their own resume come first; describing more is one tap away.
  const [describing, setDescribing] = useState(imported.length === 0 || Boolean(initial.trim()));
  const kept = cards.filter((c) => c.state === "kept").length;
  const reported = useRef(-1);

  useEffect(() => {
    if (reported.current !== kept) {
      reported.current = kept;
      onKeptChange?.(kept);
    }
  }, [kept, onKeptChange]);

  const update = (key: string, patch: Partial<Card>) => setCards((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const drop = (key: string) => setCards((list) => list.filter((c) => c.key !== key));

  const draft = () => {
    const text = description.trim();
    if (!text) return;
    // New drafts replace the old undecided ones; kept lines, open edits, and lines already saved stay put.
    const settled = cards.filter((c) => c.state !== "pending" || c.origin === "resume");
    const known = new Set([...saved, ...settled.map((c) => sameLine(c.text))]);
    const fresh = draftBullets({ kind, ended, description: text }).filter((l) => !known.has(sameLine(l.text)));
    setCards([...settled, ...fresh.map((l) => fromDraft(l, text))]);
    setThin(fresh.length < 2);
    setDrafted(true);
    void saveRoleNotesAction(experienceId, text).catch(() => undefined);
  };

  const addOwn = () =>
    setCards((list) => [...list, { key: `own-${Date.now()}`, text: "", origin: "own", sources: [], draft: null, state: "editing", answer: "", asked: true, error: null, factId: null }]);

  const pending = cards.filter((c) => c.state !== "kept");
  const hasDrafts = cards.some((c) => c.origin === "draft");

  return (
    <div className={cn("space-y-4", className)}>
      {describing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            draft();
          }}
        >
          <label htmlFor={`describe-${experienceId}`} className="text-[14px] font-medium">
            {imported.length ? "Anything else you did there?" : "What did you do there?"}
          </label>
          <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">
            A few plain sentences is plenty. Put in any numbers you remember, like customers a shift. I&apos;ll turn it into resume lines for you to check.
          </p>
          <Textarea
            id={`describe-${experienceId}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={kind === "project" || kind === "research" ? "Built a budget tracker in Google Sheets so 12 club members could log dues" : "Worked the register, about 50 customers a shift. Restocked shelves and trained 2 new hires."}
            className="mt-2 text-[14px] leading-6"
          />
          <Button type="submit" variant={cards.length ? "outline" : "default"} className="mt-2" disabled={!description.trim()}>
            <Sparkles data-icon="inline-start" />
            {drafted || cards.some((c) => c.origin === "draft") ? "Draft again" : "Draft my resume lines"}
          </Button>
          {drafted && thin && (
            <p role="status" className="mt-2 text-[13px] leading-5 text-pending-ink">
              {cards.some((c) => c.origin === "draft") ? "That's all I could draft without guessing." : "I couldn't find a task in that yet."} Add one or two more things you did, then draft again.
            </p>
          )}
        </form>
      )}

      {cards.length > 0 && (
        <div>
          {pending.length > 0 && (
            <p className="text-[13px] leading-5 text-muted-foreground">
              {cards.some((c) => c.origin === "resume") && !hasDrafts ? "From your resume. " : "My drafts. "}
              Keep the true ones, edit anything that&apos;s off, and drop the rest. Only what you keep goes on a resume.
            </p>
          )}
          <ul className="mt-3 space-y-2.5" aria-live="polite">
            {cards.map((card) => (
              <li key={card.key}>
                {card.state === "kept" ? (
                  <KeptRow
                    card={card}
                    onUndo={async () => {
                      if (card.factId) await undoKeepAction(card.factId).catch(() => undefined);
                      update(card.key, { state: "pending", factId: null });
                      router.refresh();
                    }}
                  />
                ) : card.state === "editing" ? (
                  <EditCard
                    card={card}
                    experienceId={experienceId}
                    onSaved={(factId, text) => {
                      update(card.key, { state: "kept", factId, text, origin: card.origin === "own" ? "own" : "edited", error: null });
                      router.refresh();
                    }}
                    onCancel={() => (card.origin === "own" ? drop(card.key) : update(card.key, { state: "pending", error: null }))}
                  />
                ) : (
                  <DraftCard
                    card={card}
                    ended={ended}
                    experienceId={experienceId}
                    onChange={(patch) => update(card.key, patch)}
                    onKept={(factId, text) => {
                      update(card.key, { state: "kept", factId, text, error: null });
                      router.refresh();
                    }}
                    onDrop={() => drop(card.key)}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!describing && (
        <Button type="button" size="sm" variant="outline" className="bg-background" onClick={() => setDescribing(true)}>
          <Sparkles data-icon="inline-start" />
          Did more there? Describe it and I&apos;ll draft lines
        </Button>
      )}
      <button type="button" onClick={addOwn} className="inline-flex min-h-10 items-center gap-1 text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        <Plus className="size-3.5" aria-hidden="true" />
        Write my own line instead
      </button>
    </div>
  );
}

function DraftCard({
  card,
  ended,
  experienceId,
  onChange,
  onKept,
  onDrop,
}: {
  card: Card;
  ended: boolean;
  experienceId: string;
  onChange: (patch: Partial<Card>) => void;
  onKept: (factId: string, text: string) => void;
  onDrop: () => void;
}) {
  const [pending, start] = useTransition();
  const keep = () =>
    start(async () => {
      const result = await keepLineAction({ experienceId, text: card.text, origin: card.origin, sources: card.answer ? [...card.sources, card.answer] : card.sources, confirmed: true }).catch(() => ({
        ok: false as const,
        error: "Couldn't reach Proofline. Check your connection and try again.",
      }));
      if (result.ok) onKept(result.factId, result.text);
      else onChange({ error: result.error });
    });
  const answer = () => {
    if (!card.draft) return;
    try {
      onChange({ text: draftWithAnswer(card.draft, card.answer, ended), asked: true, error: null });
    } catch (error) {
      onChange({ error: error instanceof Error ? error.message : "Use Edit to add the number your way." });
    }
  };

  return (
    <div className="rounded-xl border border-pending/40 bg-pending-soft/40 p-3 sm:p-4">
      <p className="text-[11.5px] font-medium text-pending-ink">{card.origin === "resume" ? "From your resume, not confirmed yet" : "Draft, not on your resume yet"}</p>
      <p className="mt-1 text-[15px] leading-6 font-medium text-foreground">{card.text}</p>
      {!card.asked && card.draft?.question && (
        <form
          className="mt-2.5 rounded-lg bg-background/80 p-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            answer();
          }}
        >
          <label htmlFor={`answer-${card.key}`} className="text-[13px] leading-5">
            {card.draft.question} <span className="text-muted-foreground">Skip it if you&apos;re not sure.</span>
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Input
              id={`answer-${card.key}`}
              value={card.answer}
              onChange={(e) => onChange({ answer: e.target.value, error: null })}
              maxLength={80}
              placeholder={card.draft.example ?? ""}
              className="h-9 min-w-0 flex-1 basis-48 bg-background"
            />
            <Button type="submit" size="sm" variant="outline" className="h-9" disabled={!card.answer.trim()}>
              Add it
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => onChange({ asked: true, answer: "", error: null })}>
              Skip
            </Button>
          </div>
        </form>
      )}
      {card.error && (
        <p role="alert" className="mt-2 text-[13px] leading-5 text-pending-ink">
          {card.error}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={keep} disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : <Check data-icon="inline-start" />}
          Keep
        </Button>
        <Button type="button" size="sm" variant="outline" className="bg-background" onClick={() => onChange({ state: "editing", error: null })} disabled={pending}>
          <Pencil data-icon="inline-start" />
          Edit
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDrop} disabled={pending}>
          <X data-icon="inline-start" />
          Drop
        </Button>
      </div>
    </div>
  );
}

function EditCard({ card, experienceId, onSaved, onCancel }: { card: Card; experienceId: string; onSaved: (factId: string, text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(card.text);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      setError(null);
      const result = await keepLineAction({ experienceId, text, origin: card.origin === "own" ? "own" : "edited", sources: [], confirmed: true }).catch(() => ({
        ok: false as const,
        error: "Couldn't reach Proofline. Check your connection and try again.",
      }));
      if (result.ok) onSaved(result.factId, result.text);
      else setError(result.error);
    });

  return (
    <form
      className="rounded-xl border bg-background p-3 sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label htmlFor={`edit-${card.key}`} className="text-[13px] font-medium">
        {card.origin === "own" ? "Your line" : "Say it your way"}
      </label>
      <p className="mt-0.5 text-[12.5px] leading-5 text-muted-foreground">Start with what you did. Add a number only if you could explain it in an interview.</p>
      <Textarea id={`edit-${card.key}`} value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={400} autoFocus className="mt-2 text-[14px] leading-6" />
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-pending-ink">
          {error}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending || text.trim().length < 3}>
          {pending ? <LoaderCircle className="animate-spin" /> : <Check data-icon="inline-start" />}
          Save, it&apos;s true
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function KeptRow({ card, onUndo }: { card: Card; onUndo: () => Promise<void> }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-brand/30 bg-brand-soft/40 px-3 py-2.5">
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand text-background">
        <Check className="size-3" strokeWidth={3} aria-hidden="true" />
      </span>
      <p className="min-w-0 flex-1 text-[14px] leading-6">
        <span className="sr-only">Kept: </span>
        {card.text}
      </p>
      <button type="button" disabled={pending} onClick={() => start(onUndo)} className="inline-flex min-h-6 shrink-0 items-center text-[12.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
        Undo
      </button>
    </div>
  );
}

/** On My experience: recommended lines for a role that's already saved, opened on demand. */
export function DraftLinesToggle(props: Omit<DraftLinesProps, "autoDraft">) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Sparkles data-icon="inline-start" />
        Get recommended lines
      </Button>
    );
  }
  return (
    <div className="w-full rounded-xl border bg-muted/30 p-3 sm:p-4">
      <DraftLines {...props} />
      <Button type="button" size="sm" variant="ghost" className="mt-1" onClick={() => setOpen(false)}>
        Close
      </Button>
    </div>
  );
}
