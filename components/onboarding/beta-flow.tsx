"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Plus } from "lucide-react";
import {
  finishOnboardingStepAction,
  goToStepAction,
  saveEducationStepAction,
  saveListsStepAction,
  saveLogisticsStepAction,
  saveRoleStepAction,
  type StepResult,
} from "@/app/app/onboarding/beta-actions";
import { ABOUT_SCREENS, PROGRESS_STEPS, type OnboardingStep } from "@/app/app/onboarding/steps";
import { PasteJobBox } from "@/components/coach/paste-job-box";
import { ConfirmBox } from "@/components/facts/confirm-box";
import { SearchableInput } from "@/components/shared/searchable-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChipInput, Field, PillChoice } from "./parts";

export type BetaOnboardingData = {
  step: OnboardingStep;
  firstName: string;
  basics: { fullName: string; phone: string; city: string; region: string; school: string; degree: string; major: string; gradDate: string; gpa: string };
  roles: Array<{ id: string; kind: string; name: string; lines: number }>;
  skills: string[];
  licenses: string[];
  logistics: { workAuthorization: string; targetLocations: string[]; workModes: Array<"remote" | "hybrid" | "onsite">; openToRelocate: "" | "yes" | "no"; availableFrom: string };
  hasEducation: boolean;
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
  const aboutIndex = (ABOUT_SCREENS as readonly string[]).indexOf(step);
  const progress = step === "job" ? 1 : 0;

  const go = (next: OnboardingStep) => {
    if (data.returnTo) {
      router.push(data.returnTo);
      router.refresh();
      return;
    }
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
        {step === "education" && <EducationScreen data={data} onDone={() => go("experience")} />}
        {step === "experience" && (
          <RoleScreen
            key="experience"
            project={false}
            roles={data.roles.filter((r) => r.kind !== "project" && r.kind !== "research")}
            onBack={() => go("education")}
            onContinue={hasRole ? () => go("projects") : null}
          />
        )}
        {step === "projects" && (
          <RoleScreen
            key="projects"
            project
            roles={data.roles.filter((r) => r.kind === "project" || r.kind === "research")}
            onBack={() => go("experience")}
            onContinue={() => go("skills")}
            onSkip={() => go("skills")}
          />
        )}
        {step === "skills" && <ListsScreen data={data} onBack={() => go("projects")} onDone={() => go("logistics")} onSkip={() => go("logistics")} />}
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

function EducationScreen({ data, onDone }: { data: BetaOnboardingData; onDone: () => void }) {
  const [v, setV] = useState(data.basics);
  const [confirmed, setConfirmed] = useState(false);
  const { pending, error, save } = useSave();
  const set = (key: keyof typeof v) => (value: string) => setV((x) => ({ ...x, [key]: value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(() => saveEducationStepAction({ ...v, confirmed: confirmed as true }), onDone);
      }}
    >
      <Heading title={`Hi ${data.firstName}. Tell us about yourself.`} hint="Start with school. Everything you type here is saved as a fact in your own words, and only your facts ever reach a resume." />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Name on your resume" htmlFor="fullName">
          <Input id="fullName" value={v.fullName} onChange={(e) => set("fullName")(e.target.value)} required maxLength={120} className="h-10" />
        </Field>
        <Field label="Phone" hint="Optional, but recruiters look for it." htmlFor="phone">
          <Input id="phone" type="tel" value={v.phone} onChange={(e) => set("phone")(e.target.value)} maxLength={40} className="h-10" />
        </Field>
        <Field label="City" htmlFor="city">
          <Input id="city" value={v.city} onChange={(e) => set("city")(e.target.value)} maxLength={80} className="h-10" />
        </Field>
        <Field label="State" htmlFor="region">
          <Input id="region" value={v.region} onChange={(e) => set("region")(e.target.value)} maxLength={80} className="h-10" />
        </Field>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="School" htmlFor="school">
            <SearchableInput id="school" kind="schools" value={v.school} onChange={set("school")} required maxLength={200} />
          </Field>
        </div>
        <Field label="Degree" hint="For example B.S. or Associate's" htmlFor="degree">
          <SearchableInput id="degree" kind="degrees" value={v.degree} onChange={set("degree")} maxLength={120} />
        </Field>
        <Field label="Major" htmlFor="major">
          <SearchableInput id="major" kind="fields" value={v.major} onChange={set("major")} maxLength={160} />
        </Field>
        <Field label="Graduation (expected is fine)" htmlFor="gradDate">
          <Input id="gradDate" type="month" value={v.gradDate} onChange={(e) => set("gradDate")(e.target.value)} required className="h-10" />
        </Field>
        <Field label="GPA" hint="Optional. Leave it off if it's under 3.0." htmlFor="gpa">
          <Input id="gpa" inputMode="decimal" value={v.gpa} onChange={(e) => set("gpa")(e.target.value)} maxLength={4} placeholder="3.6" className="h-10" />
        </Field>
      </div>
      <ConfirmBox checked={confirmed} onChange={setConfirmed} className="mt-6" />
      <ErrorLine error={error} />
      <Nav backHref="/app">
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
  onBack,
  onContinue,
  onSkip,
}: {
  project: boolean;
  roles: BetaOnboardingData["roles"];
  onBack: () => void;
  /** Null until at least one experience is saved: that's the minimum to score. */
  onContinue: (() => void) | null;
  onSkip?: () => void;
}) {
  const router = useRouter();
  const blank = { kind: project ? "project" : "work", org: "", title: "", startDate: "", endDate: "", bullets: ["", ""] };
  const [v, setV] = useState(blank);
  const [open, setOpen] = useState(roles.length === 0);
  const [confirmed, setConfirmed] = useState(false);
  const { pending, error, save } = useSave();
  const kinds = project ? PROJECT_KINDS : ROLE_KINDS;

  const submit = () =>
    save(
      () => saveRoleStepAction({ ...v, kind: v.kind as "work", bullets: v.bullets, confirmed: confirmed as true }),
      () => {
        setV(blank);
        setConfirmed(false);
        setOpen(false);
        router.refresh();
      },
    );

  return (
    <div>
      <Heading
        title={project ? "Any projects?" : "Where have you worked?"}
        hint={
          project
            ? "Class projects, personal builds, research, or club work. One or two lines on what you made and what happened."
            : "A job, internship, club, or volunteer role. Write 2 to 4 plain lines about what you did. Numbers help: how many, how much, how often."
        }
      />
      {roles.length > 0 && (
        <ul className="mt-6 space-y-2">
          {roles.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2.5 text-[14px]">
              <Check className="size-4 shrink-0 text-brand" strokeWidth={3} />
              <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
              <span className="shrink-0 text-[12.5px] text-muted-foreground">
                {r.lines} {r.lines === 1 ? "line" : "lines"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form
          className="mt-6 space-y-4 rounded-2xl border bg-background p-4 sm:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
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
            <p className="text-[13px] font-medium">What you did, in your own words</p>
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
            {roles.length > 0 && (
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
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

function ListsScreen({ data, onBack, onDone, onSkip }: { data: BetaOnboardingData; onBack: () => void; onDone: () => void; onSkip: () => void }) {
  const [skills, setSkills] = useState<string[]>(data.skills);
  const [licenses, setLicenses] = useState<string[]>(data.licenses);
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
