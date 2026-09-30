"use client";

import { useEffect, useState, useTransition } from "react";
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
import { importedRoleHasOneLine, linesForRoleForm, roleStepHint } from "./role-step";
import { ABOUT_SCREENS, PROGRESS_STEPS, type OnboardingStep } from "@/app/app/onboarding/steps";
import { PasteJobBox } from "@/components/coach/paste-job-box";
import { RoleRecall } from "@/components/profile/role-recall";
import { ConfirmBox } from "@/components/facts/confirm-box";
import { SearchableInput } from "@/components/shared/searchable-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DraftResponse } from "@/app/api/onboarding/resume-draft/route";
import { Textarea } from "@/components/ui/textarea";
import { confirmedEducationDetails, newToAccount, type ResumeDraft, type RoleDraft } from "@/lib/onboarding/draft";
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
  /** Came from My facts to import a resume into an account that already has facts. */
  importing: boolean;
  /** Came from a knockout or Settings to fix one thing: go back there after it. */
  returnTo: string | null;
};

const SCREEN_TITLE: Record<(typeof ABOUT_SCREENS)[number], string> = {
  education: "Education",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills and licenses",
  logistics: "Where and when you can work",
};

export function BetaOnboarding({ data }: { data: BetaOnboardingData }) {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>(data.step === "done" ? "job" : data.step);
  const [, start] = useTransition();
  const [draft, setDraftState] = useState<ResumeDraft | null>(null);
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
    if (draft) setDraft({ ...draft, roles: draft.roles.filter((r) => r.key !== key) });
  };
  const isProject = (kind: string) => kind === "project" || kind === "research";
  const aboutIndex = (ABOUT_SCREENS as readonly string[]).indexOf(step);
  const progress = step === "job" ? 1 : 0;

  // A resume adds only the schools and roles this account doesn't have yet.
  const readDraft = (next: ResumeDraft) =>
    setDraft(newToAccount(next, { schools: data.education, roles: data.roles }));

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
  const hasRole = data.roles.some((r) => r.kind !== "project" && r.kind !== "research");

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-12">
      <ol aria-label="Progress" className="grid grid-cols-3 gap-1.5">
        {PROGRESS_STEPS.map((s, i) => (
          <li key={s.id}>
            <span className="block h-1 overflow-hidden rounded-full bg-muted">
              <span className={cn("block h-full rounded-full transition-[width] duration-500", i < progress ? "w-full bg-brand" : i === progress ? "w-1/2 bg-ink" : "w-0")} />
            </span>
            <span className={cn("mt-1.5 block text-[11.5px] leading-4", i === progress ? "font-medium text-foreground" : "text-subtle-foreground")}>
              <span className="tabular-nums">{i + 1}.</span> {s.label}
            </span>
          </li>
        ))}
      </ol>

      <div key={step} className="mt-8 motion-safe:animate-view-in">
        {aboutIndex >= 0 && (
          <p className="text-[12.5px] font-medium text-brand-ink">
            Step 1 · {SCREEN_TITLE[step as (typeof ABOUT_SCREENS)[number]]} <span className="font-normal text-subtle-foreground">({aboutIndex + 1} of {ABOUT_SCREENS.length})</span>
          </p>
        )}
        {step === "education" && <EducationScreen key={draft ? "draft" : "blank"} data={data} draft={draft} onDraft={readDraft} onDone={() => go("experience")} />}
        {step === "experience" && (
          <RoleScreen
            key="experience"
            project={false}
            roles={data.roles.filter((r) => r.kind !== "project" && r.kind !== "research")}
            drafts={draft?.roles.filter((r) => !isProject(r.kind)) ?? []}
            onDraftSaved={doneWithDraft}
            onBack={() => go("education")}
            onContinue={hasRole ? () => go("projects") : null}
          />
        )}
        {step === "projects" && (
          <RoleScreen
            key="projects"
            project
            roles={data.roles.filter((r) => r.kind === "project" || r.kind === "research")}
            drafts={draft?.roles.filter((r) => isProject(r.kind)) ?? []}
            onDraftSaved={doneWithDraft}
            onBack={() => go("experience")}
            onContinue={() => go("skills")}
            onSkip={() => go("skills")}
          />
        )}
        {step === "skills" && <ListsScreen data={data} draft={draft} onBack={() => go("projects")} onDone={() => go("logistics")} onSkip={() => go("logistics")} />}
        {step === "logistics" && <LogisticsScreen data={data} onBack={() => go("skills")} onDone={() => go("job")} onSkip={() => go("job")} />}
        {step === "job" && <JobScreen onBack={() => go("logistics")} needs={!data.hasEducation ? "education" : !hasRole ? "experience" : null} onFix={go} />}
      </div>
    </div>
  );
}

function Heading({ title, hint }: { title: string; hint: string }) {
  return (
    <>
      <h1 className="mt-1 font-display text-[28px] leading-tight font-semibold sm:text-[34px]">{title}</h1>
      <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{hint}</p>
    </>
  );
}

function Nav({ onBack, backHref, onSkip, children }: { onBack?: () => void; backHref?: string; onSkip?: () => void; children?: React.ReactNode }) {
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
            Skip for now
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

function EducationScreen({ data, draft, onDraft, onDone }: { data: BetaOnboardingData; draft: ResumeDraft | null; onDraft: (d: ResumeDraft) => void; onDone: () => void }) {
  // What they've already saved wins; the resume fills only what's still empty.
  const [v, setV] = useState(() =>
    draft ? (Object.fromEntries(Object.entries(data.basics).map(([k, value]) => [k, value || draft.basics[k as keyof typeof data.basics]])) as typeof data.basics) : data.basics,
  );
  const [entries, setEntries] = useState(() => initialSchools(data, draft));
  const [confirmed, setConfirmed] = useState(false);
  const { pending, error, save } = useSave();
  const set = (key: keyof typeof v) => (value: string) => setV((x) => ({ ...x, [key]: value }));
  const setEntry = (index: number, key: keyof EduForm, value: string) => setEntries((list) => list.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const filled = entries.filter((entry) => entry.school.trim());
        save(
          () =>
            saveEducationStepAction({
              fullName: v.fullName,
              phone: v.phone,
              city: v.city,
              region: v.region,
              contactEmail: v.contactEmail,
              linkedinUrl: v.linkedinUrl,
              portfolioUrl: v.portfolioUrl,
              entries: filled.map((entry) => ({ ...entry, entryId: entry.entryId || undefined, details: confirmedEducationDetails(entry.details) })),
              confirmed: confirmed as true,
            }),
          onDone,
        );
      }}
    >
      {data.importing ? (
        <Heading title="Import from your resume" hint="We add the schools, roles, and skills you haven't saved yet, for you to check on each screen. What's already on My facts stays as it is." />
      ) : (
        <Heading title={`Hi ${data.firstName}. Tell us about yourself.`} hint="Add each school you want on your resume. Honors and coursework are optional. Only what you type here is saved." />
      )}
      {((!data.hasEducation && data.roles.length === 0) || data.importing) && <ResumeImport draft={draft} onDraft={onDraft} importing={data.importing} />}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Name on your resume" htmlFor="fullName">
          <Input id="fullName" value={v.fullName} onChange={(e) => set("fullName")(e.target.value)} required maxLength={120} className="h-10" />
        </Field>
        <Field label="Phone" hint="Optional, but recruiters look for it." htmlFor="phone">
          <Input id="phone" type="tel" value={v.phone} onChange={(e) => set("phone")(e.target.value)} maxLength={40} className="h-10" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Email on your resume" hint="Optional. This is the address on the resume. Your sign-in email stays separate. Leave it blank and the resume shows no email." htmlFor="contactEmail">
            <Input id="contactEmail" type="email" autoComplete="email" value={v.contactEmail} onChange={(e) => set("contactEmail")(e.target.value)} maxLength={254} className="h-10" />
          </Field>
        </div>
        <Field label="LinkedIn" hint="Optional." htmlFor="linkedinUrl">
          <Input id="linkedinUrl" value={v.linkedinUrl} onChange={(e) => set("linkedinUrl")(e.target.value)} maxLength={300} className="h-10" />
        </Field>
        <Field label="Website" hint="Optional. A personal site or GitHub." htmlFor="portfolioUrl">
          <Input id="portfolioUrl" value={v.portfolioUrl} onChange={(e) => set("portfolioUrl")(e.target.value)} maxLength={300} className="h-10" />
        </Field>
        <Field label="City" htmlFor="city">
          <Input id="city" value={v.city} onChange={(e) => set("city")(e.target.value)} maxLength={80} className="h-10" />
        </Field>
        <Field label="State" htmlFor="region">
          <Input id="region" value={v.region} onChange={(e) => set("region")(e.target.value)} maxLength={80} className="h-10" />
        </Field>
      </div>
      <div className="mt-6 space-y-4">
        {entries.map((entry, index) => (
          <div key={entry.entryId || `new-${index}`} className="rounded-xl border bg-background p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[14px] font-medium">{entries.length > 1 ? `School ${index + 1}` : "School"}</p>
              {entries.length > 1 && (
                <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setEntries((list) => list.filter((_, i) => i !== index))}>
                  Remove
                </Button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="School" htmlFor={`school-${index}`}>
                  <SearchableInput id={`school-${index}`} kind="schools" value={entry.school} onChange={(value) => setEntry(index, "school", value)} required maxLength={200} />
                </Field>
              </div>
              <Field label="Degree" hint="For example B.S. or Associate's" htmlFor={`degree-${index}`}>
                <SearchableInput id={`degree-${index}`} kind="degrees" value={entry.degree} onChange={(value) => setEntry(index, "degree", value)} maxLength={120} />
              </Field>
              <Field label="Major" htmlFor={`major-${index}`}>
                <SearchableInput id={`major-${index}`} kind="fields" value={entry.major} onChange={(value) => setEntry(index, "major", value)} maxLength={160} />
              </Field>
              <Field label="Graduation (expected is fine)" htmlFor={`gradDate-${index}`}>
                <Input id={`gradDate-${index}`} type="month" value={entry.gradDate} onChange={(e) => setEntry(index, "gradDate", e.target.value)} required className="h-10" />
              </Field>
              <Field label="GPA" hint="Optional. Leave it off if it's under 3.0." htmlFor={`gpa-${index}`}>
                <Input id={`gpa-${index}`} inputMode="decimal" value={entry.gpa} onChange={(e) => setEntry(index, "gpa", e.target.value)} maxLength={4} placeholder="3.6" className="h-10" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Honors" hint="Optional. Dean's List, or leave it blank." htmlFor={`honors-${index}`}>
                  <Input id={`honors-${index}`} value={entry.honors} onChange={(e) => setEntry(index, "honors", e.target.value)} maxLength={300} className="h-10" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Coursework" hint="Optional. The classes you want listed." htmlFor={`coursework-${index}`}>
                  <Textarea id={`coursework-${index}`} value={entry.coursework} onChange={(e) => setEntry(index, "coursework", e.target.value)} maxLength={600} rows={2} className="text-[14px] leading-6" />
                </Field>
              </div>
              {entry.details.length > 0 && <div className="space-y-3 sm:col-span-2">
                <p className="text-[13px] text-muted-foreground">Other lines from this education entry. Check each one before it is saved.</p>
                {entry.details.map((detail, detailIndex) => <div key={detailIndex} className="rounded-lg border p-3">
                  <Input aria-label={`Education detail ${index + 1}, line ${detailIndex + 1}`} value={detail.text} maxLength={200} onChange={(e) => setEntries((all) => all.map((school, i) => i === index ? { ...school, details: school.details.map((line, j) => j === detailIndex ? { text: e.target.value, confirmed: false } : line) } : school))} />
                  <ConfirmBox checked={detail.confirmed} onChange={(checked) => setEntries((all) => all.map((school, i) => i === index ? { ...school, details: school.details.map((line, j) => j === detailIndex ? { ...line, confirmed: checked } : line) } : school))} className="mt-2" />
                </div>)}
              </div>}
            </div>
          </div>
        ))}
        {entries.length < 6 && (
          <Button type="button" size="sm" variant="outline" onClick={() => setEntries((list) => [...list, blankEdu()])}>
            <Plus data-icon="inline-start" />
            Add another school
          </Button>
        )}
      </div>
      <ConfirmBox checked={confirmed} onChange={setConfirmed} className="mt-6" />
      <ErrorLine error={error} />
      <Nav backHref={data.importing ? "/app/facts" : "/app"}>
        <Button type="submit" size="lg" disabled={pending || !confirmed}>
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Continue
          {!pending && <ArrowRight data-icon="inline-end" />}
        </Button>
      </Nav>
      <p className="mt-3 text-[12.5px] text-subtle-foreground">Education and one experience are the minimum to score a job. Everything after that can be skipped.</p>
    </form>
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

const ROLE_KINDS = [
  { value: "work", label: "Job" },
  { value: "internship", label: "Internship" },
  { value: "leadership", label: "Club or leadership" },
  { value: "volunteer", label: "Volunteering" },
] as const;
const PROJECT_KINDS = [
  { value: "project", label: "Project" },
  { value: "research", label: "Research" },
] as const;

function RoleScreen({
  project,
  roles,
  drafts,
  onDraftSaved,
  onBack,
  onContinue,
  onSkip,
}: {
  project: boolean;
  roles: BetaOnboardingData["roles"];
  /** Roles read from their resume and not saved yet. */
  drafts: RoleDraft[];
  onDraftSaved: (key: string) => void;
  onBack: () => void;
  /** Null until at least one experience is saved: that's the minimum to score. */
  onContinue: (() => void) | null;
  onSkip?: () => void;
}) {
  const router = useRouter();
  const blank = { kind: project ? "project" : "work", org: "", title: "", startDate: "", endDate: "", bullets: ["", ""], importedOneLine: false };
  const fromDraft = (d: RoleDraft) => {
    const importedOneLine = !project && importedRoleHasOneLine(d.kind, d.bullets);
    return { kind: d.kind, org: d.org, title: d.title, startDate: d.startDate, endDate: d.endDate, importedOneLine, bullets: linesForRoleForm(d.bullets, project, importedOneLine) };
  };
  const [editing, setEditing] = useState<RoleDraft | null>(roles.length === 0 ? drafts[0] ?? null : null);
  const [v, setV] = useState(() => (editing ? fromDraft(editing) : blank));
  const [open, setOpen] = useState(roles.length === 0);
  const [confirmed, setConfirmed] = useState(false);
  const review = (d: RoleDraft) => {
    setEditing(d);
    setV(fromDraft(d));
    setConfirmed(false);
    setOpen(true);
  };
  const { pending, error, save } = useSave();
  const kinds = project ? PROJECT_KINDS : ROLE_KINDS;

  const submit = () =>
    save(
      () => saveRoleStepAction({ ...v, kind: v.kind as "work", bullets: v.bullets, confirmed: confirmed as true }),
      () => {
        if (editing) onDraftSaved(editing.key);
        const next = drafts.find((d) => d.key !== editing?.key);
        setConfirmed(false);
        if (next) review(next);
        else {
          setEditing(null);
          setV(blank);
          setOpen(false);
        }
        router.refresh();
      },
    );

  return (
    <div>
      <Heading
        title={project ? "Any projects?" : "Where have you worked?"}
        hint={roleStepHint(project, v.importedOneLine)}
      />
      {roles.length > 0 && (
        <ul className="mt-6 space-y-2">
          {roles.map((r) => (
            <li key={r.id} className="rounded-lg border bg-background p-3 text-[14px]">
              <div className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-brand" strokeWidth={3} />
              <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
              <span className="shrink-0 text-[12.5px] text-muted-foreground">
                {r.lines} {r.lines === 1 ? "line" : "lines"}
              </span>
              </div>
              <RoleRecall experienceId={r.id} name={r.name} />
            </li>
          ))}
        </ul>
      )}

      {drafts.some((d) => d.key !== editing?.key) && (
        <div className="mt-6 rounded-xl border border-dashed border-border-strong p-4">
          <p className="text-[13px] font-medium">From your resume, not saved yet</p>
          <ul className="mt-2 space-y-1.5">
            {drafts
              .filter((d) => d.key !== editing?.key)
              .map((d) => (
                <li key={d.key} className="flex items-center gap-2 text-[14px]">
                  <span className="min-w-0 flex-1 truncate">{[d.title, d.org].filter(Boolean).join(", ")}</span>
                  <Button size="sm" variant="outline" type="button" onClick={() => review(d)}>
                    Review
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
              Read from your resume. Check every line, fix anything that isn&apos;t exactly right, then confirm.
              {editing.extraLines > 0 && ` Your resume had ${editing.extraLines} more ${editing.extraLines === 1 ? "line" : "lines"} for this role; add ${editing.extraLines === 1 ? "it" : "them"} on My facts afterward.`}
            </p>
          )}
          <PillChoice label="Kind" options={kinds} value={[v.kind as (typeof kinds)[number]["value"]]} onChange={(next) => next[0] && setV((x) => ({ ...x, kind: next[0] }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={project ? "Project name" : "Company or organization"} htmlFor="org">
              <Input id="org" value={v.org} onChange={(e) => setV((x) => ({ ...x, org: e.target.value }))} required maxLength={160} className="h-10" />
            </Field>
            <Field label={project ? "Your role (optional)" : "Your title"} htmlFor="title">
              <SearchableInput id="title" kind="roles" value={v.title} onChange={(title) => setV((x) => ({ ...x, title }))} maxLength={160} />
            </Field>
            <Field label={project ? "Start (optional)" : "Start"} htmlFor="start">
              <Input id="start" type="month" value={v.startDate} onChange={(e) => setV((x) => ({ ...x, startDate: e.target.value }))} className="h-10" />
            </Field>
            <Field label="End" hint="Leave blank if you're still there." htmlFor="end">
              <Input id="end" type="month" value={v.endDate} onChange={(e) => setV((x) => ({ ...x, endDate: e.target.value }))} className="h-10" />
            </Field>
          </div>
          <div className="space-y-2">
            <p className="text-[13px] font-medium">What you remember doing (optional)</p>
            <p className="text-[13px] leading-5 text-muted-foreground">Save the role even if you cannot think of a line yet. We will ask about possible tasks next.</p>
            {v.bullets.map((b, i) => (
              <Input
                key={i}
                value={b}
                onChange={(e) => setV((x) => ({ ...x, bullets: x.bullets.map((y, j) => (j === i ? e.target.value : y)) }))}
                maxLength={400}
                aria-label={`Line ${i + 1}`}
                placeholder={i === 0 ? (project ? "Built a budget tracker in Google Sheets for my club" : "Answered about 60 patient calls a day") : i === 1 ? (project ? "12 members used it to log $4,000 in dues" : "Scheduled appointments for 3 dentists") : ""}
                className="h-10"
              />
            ))}
            {v.bullets.length < 4 && (
              <button type="button" onClick={() => setV((x) => ({ ...x, bullets: [...x.bullets, ""] }))} className="inline-flex min-h-10 items-center gap-1 text-[13px] font-medium underline-offset-4 hover:underline">
                <Plus className="size-3.5" />
                Add another line
              </button>
            )}
          </div>
          <ConfirmBox checked={confirmed} onChange={setConfirmed} />
          <ErrorLine error={error} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || !confirmed}>
              {pending ? <LoaderCircle className="animate-spin" /> : null}
              {project ? "Save this project" : "Save this role"}
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
        </form>
      ) : (
        <Button variant="outline" className="mt-4 bg-background" onClick={() => setOpen(true)}>
          <Plus data-icon="inline-start" />
          {project ? "Add another project" : "Add another role"}
        </Button>
      )}

      <Nav onBack={onBack} onSkip={onSkip && roles.length === 0 ? onSkip : undefined}>
        {onContinue ? (
          <Button size="lg" type="button" onClick={onContinue} disabled={pending}>
            Continue
            <ArrowRight data-icon="inline-end" />
          </Button>
        ) : (
          <span className="text-[12.5px] text-muted-foreground">Save one experience to continue. It&apos;s the minimum to score a job.</span>
        )}
      </Nav>
    </div>
  );
}

function ListsScreen({ data, draft, onBack, onDone, onSkip }: { data: BetaOnboardingData; draft: ResumeDraft | null; onBack: () => void; onDone: () => void; onSkip: () => void }) {
  const merge = (saved: string[], read: string[] = []) => [...saved, ...read.filter((x) => !saved.some((y) => y.toLowerCase() === x.toLowerCase()))];
  const [skills, setSkills] = useState<string[]>(() => merge(data.skills, draft?.skills));
  const [licenses, setLicenses] = useState<string[]>(() => merge(data.licenses, draft?.licenses));
  const [confirmed, setConfirmed] = useState(false);
  const { pending, error, save } = useSave();
  const changed = skills.length !== data.skills.length || licenses.length !== data.licenses.length;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!changed) return onDone();
        save(() => saveListsStepAction({ skills, licenses, confirmed: confirmed as true }), onDone);
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
      {changed && <ConfirmBox checked={confirmed} onChange={setConfirmed} className="mt-6" />}
      <ErrorLine error={error} />
      <Nav onBack={onBack} onSkip={onSkip}>
        <Button type="submit" size="lg" disabled={pending || (changed && !confirmed)}>
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
        hint="These never go on a resume. They let us warn you before you tailor for a job you can't take: a graduation window, a visa rule, a location, or a start date."
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
        <Heading title="One thing first" hint={needs === "education" ? "Add your education so your fit can be scored." : "Add one experience so your fit can be scored. A job, club, or volunteer role all count."} />
        <Button className="mt-6" size="lg" onClick={() => onFix(needs)}>
          {needs === "education" ? "Add education" : "Add an experience"}
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[12.5px] font-medium text-brand-ink">Step 2 · Paste your first job</p>
      <Heading title="Paste a job you want" hint="A link from LinkedIn, Indeed, Handshake, or any company site, or the whole posting. Next you'll see the knockouts and your fit score." />
      <PasteJobBox className="mt-6" autoFocus onIngested={finish((id) => `/app/jobs/${id}`)} />
      <ErrorLine error={error} />
      <Nav onBack={onBack} onSkip={() => void finish(() => "/app")()}>
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
            : `Read your resume: ${draft.roles.length} ${draft.roles.length === 1 ? "role or project" : "roles and projects"}, ${draft.skills.length} skills.`}
        </p>
        <p className="text-muted-foreground">
          {importing
            ? "Roles and schools you already saved are left alone. Check each screen, add what's new, and confirm it; skills you don't have yet are added on the skills screen."
            : "We filled in what we found. Check each screen and fix anything that's off; nothing is saved until you confirm it."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[14px] font-medium">Have a resume? Start from it.</p>
        <button type="button" onClick={() => setMode(mode === "file" ? "paste" : "file")} className="text-[13px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
          {mode === "file" ? "Paste text instead" : "Upload a file instead"}
        </button>
      </div>
      <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">We&apos;ll fill in these screens for you to check. It takes a few seconds.</p>
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
