"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { addFactAction, addRoleAction, deleteEducationAction, deleteFactAction, deleteRoleAction, editFactAction, type FactActionResult } from "@/app/app/facts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FactGroup } from "@/lib/facts/base";
import { cn } from "@/lib/utils";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { ConfirmBox } from "./confirm-box";

export type FactRowView = { id: string; text: string; label: string; field: string | null; verifiedAt: string | null };

/** "Sep 29" this year, "Sep 2025" before that. Local time, so the day matches when they ticked the box. */
function confirmedOn(iso: string, long = false) {
  const date = new Date(iso);
  const thisYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", long ? { month: "long", day: "numeric", year: thisYear ? undefined : "numeric" } : thisYear ? { month: "short", day: "numeric" } : { month: "short", year: "numeric" });
}

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<FactActionResult>, done?: () => void, message?: string) =>
    start(async () => {
      const result = await fn().catch(() => ({ ok: false as const, error: "Couldn't reach the server. Try again." }));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (message) toast(message);
      done?.();
      router.refresh();
    });
  return { pending, run };
}

/** One fact in the user's exact words, with edit (re-confirm) and delete. */
export function FactRow({ fact, canDelete = true, multiline }: { fact: FactRowView; canDelete?: boolean; multiline?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(fact.text);
  const [confirmed, setConfirmed] = useState(false);
  const { pending, run } = useAction();

  if (editing) {
    return (
      <li id={`fact-${fact.id}`} className="scroll-mt-24 rounded-lg border border-border-strong bg-background p-3">
        {fact.label && <p className="text-[12px] font-medium text-subtle-foreground">{fact.label}</p>}
        {multiline ? (
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={600} className="mt-1 text-[14px] leading-6" aria-label="Edit this" />
        ) : (
          <Input value={text} onChange={(e) => setText(e.target.value)} maxLength={600} className="mt-1 h-10" aria-label="Edit this" />
        )}
        {fact.verifiedAt && (
          <p className="mt-2 text-[12px] text-subtle-foreground" suppressHydrationWarning>
            You confirmed this on {confirmedOn(fact.verifiedAt, true)}. Saving a change confirms it again.
          </p>
        )}
        <ConfirmBox checked={confirmed} onChange={setConfirmed} className="mt-2" />
        <div className="mt-1 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pending || !confirmed || !text.trim() || text.trim() === fact.text}
            onClick={() => run(() => editFactAction({ factId: fact.id, text, confirmed: true }), () => setEditing(false), "Saved and re-confirmed.")}
          >
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setText(fact.text);
              setConfirmed(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li id={`fact-${fact.id}`} className="group flex scroll-mt-24 items-start gap-3 rounded-lg px-3 py-2 target:bg-pending-soft hover:bg-muted/50">
      <div className="min-w-0 flex-1">
        {fact.label && <span className="mr-2 text-[12px] font-medium text-subtle-foreground">{fact.label}</span>}
        <span className="text-[14.5px] leading-6 break-words">{fact.text}</span>
      </div>
      {fact.verifiedAt && (
        <time
          dateTime={fact.verifiedAt}
          title={`You confirmed this on ${confirmedOn(fact.verifiedAt, true)}`}
          className="hidden shrink-0 pt-1 text-[12px] text-subtle-foreground tabular-nums sm:block"
          suppressHydrationWarning
        >
          <span className="sr-only">Confirmed </span>
          {confirmedOn(fact.verifiedAt)}
        </time>
      )}
      <div className="flex shrink-0 gap-0.5 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <Button size="icon-sm" variant="ghost" aria-label={`Edit: ${fact.text}`} onClick={() => setEditing(true)}>
          <Pencil />
        </Button>
        {canDelete && (
          <ConfirmDelete
            title="Delete this?"
            description="Anything built from it comes off your resumes."
            quote={fact.text}
            confirmLabel="Delete"
            onConfirm={() => run(() => deleteFactAction(fact.id), undefined, "Deleted.")}
          >
            <Button size="icon-sm" variant="ghost" aria-label={`Delete: ${fact.text}`} disabled={pending}>
              {pending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
            </Button>
          </ConfirmDelete>
        )}
      </div>
    </li>
  );
}

export function DeleteRoleButton({ experienceId, name }: { experienceId: string; name: string }) {
  const { pending, run } = useAction();
  return (
    <ConfirmDelete
      title={`Delete ${name}?`}
      description="Everything under it goes too, and comes off your resumes."
      confirmLabel="Delete all of it"
      onConfirm={() => run(() => deleteRoleAction(experienceId), undefined, `Deleted ${name}.`)}
    >
      <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={pending} aria-label={`Delete ${name}`}>
        {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
        Delete
      </Button>
    </ConfirmDelete>
  );
}

export function DeleteEducationButton({ entryId, name }: { entryId: string; name: string }) {
  const { pending, run } = useAction();
  return (
    <ConfirmDelete
      title={`Delete ${name}?`}
      description="Everything under it goes too, and comes off your resumes."
      confirmLabel="Delete all of it"
      onConfirm={() => run(() => deleteEducationAction(entryId), undefined, `Deleted ${name}.`)}
    >
      <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={pending} aria-label={`Delete ${name}`}>
        {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Trash2 data-icon="inline-start" />}
        Delete
      </Button>
    </ConfirmDelete>
  );
}

const PLACEHOLDER: Record<FactGroup, string> = {
  education: "Dean's List, fall 2025",
  experience: "Reconciled 40+ vendor accounts each month in QuickBooks",
  project: "Built a budget tracker in Google Sheets used by 12 club members",
  skill: "Excel",
  license: "Food Handler Certificate",
  number: "Answered about 60 patient calls a day",
};

/** Manual add, with the confirm box. For roles and projects, it attaches to one of them. */
export function AddFact({ group, roles, schools, label }: { group: FactGroup; roles?: Array<{ id: string; name: string }>; schools?: Array<{ id: string; name: string }>; label: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [experienceId, setExperienceId] = useState(roles?.[0]?.id ?? "");
  const [entryId, setEntryId] = useState(schools?.[0]?.id ?? "");
  const [eduField, setEduField] = useState<"honors" | "coursework" | "detail">("honors");
  const [confirmed, setConfirmed] = useState(false);
  const { pending, run } = useAction();
  const needsRole = group === "experience" || group === "project";
  const isEducation = group === "education";
  const placeholder = isEducation ? (eduField === "coursework" ? "Federal Tax Concepts, Auditing" : eduField === "detail" ? "A line from your education section" : "Dean's List, fall 2025") : PLACEHOLDER[group];

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="bg-background" onClick={() => setOpen(true)} disabled={needsRole && !roles?.length}>
        <Plus data-icon="inline-start" />
        {label}
      </Button>
    );
  }
  return (
    <div className="rounded-lg border border-border-strong bg-background p-3">
      {needsRole && roles && (
        <label className="block text-[12.5px]">
          <span className="text-muted-foreground">Where</span>
          <select value={experienceId} onChange={(e) => setExperienceId(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-[14px]">
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {isEducation && (
        <div className="grid gap-2 sm:grid-cols-2">
          {schools && schools.length > 0 && (
            <label className="block text-[12.5px]">
              <span className="text-muted-foreground">School</span>
              <select value={entryId} onChange={(e) => setEntryId(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-[14px]">
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-[12.5px]">
            <span className="text-muted-foreground">What it is</span>
            <select value={eduField} onChange={(e) => setEduField(e.target.value as typeof eduField)} className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-[14px]">
              <option value="honors">Honors</option>
              <option value="coursework">Coursework</option>
              <option value="detail">Other detail</option>
            </select>
          </label>
        </div>
      )}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={needsRole || eduField === "coursework" ? 2 : 1}
        maxLength={600}
        placeholder={placeholder}
        aria-label={label}
        className={cn("text-[14px] leading-6", (needsRole || isEducation) && "mt-2")}
      />
      <ConfirmBox checked={confirmed} onChange={setConfirmed} className="mt-2" />
      <div className="mt-1 flex gap-2">
        <Button
          size="sm"
          disabled={pending || !confirmed || text.trim().length < 2}
          onClick={() =>
            run(
              () => addFactAction({ group, text, experienceId: needsRole ? experienceId : null, entryId: isEducation ? entryId || undefined : undefined, eduField: isEducation ? eduField : undefined, confirmed: true }),
              () => {
                setText("");
                setConfirmed(false);
                setOpen(false);
              },
              "Added and confirmed.",
            )
          }
        >
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Add fact
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

const KINDS = [
  ["work", "Job"],
  ["internship", "Internship"],
  ["leadership", "Club or leadership"],
  ["volunteer", "Volunteering"],
  ["project", "Project"],
  ["research", "Research"],
] as const;

export function AddRole({ project }: { project?: boolean }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>(project ? "project" : "work");
  const [org, setOrg] = useState("");
  const [title, setTitle] = useState("");
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");
  const [bullets, setBullets] = useState(["", ""]);
  const [confirmed, setConfirmed] = useState(false);
  const { pending, run } = useAction();

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="bg-background" onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        {project ? "Add a project" : "Add a role"}
      </Button>
    );
  }
  return (
    <div className="space-y-3 rounded-lg border border-border-strong bg-background p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[12.5px]">
          <span className="text-muted-foreground">{project ? "Project name" : "Company or organization"}</span>
          <Input value={org} onChange={(e) => setOrg(e.target.value)} maxLength={160} className="mt-1 h-10" />
        </label>
        <label className="text-[12.5px]">
          <span className="text-muted-foreground">{project ? "Your role (optional)" : "Title"}</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} className="mt-1 h-10" />
        </label>
        <label className="text-[12.5px]">
          <span className="text-muted-foreground">Kind</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-[14px]">
            {KINDS.filter(([k]) => (project ? k === "project" || k === "research" : k !== "project" && k !== "research")).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[12.5px]">
            <span className="text-muted-foreground">Start</span>
            <Input type="month" value={startDate} onChange={(e) => setStart(e.target.value)} className="mt-1 h-10" />
          </label>
          <label className="text-[12.5px]">
            <span className="text-muted-foreground">End (blank if current)</span>
            <Input type="month" value={endDate} onChange={(e) => setEnd(e.target.value)} className="mt-1 h-10" />
          </label>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-[12.5px] text-muted-foreground">What you remember doing (optional). Save the role, then use Find more lines for this role to jog your memory.</p>
        {bullets.map((b, i) => (
          <Input
            key={i}
            value={b}
            onChange={(e) => setBullets((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
            maxLength={400}
            aria-label={`Bullet ${i + 1}`}
            className="h-10"
          />
        ))}
        {bullets.length < 4 && (
          <button type="button" className="text-[12.5px] font-medium underline-offset-4 hover:underline" onClick={() => setBullets((all) => [...all, ""])}>
            Add another line
          </button>
        )}
      </div>
      <ConfirmBox checked={confirmed} onChange={setConfirmed} />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending || !confirmed || !org.trim()}
          onClick={() =>
            run(
              () => addRoleAction({ kind, org, title, startDate, endDate, bullets: bullets.filter((b) => b.trim()), confirmed: true }),
              () => setOpen(false),
              "Added and confirmed.",
            )
          }
        >
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
