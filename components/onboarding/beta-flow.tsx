"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, FileText, LoaderCircle, Plus, Upload } from "lucide-react";
import {
  finishOnboardingStepAction,
  goToStepAction,
  saveEducationStepAction,
  saveListsStepAction,
  saveLogisticsStepAction,
  saveRoleStepAction,
  type StepResult,
} from "@/app/app/onboarding/beta-actions";
import { FIRST_RUN, PROGRESS_STEPS, type OnboardingStep } from "@/app/app/onboarding/steps";
import { PasteJobBox } from "@/components/coach/paste-job-box";
import { ConfirmBox } from "@/components/facts/confirm-box";
import { DraftLines } from "@/components/facts/draft-lines";
import { SearchableInput } from "@/components/shared/searchable-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DraftResponse } from "@/app/api/onboarding/resume-draft/route";
import { Textarea } from "@/components/ui/textarea";
import { confirmedEducationDetails, newToAccount, type ResumeDraft, type RoleDraft } from "@/lib/onboarding/draft";
import { countableRoleLines, isProjectKind } from "./role-step";
import { ChipInput, Field, PillChoice } from "./parts";

export type BetaOnboardingData = {
  step: OnboardingStep;
  firstName: string;
  basics: { fullName: string; phone: string; city: string; region: string; contactEmail: string; linkedinUrl: string; portfolioUrl: string; school: string; degree: string; major: string; gradDate: string; gpa: string };
  education: Array<{ entryId: string; school: string; degree: string; major: string; gradDate: string; gpa: string; honors: string; coursework: string }>;
  roles: Array<{ id: string; kind: string; org: string; title: string; name: string; lines: number }>;
  skills: string[];
  licenses: string[];
  logistics: { workAuthorization: string; targetLocations: string[]; workModes: Array<"remote" | "hybrid" | "onsite">; openToRelocate: "" | "yes" | "no"; availableFrom: string };
  hasEducation: boolean;
  /** Came from My experience to import a resume into an account that already has some. */
  importing: boolean;
  /** Came from My experience to add one role: open the form straight away. */
  adding: boolean;
  /** Came from a must-have warning or Settings to fix one thing: go back there after it. */
  returnTo: string | null;
};

export function BetaOnboarding({ data }: { data: BetaOnboardingData }) {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>(data.step === "done" ? "job" : data.step);
  const [, start] = useTransition();
  const [storedDraft, setDraftState] = useState<ResumeDraft | null>(null);
  // Schools and roles saved since the resume was read drop out of it, so going
  // back a screen never offers (or saves) a second copy of one.
  const draft = useMemo(() => (storedDraft ? newToAccount(storedDraft, { schools: data.education, roles: data.roles }) : null), [storedDraft, data.education, data.roles]);
  // Keep a read resume through reloads in this tab.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      // Known only in the browser; restored after mount so server and client markup match.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setDraftState(JSON.parse(saved) as ResumeDraft);
    } catch {
      // Storage can be blocked; the person can read the resume again.
    }
  }, []);
  const setDraft = (next: ResumeDraft | null) => {
    setDraftState(next);
    try {
      if (next) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Not kept across reloads; the draft still works on this page.
    }
  };
  const doneWithDraft = (key: string) => {
    if (storedDraft) setDraft({ ...storedDraft, roles: storedDraft.roles.filter((r) => r.key !== key) });
  };
  const progress = FIRST_RUN.indexOf(step === "projects" ? "experience" : step);

  // A resume adds only the schools and roles this account doesn't have yet.
  const readDraft = (next: ResumeDraft) => setDraft(newToAccount(next, { schools: data.education, roles: data.roles }));

  const go = (next: OnboardingStep) => {
    if (data.importing && next === "job") {
      setDraft(null);
      router.push("/app/facts");
      router.refresh();
      return;
    }
    if (data.returnTo) {
      router.push(data.returnTo);
      router.refresh();
      return;
    }
    if (next === "job") setDraft(null);
    setStep(next);
    start(() => goToStepAction(next));
    window.scrollTo({ top: 0 });
    router.refresh();
  };
  const hasRole = data.roles.length > 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-12">
      {progress >= 0 && !data.returnTo && !data.importing && (
        <ol aria-label="Progress" className="grid grid-cols-3 gap-1.5">
          {PROGRESS_STEPS.map((s, i) => (
            <li key={s.id} aria-current={i === progress ? "step" : undefined}>
              <span className="block h-1 overflow-hidden rounded-full bg-muted">
                <span className={cn("block h-full rounded-full transition-[width] duration-500", i < progress ? "w-full bg-brand" : i === progress ? "w-1/2 bg-ink" : "w-0")} />
              </span>
              <span className={cn("mt-1.5 block text-[11.5px] leading-4", i === progress ? "font-medium text-foreground" : "text-subtle-foreground")}>
                <span className="tabular-nums">{i + 1}.</span> {s.label}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div key={step} className="mt-8 motion-safe:animate-view-in">
        {step === "education" && <EducationScreen key={draft ? "draft" : "blank"} data={data} draft={draft} onDraft={readDraft} onDone={() => go("experience")} />}
        {(step === "experience" || step === "projects") && (
          <ExperienceScreen
            key={step}
            project={step === "projects"}
            startOpen={data.adding}
            roles={data.roles}
            drafts={draft?.roles ?? []}
            onDraftSaved={doneWithDraft}
            onBack={() => go("education")}
            onContinue={hasRole ? () => go("job") : null}
          />
        )}
        {step === "skills" && <ListsScreen data={data} draft={draft} onBack={() => go("experience")} onDone={() => go("job")} onSkip={() => go("job")} />}
        {step === "logistics" && <LogisticsScreen data={data} onBack={() => go("experience")} onDone={() => go("job")} onSkip={() => go("job")} />}
        {step === "job" && <JobScreen onBack={() => go("experience")} needs={!data.hasEducation ? "education" : !hasRole ? "experience" : null} onFix={go} />}
      </div>
    </div>
  );
}

function Heading({ title, hint }: { title: string; hint: string }) {
  return (
    <>
      <h1 className="font-display text-[28px] leading-tight font-semibold sm:text-[34px]">{title}</h1>
      <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{hint}</p>
    </>
  );
}

function Nav({ onBack, backHref, onSkip, skipLabel = "Skip for now", children }: { onBack?: () => void; backHref?: string; onSkip?: () => void; skipLabel?: string; children?: React.ReactNode }) {
  return (
    <div className="mt-8 flex flex-wrap items-center gap-2 border-t pt-5">
      {backHref ? (
        <Button variant="ghost" asChild>
          <Link href={backHref}>
            <ArrowLeft data-icon="inline-start" />
            Back
          </Link>
        </Button>
      ) : onBack ? (
        <Button variant="ghost" type="button" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" />
          Back
        </Button>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {onSkip && (
          <Button variant="ghost" type="button" onClick={onSkip}>
            {skipLabel}
          </Button>
        )}
        {children}
      </div>
    </div>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
      {error}
    </p>
  ) : null;
}

function useSave() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = (fn: () => Promise<StepResult>, onOk: () => void) =>
    start(async () => {
      setError(null);
      const result = await fn().catch(() => ({ ok: false as const, error: "Couldn't reach the server. Check your connection and try again." }));
      if (!result.ok) setError(result.error);
      else onOk();
    });
  return { pending, error, save };
}

/** Screen 1. School and graduation are all it needs; everything else waits in "More details". */
function EducationScreen({ data, draft, onDraft, onDone }: { data: BetaOnboardingData; draft: ResumeDraft | null; onDraft: (d: ResumeDraft) => void; onDone: () => void }) {
  // What they've already saved wins; the resume fills only what's still empty.
  const [v, setV] = useState(() =>
    draft ? (Object.fromEntries(Object.entries(data.basics).map(([k, value]) => [k, value || draft.basics[k as keyof typeof data.basics]])) as typeof data.basics) : data.basics,
  );
  const [entries, setEntries] = useState(() => initialSchools(data, draft));
  const merge = (saved: string[], read: string[] = []) => [...saved, ...read.filter((x) => !saved.some((y) => y.toLowerCase() === x.toLowerCase()))];
  const [skills, setSkills] = useState<string[]>(() => merge(data.skills, draft?.skills));
  const [licenses, setLicenses] = useState<string[]>(() => merge(data.licenses, draft?.licenses));
  const { pending, error, save } = useSave();
  const set = (key: keyof typeof v) => (value: string) => setV((x) => ({ ...x, [key]: value }));
  const setEntry = (index: number, key: keyof EduForm, value: string) => setEntries((list) => list.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)));
  // Anything already filled in (from a resume or an earlier visit) is shown, never saved unseen.
  const [more] = useState(
    () =>
      Boolean(v.phone || v.contactEmail || v.linkedinUrl || v.portfolioUrl || v.city || v.region) ||
      entries.length > 1 ||
      entries.some((e) => e.gpa || e.honors || e.coursework || e.details.length) ||
      skills.length > 0 ||
      licenses.length > 0,
  );
  const listsChanged = skills.length !== data.skills.length || licenses.length !== data.licenses.length;
  const first = entries[0];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const filled = entries.filter((entry) => entry.school.trim());
        save(async () => {
          const saved = await saveEducationStepAction({
            fullName: v.fullName,
            phone: v.phone,
            city: v.city,
            region: v.region,
            contactEmail: v.contactEmail,
            linkedinUrl: v.linkedinUrl,
            portfolioUrl: v.portfolioUrl,
            entries: filled.map((entry) => ({ ...entry, entryId: entry.entryId || undefined, details: confirmedEducationDetails(entry.details) })),
            confirmed: true,
          });
          if (!saved.ok || !listsChanged) return saved;
          return saveListsStepAction({ skills, licenses, confirmed: true });
        }, onDone);
      }}
    >
      {data.importing ? (
        <Heading title="Import from your resume" hint="I'll add the schools, roles, and skills you haven't saved yet, for you to check. What's already saved stays as it is." />
      ) : (
        <Heading title={`Hi ${data.firstName}. Let's start with school.`} hint="Just your school and when you graduate. Expected is fine. Everything else is optional." />
      )}
      {((!data.hasEducation && data.roles.length === 0) || data.importing) && <ResumeImport draft={draft} onDraft={onDraft} importing={data.importing} />}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="School" htmlFor="school-0">
            <SearchableInput id="school-0" kind="schools" value={first.school} onChange={(value) => setEntry(0, "school", value)} required maxLength={200} />
          </Field>
        </div>
        <Field label="Graduation month" hint="Expected is fine." htmlFor="gradDate-0">
          <Input id="gradDate-0" type="month" value={first.gradDate} onChange={(e) => setEntry(0, "gradDate", e.target.value)} required className="h-10" />
        </Field>
        <Field label="Name on your resume" htmlFor="fullName">
          <Input id="fullName" value={v.fullName} onChange={(e) => set("fullName")(e.target.value)} required maxLength={120} className="h-10" />
        </Field>
        <Field label="Degree" hint="Optional. B.S., B.A., Associate's" htmlFor="degree-0">
          <SearchableInput id="degree-0" kind="degrees" value={first.degree} onChange={(value) => setEntry(0, "degree", value)} maxLength={120} />
        </Field>
        <Field label="Major" hint="Optional, but it helps me find jobs that fit." htmlFor="major-0">
          <SearchableInput id="major-0" kind="fields" value={first.major} onChange={(value) => setEntry(0, "major", value)} maxLength={160} />
        </Field>
      </div>

      <details open={more} className="group mt-6 rounded-xl border bg-background">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-[14px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          More details (optional)
          <span className="text-[12.5px] font-normal text-muted-foreground group-open:hidden">GPA, honors, phone, LinkedIn, skills</span>
        </summary>
        <div className="space-y-5 border-t p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="GPA" hint="Leave it off if it's under 3.0." htmlFor="gpa-0">
              <Input id="gpa-0" inputMode="decimal" value={first.gpa} onChange={(e) => setEntry(0, "gpa", e.target.value)} maxLength={4} placeholder="3.6" className="h-10" />
            </Field>
            <Field label="Honors" hint="Dean's List, scholarships." htmlFor="honors-0">
              <Input id="honors-0" value={first.honors} onChange={(e) => setEntry(0, "honors", e.target.value)} maxLength={300} className="h-10" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Coursework" hint="Classes you'd want an employer to see." htmlFor="coursework-0">
                <Textarea id="coursework-0" value={first.coursework} onChange={(e) => setEntry(0, "coursework", e.target.value)} maxLength={600} rows={2} className="text-[14px] leading-6" />
              </Field>
            </div>
            <EducationDetails entry={first} index={0} setEntries={setEntries} />
          </div>

          {entries.slice(1).map((entry, offset) => {
            const index = offset + 1;
            return (
              <div key={entry.entryId || `new-${index}`} className="rounded-xl border p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-[14px] font-medium">School {index + 1}</p>
                  <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setEntries((list) => list.filter((_, i) => i !== index))}>
                    Remove
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field label="School" htmlFor={`school-${index}`}>
                      <SearchableInput id={`school-${index}`} kind="schools" value={entry.school} onChange={(value) => setEntry(index, "school", value)} required maxLength={200} />
                    </Field>
                  </div>
                  <Field label="Degree" htmlFor={`degree-${index}`}>
                    <SearchableInput id={`degree-${index}`} kind="degrees" value={entry.degree} onChange={(value) => setEntry(index, "degree", value)} maxLength={120} />
                  </Field>
                  <Field label="Major" htmlFor={`major-${index}`}>
                    <SearchableInput id={`major-${index}`} kind="fields" value={entry.major} onChange={(value) => setEntry(index, "major", value)} maxLength={160} />
                  </Field>
                  <Field label="Graduation month" htmlFor={`gradDate-${index}`}>
                    <Input id={`gradDate-${index}`} type="month" value={entry.gradDate} onChange={(e) => setEntry(index, "gradDate", e.target.value)} required className="h-10" />
                  </Field>
                  <Field label="GPA" htmlFor={`gpa-${index}`}>
                    <Input id={`gpa-${index}`} inputMode="decimal" value={entry.gpa} onChange={(e) => setEntry(index, "gpa", e.target.value)} maxLength={4} className="h-10" />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Honors" htmlFor={`honors-${index}`}>
                      <Input id={`honors-${index}`} value={entry.honors} onChange={(e) => setEntry(index, "honors", e.target.value)} maxLength={300} className="h-10" />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Coursework" htmlFor={`coursework-${index}`}>
                      <Textarea id={`coursework-${index}`} value={entry.coursework} onChange={(e) => setEntry(index, "coursework", e.target.value)} maxLength={600} rows={2} className="text-[14px] leading-6" />
                    </Field>
                  </div>
                  <EducationDetails entry={entry} index={index} setEntries={setEntries} />
                </div>
              </div>
            );
          })}
          {entries.length < 6 && (
            <Button type="button" size="sm" variant="outline" onClick={() => setEntries((list) => [...list, blankEdu()])}>
              <Plus data-icon="inline-start" />
              Add another school
            </Button>
          )}

          <div className="grid gap-4 border-t pt-5 sm:grid-cols-2">
            <Field label="Phone" hint="Recruiters look for it." htmlFor="phone">
              <Input id="phone" type="tel" value={v.phone} onChange={(e) => set("phone")(e.target.value)} maxLength={40} className="h-10" />
            </Field>
            <Field label="Email on your resume" hint="Blank means no email on the resume." htmlFor="contactEmail">
              <Input id="contactEmail" type="email" autoComplete="email" value={v.contactEmail} onChange={(e) => set("contactEmail")(e.target.value)} maxLength={254} className="h-10" />
            </Field>
            <Field label="LinkedIn" htmlFor="linkedinUrl">
              <Input id="linkedinUrl" value={v.linkedinUrl} onChange={(e) => set("linkedinUrl")(e.target.value)} maxLength={300} className="h-10" />
            </Field>
            <Field label="Website" hint="A personal site or GitHub." htmlFor="portfolioUrl">
              <Input id="portfolioUrl" value={v.portfolioUrl} onChange={(e) => set("portfolioUrl")(e.target.value)} maxLength={300} className="h-10" />
            </Field>
            <Field label="City" htmlFor="city">
              <Input id="city" value={v.city} onChange={(e) => set("city")(e.target.value)} maxLength={80} className="h-10" />
            </Field>
            <Field label="State" htmlFor="region">
              <Input id="region" value={v.region} onChange={(e) => set("region")(e.target.value)} maxLength={80} className="h-10" />
            </Field>
          </div>

          <div className="space-y-4 border-t pt-5">
            <Field label="Skills and tools" hint="Only ones you'd be fine being asked about. Press Enter after each." htmlFor="skills">
              <ChipInput id="skills" value={skills} onChange={setSkills} placeholder="Excel, QuickBooks, Spanish" />
            </Field>
            <Field label="Licenses and certificates" htmlFor="licenses">
              <ChipInput id="licenses" value={licenses} onChange={setLicenses} placeholder="Food Handler Certificate, CPR" />
            </Field>
          </div>
        </div>
      </details>

      <ErrorLine error={error} />
      <Nav backHref={data.importing ? "/app/facts" : "/app"}>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Save and continue
          {!pending && <ArrowRight data-icon="inline-end" />}
        </Button>
      </Nav>
      <p className="mt-3 text-[12.5px] text-subtle-foreground sm:text-right">Saving confirms these details are right. You can change them any time.</p>
    </form>
  );
}

/** Lines from a resume's education section that don't fit a field. Each one needs its own tick. */
function EducationDetails({ entry, index, setEntries }: { entry: EduForm; index: number; setEntries: React.Dispatch<React.SetStateAction<EduForm[]>> }) {
  if (!entry.details.length) return null;
  const setDetail = (detailIndex: number, patch: Partial<EduForm["details"][number]>) =>
    setEntries((all) => all.map((school, i) => (i === index ? { ...school, details: school.details.map((line, j) => (j === detailIndex ? { ...line, ...patch } : line)) } : school)));
  return (
    <div className="space-y-3 sm:col-span-2">
      <p className="text-[13px] text-muted-foreground">Other lines from your resume for this school. Only the ones you tick are saved.</p>
      {entry.details.map((detail, detailIndex) => (
        <div key={detailIndex} className="rounded-lg border p-3">
          <Input aria-label={`Education detail ${index + 1}, line ${detailIndex + 1}`} value={detail.text} maxLength={200} onChange={(e) => setDetail(detailIndex, { text: e.target.value, confirmed: false })} />
          <ConfirmBox checked={detail.confirmed} onChange={(checked) => setDetail(detailIndex, { confirmed: checked })} className="mt-2">
            Keep this line. It&apos;s true.
          </ConfirmBox>
        </div>
      ))}
    </div>
  );
}

type EduForm = { entryId: string; school: string; degree: string; major: string; gradDate: string; gpa: string; honors: string; coursework: string; details: Array<{ text: string; confirmed: boolean }> };

function blankEdu(): EduForm {
  return { entryId: "", school: "", degree: "", major: "", gradDate: "", gpa: "", honors: "", coursework: "", details: [] };
}

function initialSchools(data: BetaOnboardingData, draft: ResumeDraft | null): EduForm[] {
  // Schools from a resume are already limited to ones this account doesn't have.
  const imported = (draft?.education ?? []).filter((entry) => entry.school.trim()).map((entry) => ({ entryId: "", ...entry, details: entry.details.map((text) => ({ text, confirmed: false })) }));
  if (data.education.length) return [...data.education.map((entry) => ({ ...entry, details: [] })), ...imported];
  if (imported.length) return imported;
  const school = data.basics.school || draft?.basics.school || "";
  if (!school) return [blankEdu()];
  return [{
    entryId: "",
    school,
    degree: data.basics.degree || draft?.basics.degree || "",
    major: data.basics.major || draft?.basics.major || "",
    gradDate: data.basics.gradDate || draft?.basics.gradDate || "",
    gpa: data.basics.gpa || draft?.basics.gpa || "",
    honors: "",
    coursework: "",
    details: [],
  }];
}

const KINDS = [
  { value: "work", label: "Job" },
  { value: "internship", label: "Internship" },
  { value: "leadership", label: "Club or leadership" },
  { value: "volunteer", label: "Volunteering" },
  { value: "project", label: "Project" },
] as const;

type RoleForm = { kind: string; org: string; title: string; startDate: string; endDate: string; description: string };
type ActiveRole = { id: string; name: string; kind: string; ended: boolean; description: string; imported: string[] };

/**
 * Screen 2. One role at a time: title, place, dates, and what they did in plain
 * words. Saving drafts recommended lines from that, and the person keeps, edits,
 * or drops each one. Jobs, clubs, volunteering, and projects all go here.
 */
function ExperienceScreen({
  project,
  startOpen,
  roles,
  drafts,
  onDraftSaved,
  onBack,
  onContinue,
}: {
  project: boolean;
  startOpen: boolean;
  roles: BetaOnboardingData["roles"];
  /** Roles read from their resume and not saved yet. */
  drafts: RoleDraft[];
  onDraftSaved: (key: string) => void;
  onBack: () => void;
  /** Null until one role is saved: that's the minimum for a resume. */
  onContinue: (() => void) | null;
}) {
  const router = useRouter();
  const blank: RoleForm = { kind: project ? "project" : "work", org: "", title: "", startDate: "", endDate: "", description: "" };
  const fromDraft = (d: RoleDraft): RoleForm => ({ kind: d.kind, org: d.org, title: d.title, startDate: d.startDate, endDate: d.endDate, description: "" });
  const [editing, setEditing] = useState<RoleDraft | null>(roles.length === 0 ? drafts[0] ?? null : null);
  const [v, setV] = useState<RoleForm>(() => (editing ? fromDraft(editing) : blank));
  const [open, setOpen] = useState(roles.length === 0 || startOpen);
  const [active, setActive] = useState<ActiveRole | null>(null);
  const [kept, setKept] = useState(0);
  const { pending, error, save } = useSave();
  const isProject = isProjectKind(v.kind);
  const review = (d: RoleDraft) => {
    setEditing(d);
    setV(fromDraft(d));
    setActive(null);
    setOpen(true);
  };

  const submit = () => {
    const imported = editing ? countableRoleLines(editing.bullets) : [];
    let saved = "";
    save(
      async () => {
        const result = await saveRoleStepAction({ kind: v.kind as "work", org: v.org, title: v.title, startDate: v.startDate, endDate: v.endDate, description: v.description, bullets: [], confirmed: true });
        if (result.ok) saved = result.experienceId;
        return result.ok ? { ok: true } : result;
      },
      () => {
        if (editing) onDraftSaved(editing.key);
        // A project with no dates is finished work; a role with a start and no end is current.
        const ended = Boolean(v.endDate) || !v.startDate;
        setActive({ id: saved, name: [v.title, v.org].filter(Boolean).join(", "), kind: v.kind, ended, description: v.description, imported });
        setKept(0);
        setEditing(null);
        setV(blank);
        setOpen(false);
        router.refresh();
      },
    );
  };

  const nextDraft = drafts.find((d) => d.key !== editing?.key);
  const saved = roles.filter((r) => r.id !== active?.id);

  return (
    <div>
      <Heading
        title={project ? "Any projects?" : "What have you done so far?"}
        hint={
          project
            ? "Class projects, personal builds, research, or club work. Tell me what you did and I'll draft the resume lines."
            : "Jobs, internships, clubs, volunteering, and class projects all count. Start with the one you'd most want an employer to see. I'll draft the resume lines."
        }
      />

      {saved.length > 0 && (
        <ul className="mt-6 space-y-2">
          {saved.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-lg border bg-background p-3 text-[14px]">
              <Check className="size-4 shrink-0 text-brand" strokeWidth={3} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
              <span className="shrink-0 text-[12.5px] text-muted-foreground">
                {r.lines} {r.lines === 1 ? "line" : "lines"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <section aria-labelledby="active-role" className="mt-6 rounded-2xl border bg-background p-4 shadow-lift sm:p-5">
          <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-brand-ink">
            <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
            Saved
          </p>
          <h2 id="active-role" className="mt-0.5 font-display text-[19px] font-semibold">
            {active.name}
          </h2>
          <DraftLines
            key={active.id}
            className="mt-4"
            experienceId={active.id}
            kind={active.kind}
            ended={active.ended}
            description={active.description}
            imported={active.imported}
            autoDraft
            onKeptChange={setKept}
          />
        </section>
      )}

      {nextDraft && !open && (
        <div className="mt-6 rounded-xl border border-dashed border-border-strong p-4">
          <p className="text-[13px] font-medium">Also on your resume, not saved yet</p>
          <ul className="mt-2 space-y-1.5">
            {drafts
              .filter((d) => d.key !== editing?.key)
              .map((d) => (
                <li key={d.key} className="flex items-center gap-2 text-[14px]">
                  <span className="min-w-0 flex-1 truncate">{[d.title, d.org].filter(Boolean).join(", ")}</span>
                  <Button size="sm" variant="outline" type="button" onClick={() => review(d)}>
                    Add this one
                  </Button>
                </li>
              ))}
          </ul>
        </div>
      )}

      {open ? (
        <form
          className="mt-6 space-y-4 rounded-2xl border bg-background p-4 sm:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {editing && (
            <p className="rounded-lg bg-brand-soft/60 px-3 py-2 text-[13px] leading-5 text-brand-ink">
              Read from your resume. Fix anything that isn&apos;t exactly right. You&apos;ll check its lines one by one next.
            </p>
          )}
          <PillChoice label="What kind" options={KINDS} value={[v.kind as (typeof KINDS)[number]["value"]]} onChange={(next) => next[0] && setV((x) => ({ ...x, kind: next[0] }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={isProject ? "Your role (optional)" : "Your title"} htmlFor="title">
              <SearchableInput id="title" kind="roles" value={v.title} onChange={(title) => setV((x) => ({ ...x, title }))} maxLength={160} />
            </Field>
            <Field label={isProject ? "Project name" : "Where"} hint={isProject ? undefined : "Company, club, or organization"} htmlFor="org">
              <Input id="org" value={v.org} onChange={(e) => setV((x) => ({ ...x, org: e.target.value }))} required maxLength={160} className="h-10" />
            </Field>
            <Field label={isProject ? "Start (optional)" : "Start"} htmlFor="start">
              <Input id="start" type="month" value={v.startDate} onChange={(e) => setV((x) => ({ ...x, startDate: e.target.value }))} required={!isProject} className="h-10" />
            </Field>
            <Field label="End" hint="Leave blank if you're still there." htmlFor="end">
              <Input id="end" type="month" value={v.endDate} onChange={(e) => setV((x) => ({ ...x, endDate: e.target.value }))} className="h-10" />
            </Field>
          </div>
          <Field label={editing ? "Anything your resume left out? (optional)" : "What did you do there?"} hint="Plain words are fine. Put in any numbers you remember." htmlFor="describe">
            <Textarea
              id="describe"
              value={v.description}
              onChange={(e) => setV((x) => ({ ...x, description: e.target.value }))}
              rows={3}
              maxLength={4000}
              placeholder={isProject ? "Built a budget tracker in Google Sheets so 12 club members could log dues" : "Worked the register, about 50 customers a shift. Restocked shelves and trained 2 new hires."}
              className="text-[14px] leading-6"
            />
          </Field>
          <ErrorLine error={error} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? <LoaderCircle className="animate-spin" /> : null}
              {v.description.trim() || editing?.bullets.length ? "Save and draft my lines" : "Save this role"}
            </Button>
            {(roles.length > 0 || editing) && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setEditing(null);
                  setV(blank);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
          <p className="text-[12.5px] text-subtle-foreground">Saving confirms the title, place, and dates are right.</p>
        </form>
      ) : (
        <Button
          variant="outline"
          className="mt-4 bg-background"
          onClick={() => {
            setEditing(null);
            setV(blank);
            setActive(null);
            setOpen(true);
          }}
        >
          <Plus data-icon="inline-start" />
          Add another
        </Button>
      )}

      <Nav onBack={onBack}>
        {onContinue && !open && (
          <Button size="lg" type="button" onClick={onContinue} disabled={pending}>
            Continue
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </Nav>
      {active && kept === 0 && !open && (
        <p className="mt-3 text-[12.5px] text-subtle-foreground sm:text-right">Keep at least one line so this role has something under it on your resume. Drafts you don&apos;t keep aren&apos;t saved.</p>
      )}
    </div>
  );
}

function ListsScreen({ data, draft, onBack, onDone, onSkip }: { data: BetaOnboardingData; draft: ResumeDraft | null; onBack: () => void; onDone: () => void; onSkip: () => void }) {
  const merge = (saved: string[], read: string[] = []) => [...saved, ...read.filter((x) => !saved.some((y) => y.toLowerCase() === x.toLowerCase()))];
  const [skills, setSkills] = useState<string[]>(() => merge(data.skills, draft?.skills));
  const [licenses, setLicenses] = useState<string[]>(() => merge(data.licenses, draft?.licenses));
  const { pending, error, save } = useSave();
  const changed = skills.length !== data.skills.length || licenses.length !== data.licenses.length;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!changed) return onDone();
        save(() => saveListsStepAction({ skills, licenses, confirmed: true }), onDone);
      }}
    >
      <Heading title="Skills and licenses" hint="Only list what you'd be comfortable being asked about in an interview. Press Enter after each one." />
      <div className="mt-6 space-y-5">
        <Field label="Skills and tools" htmlFor="skills">
          <ChipInput id="skills" value={skills} onChange={setSkills} placeholder="Excel, QuickBooks, Spanish" />
        </Field>
        <Field label="Licenses and certifications" htmlFor="licenses">
          <ChipInput id="licenses" value={licenses} onChange={setLicenses} placeholder="Food Handler Certificate, CPR" />
        </Field>
      </div>
      <p className="mt-6 text-[12.5px] text-subtle-foreground">Saving confirms you have these.</p>
      <ErrorLine error={error} />
      <Nav onBack={onBack} onSkip={onSkip}>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Continue
          {!pending && <ArrowRight data-icon="inline-end" />}
        </Button>
      </Nav>
    </form>
  );
}

const AUTH_OPTIONS = [
  { value: "us_citizen", label: "U.S. citizen" },
  { value: "permanent_resident", label: "Permanent resident" },
  { value: "authorized", label: "Authorized, no sponsorship needed" },
  { value: "needs_sponsorship", label: "I'll need visa sponsorship" },
] as const;
const MODE_OPTIONS = [
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
] as const;
const RELOCATE_OPTIONS = [
  { value: "yes", label: "Yes, I'd move" },
  { value: "no", label: "No" },
] as const;

function LogisticsScreen({ data, onBack, onDone, onSkip }: { data: BetaOnboardingData; onBack: () => void; onDone: () => void; onSkip: () => void }) {
  const [v, setV] = useState(data.logistics);
  const { pending, error, save } = useSave();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(() => saveLogisticsStepAction({ ...v, workAuthorization: v.workAuthorization as "" }), onDone);
      }}
    >
      <Heading
        title="Where and when can you work?"
        hint="This never goes on a resume. It lets me warn you about a job you can't take, like one that needs a visa you don't have or a city you can't move to."
      />
      <div className="mt-6 space-y-6">
        <Field label="Work authorization in the U.S.">
          <PillChoice label="Work authorization" options={AUTH_OPTIONS} value={v.workAuthorization ? [v.workAuthorization as (typeof AUTH_OPTIONS)[number]["value"]] : []} onChange={(next) => setV((x) => ({ ...x, workAuthorization: next[0] ?? "" }))} />
        </Field>
        <Field label="Places you can work" hint="Cities or states. Press Enter after each one." htmlFor="places">
          <ChipInput id="places" value={v.targetLocations} onChange={(targetLocations) => setV((x) => ({ ...x, targetLocations }))} placeholder="Raleigh, NC" />
        </Field>
        <Field label="Work setups that work for you">
          <PillChoice label="Work setups" multiple options={MODE_OPTIONS} value={v.workModes} onChange={(workModes) => setV((x) => ({ ...x, workModes }))} />
        </Field>
        <Field label="Would you move for the right job?">
          <PillChoice label="Relocation" options={RELOCATE_OPTIONS} value={v.openToRelocate ? [v.openToRelocate] : []} onChange={(next) => setV((x) => ({ ...x, openToRelocate: next[0] ?? "" }))} />
        </Field>
        <Field label="Earliest month you can start" htmlFor="available">
          <Input id="available" type="month" value={v.availableFrom} onChange={(e) => setV((x) => ({ ...x, availableFrom: e.target.value }))} className="h-10 max-w-56" />
        </Field>
      </div>
      <ErrorLine error={error} />
      <Nav onBack={onBack} onSkip={onSkip}>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Continue
          {!pending && <ArrowRight data-icon="inline-end" />}
        </Button>
      </Nav>
    </form>
  );
}


/** Screen 3. Paste a job, then go straight to the resume made for it. */
function JobScreen({ onBack, needs, onFix }: { onBack: () => void; needs: "education" | "experience" | null; onFix: (step: OnboardingStep) => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const finish = (href: (id?: string) => string) => (jobId?: string) =>
    new Promise<void>((resolve) =>
      start(async () => {
        const result = await finishOnboardingStepAction().catch(() => ({ ok: false as const, error: "Couldn't reach the server. Try again." }));
        if (!result.ok) setError(result.error);
        else router.push(href(jobId));
        resolve();
      }),
    );

  if (needs) {
    return (
      <div>
        <Heading title="One thing first" hint={needs === "education" ? "Add your school so I know what to put on your resume." : "Add one job, club, volunteer role, or project. A resume needs something under Experience."} />
        <Button className="mt-6" size="lg" onClick={() => onFix(needs)}>
          {needs === "education" ? "Add your school" : "Add an experience"}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Heading title="Paste a job you want" hint="Copy the link from LinkedIn, Indeed, Handshake, or a company site, or paste the whole posting. I'll make a one-page resume for it from what you just told me." />
      <PasteJobBox className="mt-6" autoFocus submitLabel="Make my resume" onIngested={finish((id) => `/app/jobs/${id}?tab=resume`)} />
      <ErrorLine error={error} />
      <Nav onBack={onBack} onSkip={() => void finish(() => "/app/find")()} skipLabel="Help me find one">
        {pending && <LoaderCircle className="size-4 animate-spin text-muted-foreground" />}
      </Nav>
    </div>
  );
}

const DRAFT_KEY = "proofline:resume-draft";

/**
 * "Start from your resume": reads a PDF, DOCX, or pasted text into these screens.
 * Nothing is saved until the person checks each screen and confirms it.
 */
function ResumeImport({ draft, onDraft, importing = false }: { draft: ResumeDraft | null; onDraft: (d: ResumeDraft) => void; importing?: boolean }) {
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const read = (form: FormData) =>
    start(async () => {
      setError(null);
      const res = await fetch("/api/onboarding/resume-draft", { method: "POST", body: form }).catch(() => null);
      const data = res ? ((await res.json().catch(() => null)) as DraftResponse | null) : null;
      if (!data) {
        setError("Couldn't reach Proofline. Check your connection and try again.");
        return;
      }
      if (!data.ok) {
        setError(data.error);
        return;
      }
      onDraft(data.draft);
    });

  if (draft) {
    return (
      <div className="mt-6 rounded-xl border border-brand/30 bg-brand-soft/40 px-4 py-3 text-[13.5px] leading-6">
        <p className="flex items-center gap-2 font-medium">
          <Check className="size-4 text-brand" strokeWidth={3} aria-hidden="true" />
          {importing
            ? `Read your resume. New to your account: ${draft.education.length} ${draft.education.length === 1 ? "school" : "schools"}, ${draft.roles.length} ${draft.roles.length === 1 ? "role or project" : "roles and projects"}.`
            : `Read your resume: ${draft.roles.length} ${draft.roles.length === 1 ? "role" : "roles"} and ${draft.skills.length} ${draft.skills.length === 1 ? "skill" : "skills"}.`}
        </p>
        <p className="text-muted-foreground">
          {importing
            ? "Roles and schools you already saved are left alone. Check each screen, add what's new, and confirm it; skills you don't have yet are added on the skills screen."
            : "I filled in what I found. Fix anything that's off. Nothing is saved until you press save, and you'll check each resume line on the next screen."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] font-medium">Have a resume? Start from it and skip most of the typing.</p>
        <button type="button" onClick={() => setMode(mode === "file" ? "paste" : "file")} className="text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
          {mode === "file" ? "Paste text instead" : "Upload a file instead"}
        </button>
      </div>
      <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">I&apos;ll fill in these screens for you to check. It takes a few seconds.</p>
      {mode === "file" ? (
        <label className={cn("mt-3 flex min-h-20 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong bg-background px-4 text-[14px] transition-colors hover:bg-muted/50", pending && "pointer-events-none opacity-60")}>
          {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4 text-muted-foreground" aria-hidden="true" />}
          {pending ? "Reading your resume" : "Choose a PDF or DOCX"}
          <input
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            disabled={pending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const form = new FormData();
              form.set("resume", file);
              read(form);
            }}
          />
        </label>
      ) : (
        <div className="mt-3">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={30_000} placeholder="Paste your whole resume" className="bg-background text-[14px] leading-6" aria-label="Your resume" />
          <Button
            type="button"
            size="sm"
            className="mt-2"
            disabled={pending || text.trim().length < 80}
            onClick={() => {
              const form = new FormData();
              form.set("text", text);
              read(form);
            }}
          >
            {pending ? <LoaderCircle className="animate-spin" /> : <FileText data-icon="inline-start" />}
            Read my resume
          </Button>
        </div>
      )}
      <ErrorLine error={error} />
    </div>
  );
}
