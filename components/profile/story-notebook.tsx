"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, NotebookPen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createStoryNoteAction, deleteStoryNoteAction, promoteStoryNoteAction, updateStoryNoteAction } from "@/app/app/profile/story-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StoryNote } from "@/lib/kb/story";

const kinds = [
  ["work", "Work"], ["internship", "Internship"], ["project", "Project"],
  ["leadership", "Leadership"], ["volunteer", "Volunteering"], ["research", "Research"],
] as const;
type Kind = (typeof kinds)[number][0];

export function StoryNotebook({ notes }: { notes: StoryNote[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const visible = showAll ? notes : notes.slice(0, 4);

  function run(work: () => Promise<unknown>, success: string, done?: () => void) {
    setError("");
    startTransition(async () => {
      try {
        await work();
        done?.();
        toast(success);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Couldn't save this note. Please try again.");
      }
    });
  }

  return <section className="mt-8 overflow-hidden rounded-xl border bg-background">
    <div className="border-b p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><NotebookPen className="size-4" /></span>
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight">Your story notebook</h2>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-6 text-muted-foreground">Write down anything you did, learned, built, helped with, or overcame. Start messy. You can organize it later.</p>
        </div>
      </div>
      <form className="mt-5 space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fields = new FormData(form);
        run(() => createStoryNoteAction({
          body: String(fields.get("body") || ""), context: String(fields.get("context") || ""), when: String(fields.get("when") || ""),
        }), "Saved to your notebook.", () => form.reset());
      }}>
        <label className="block space-y-1.5 text-xs"><span>What comes to mind?</span><Textarea name="body" required minLength={4} maxLength={4000} rows={4} placeholder="I organized a neighborhood food drive. We collected 120 boxes, and I learned how to coordinate volunteers..." /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 text-xs"><span>Where or what? <span className="text-muted-foreground">(optional)</span></span><Input name="context" maxLength={160} placeholder="A job, class, team, project, or just life" /></label>
          <label className="block space-y-1.5 text-xs"><span>When? <span className="text-muted-foreground">(optional)</span></span><Input name="when" maxLength={100} placeholder="Summer 2024, or whenever you remember" /></label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-lg text-[12px] leading-5 text-muted-foreground">Private notes do not affect job matches or resumes until you choose to turn them into evidence.</p>
          <Button size="sm" type="submit" disabled={pending}>{pending ? "Saving..." : "Save note"}</Button>
        </div>
      </form>
      {error && <p role="alert" className="mt-3 text-[12.5px] text-destructive">{error}</p>}
    </div>
    {notes.length > 0 && <div className="p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between"><h3 className="text-[13px] font-medium">Saved notes <span className="text-subtle-foreground">({notes.length})</span></h3>{notes.length > 4 && <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>{showAll ? "Show less" : "Show all"}</Button>}</div>
      <div className="space-y-3">{visible.map((note) => <article key={note.id} className="rounded-lg border p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><p className="text-[11px] text-subtle-foreground">{[note.context, note.when, new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })].filter(Boolean).join(" · ")}</p><p className="mt-2 whitespace-pre-wrap text-[13px] leading-5">{note.body}</p></div>
          {note.promotedExperienceId && <span className="rounded bg-brand/10 px-2 py-0.5 text-[11px] text-brand-ink">In your evidence</span>}
        </div>
        {editing === note.id && !note.promotedExperienceId && <form className="mt-4 space-y-3 border-t pt-4" onSubmit={(e) => {
          e.preventDefault(); const fields = new FormData(e.currentTarget);
          run(() => updateStoryNoteAction(note.id, { body: String(fields.get("body") || ""), context: String(fields.get("context") || ""), when: String(fields.get("when") || "") }), "Note updated.", () => setEditing(null));
        }}>
          <label className="block space-y-1 text-xs"><span>Note</span><Textarea name="body" defaultValue={note.body} required minLength={4} maxLength={4000} rows={4} /></label>
          <div className="grid gap-2 sm:grid-cols-2"><label className="space-y-1 text-xs"><span>Where or what?</span><Input name="context" defaultValue={note.context ?? ""} maxLength={160} /></label><label className="space-y-1 text-xs"><span>When?</span><Input name="when" defaultValue={note.when ?? ""} maxLength={100} /></label></div>
          <div className="flex gap-2"><Button size="sm" type="submit" disabled={pending}>Save changes</Button><Button size="sm" type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
        </form>}
        {promoting === note.id && !note.promotedExperienceId && <form className="mt-4 space-y-3 border-t pt-4" onSubmit={(e) => {
          e.preventDefault(); const fields = new FormData(e.currentTarget);
          run(() => promoteStoryNoteAction(note.id, { kind: String(fields.get("kind")) as Kind, org: String(fields.get("org") || ""), title: String(fields.get("title") || "") }), "Added to your confirmed evidence.", () => setPromoting(null));
        }}>
          <p className="text-[12px] leading-5 text-muted-foreground">Proofline will turn your statements into confirmed facts and may ask a few follow-up questions. You can review or correct them on this page.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-xs"><span>Type of experience</span><select name="kind" className="h-9 w-full rounded-md border bg-background px-2 text-sm">{kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="space-y-1 text-xs"><span>Place, project, or activity</span><Input name="org" defaultValue={note.context ?? ""} required maxLength={160} /></label>
          </div>
          <label className="block space-y-1 text-xs"><span>Your role <span className="text-muted-foreground">(optional)</span></span><Input name="title" maxLength={160} /></label>
          <label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" required className="mt-1" /><span>I confirm these notes describe my own experience accurately.</span></label>
          <div className="flex gap-2"><Button size="sm" type="submit" disabled={pending}>Use as evidence <ArrowRight data-icon="inline-end" /></Button><Button size="sm" type="button" variant="ghost" onClick={() => setPromoting(null)}>Cancel</Button></div>
        </form>}
        {deleting === note.id && <div className="mt-4 border-t pt-4"><p className="text-xs text-destructive">Delete this note? {note.promotedExperienceId ? "Its confirmed experience and facts will remain." : "This cannot be undone."}</p><div className="mt-2 flex gap-2"><Button size="sm" variant="destructive" disabled={pending} onClick={() => run(() => deleteStoryNoteAction(note.id), "Note deleted.", () => setDeleting(null))}>Delete note</Button><Button size="sm" variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button></div></div>}
        <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
          {!note.promotedExperienceId && <><Button size="sm" variant="outline" onClick={() => { setPromoting(promoting === note.id ? null : note.id); setEditing(null); setDeleting(null); }}>Use as evidence</Button><Button size="sm" variant="ghost" onClick={() => { setEditing(editing === note.id ? null : note.id); setPromoting(null); setDeleting(null); }}>Edit</Button></>}
          <Button size="sm" variant="ghost" onClick={() => { setDeleting(deleting === note.id ? null : note.id); setEditing(null); setPromoting(null); }}><Trash2 data-icon="inline-start" />Delete</Button>
        </div>
      </article>)}</div>
    </div>}
  </section>;
}
