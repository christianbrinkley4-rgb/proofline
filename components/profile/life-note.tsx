"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NotebookPen, Plus } from "lucide-react";
import { toast } from "sonner";
import { addExperienceAction, type ExperienceFormInput } from "@/app/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableInput } from "@/components/shared/searchable-input";
import { Textarea } from "@/components/ui/textarea";

const kinds = [
  ["work", "Work"], ["internship", "Internship"], ["project", "Project"], ["leadership", "Leadership"], ["volunteer", "Volunteering"], ["research", "Research"],
] as const;

export function LifeNote({ defaultOpen = false }: { defaultOpen?: boolean } = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  return <section className="mt-8 overflow-hidden rounded-xl border bg-background">
    <div className="flex flex-wrap items-start justify-between gap-3 p-5 sm:p-6">
      <div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted"><NotebookPen className="size-4" /></span><div><h2 className="text-base font-semibold tracking-tight">Add a structured experience</h2><p className="mt-1 max-w-xl text-[13.5px] leading-6 text-muted-foreground">Ready to organize a note? Add a job, project, volunteer role, or research experience directly to your confirmed profile. Write what you actually did in your own words.</p></div></div>
      <Button size="sm" variant={open ? "ghost" : "outline"} onClick={() => setOpen(!open)}><Plus data-icon="inline-start" />{open ? "Close" : "Add experience"}</Button>
    </div>
    {open && <form className="grid gap-4 border-t bg-muted/20 p-5 sm:grid-cols-2 sm:p-6" onSubmit={(e) => {
      e.preventDefault(); setError(""); const f = new FormData(e.currentTarget);
      const input: ExperienceFormInput = {
        kind: String(f.get("kind")) as ExperienceFormInput["kind"], org: String(f.get("org")), title: String(f.get("title")),
        location: "", startDate: "", endDate: "", notes: String(f.get("notes")),
      };
      startTransition(async () => {
        try { const result = await addExperienceAction(input); if (!result.ok) { setError(result.error); return; } setTitle(""); setOpen(false); toast("Added to your story. Review the new fact and questions below."); router.refresh(); }
        catch { setError("Couldn't save this note. Please try again."); }
      });
    }}>
      <label className="space-y-1.5 text-xs"><span>What kind of experience?</span><select name="kind" className="h-9 w-full rounded-md border bg-background px-2 text-sm">{kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="space-y-1.5 text-xs"><span>Where or what was it?</span><Input name="org" required maxLength={160} placeholder="Organization, course, or project name" /></label>
      <label className="space-y-1.5 text-xs sm:col-span-2"><span>Your role <span className="text-muted-foreground">(optional)</span></span><SearchableInput id="life-note-role" name="title" kind="roles" value={title} onChange={setTitle} maxLength={160} placeholder="Search jobs or type your role" /></label>
      <label className="space-y-1.5 text-xs sm:col-span-2"><span>Tell us about it in your own words</span><Textarea name="notes" required minLength={10} maxLength={10000} rows={5} placeholder="What did you do? What changed? What tools did you use? Any numbers you remember?" /></label>
      {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save to my story"}</Button></div>
    </form>}
  </section>;
}

