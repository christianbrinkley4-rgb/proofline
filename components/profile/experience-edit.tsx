"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Pencil } from "lucide-react";
import { toast } from "sonner";
import { archiveExperienceAction, updateExperienceAction } from "@/app/app/profile/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ExperienceDetails } from "@/lib/kb/experiences";

const KINDS: Array<[ExperienceDetails["kind"], string]> = [
  ["work", "Job"],
  ["internship", "Internship"],
  ["leadership", "Leadership"],
  ["project", "Project"],
  ["volunteer", "Volunteer"],
  ["research", "Research"],
];

const field = "space-y-1.5 text-[12.5px]";
const select = "h-9 w-full rounded-md border bg-background px-2 text-[13.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type EditableExperience = ExperienceDetails & { id: string };

const YEAR_ONLY = /^\d{4}$/;
const asMonth = (value: string) => (YEAR_ONLY.test(value) ? "" : value);
/** A year-only date from an import stays until the person picks a month. */
const keepYear = (picked: string, original: string) => picked || (YEAR_ONLY.test(original) ? original : "");

function YearHint({ value }: { value: string }) {
  if (!YEAR_ONLY.test(value)) return null;
  return <span className="block text-[11.5px] text-subtle-foreground">Saved as {value}. Pick a month to be more exact.</span>;
}

/** Fix what the import got wrong: the name, title, place, or dates. Facts and bullets stay as they are. */
export function ExperienceEdit({ experience }: { experience: EditableExperience }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(!experience.endDate);
  const [pending, startTransition] = useTransition();

  const kinds = KINDS.some(([k]) => k === experience.kind) ? KINDS : [...KINDS, [experience.kind, experience.kind] as [ExperienceDetails["kind"], string]];

  return (
    <>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={`Edit ${experience.org}`}
        onClick={() => {
          setError("");
          setConfirmArchive(false);
          setCurrent(!experience.endDate);
          setOpen(true);
        }}
      >
        <Pencil />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit experience</DialogTitle>
            <DialogDescription>Correct the details. Your confirmed facts and bullets stay attached.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const input: ExperienceDetails = {
                kind: String(f.get("kind")) as ExperienceDetails["kind"],
                org: String(f.get("org") ?? ""),
                title: String(f.get("title") ?? ""),
                location: String(f.get("location") ?? ""),
                startDate: keepYear(String(f.get("startDate") ?? ""), experience.startDate),
                endDate: current ? "" : keepYear(String(f.get("endDate") ?? ""), experience.endDate),
              };
              setError("");
              startTransition(async () => {
                const result = await updateExperienceAction(experience.id, input);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setOpen(false);
                toast("Saved.");
                router.refresh();
              });
            }}
          >
            <label className={`${field} sm:col-span-2`}>
              <span>Organization, project, or activity</span>
              <Input name="org" required maxLength={160} defaultValue={experience.org} />
            </label>
            <label className={field}>
              <span>Your role</span>
              <Input name="title" maxLength={160} defaultValue={experience.title} placeholder="Optional" />
            </label>
            <label className={field}>
              <span>Kind</span>
              <select name="kind" defaultValue={experience.kind} className={select}>
                {kinds.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${field} sm:col-span-2`}>
              <span>Location</span>
              <Input name="location" maxLength={120} defaultValue={experience.location} placeholder="City, ST or Remote" />
            </label>
            <label className={field}>
              <span>Started</span>
              <Input name="startDate" type="month" defaultValue={asMonth(experience.startDate)} />
              <YearHint value={experience.startDate} />
            </label>
            <label className={field}>
              <span>Ended</span>
              <Input name="endDate" type="month" defaultValue={asMonth(experience.endDate)} disabled={current} />
              {!current && <YearHint value={experience.endDate} />}
            </label>
            <label className="flex items-center gap-2 text-[13px] sm:col-span-2">
              <input type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)} className="size-4 accent-foreground" />
              I&apos;m still doing this
            </label>
            {error && (
              <p role="alert" className="text-[13px] text-destructive sm:col-span-2">
                {error}
              </p>
            )}
            <DialogFooter className="gap-2 sm:col-span-2 sm:justify-between">
              {confirmArchive ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] text-muted-foreground">Remove from your profile?</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await archiveExperienceAction(experience.id);
                        setOpen(false);
                        toast("Removed from your profile. Resumes you already made keep their copy.");
                        router.refresh();
                      })
                    }
                  >
                    Remove
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmArchive(false)}>
                    Keep
                  </Button>
                </div>
              ) : (
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmArchive(true)}>
                  <Archive data-icon="inline-start" />
                  Remove
                </Button>
              )}
              <Button type="submit" disabled={pending}>
                {pending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
