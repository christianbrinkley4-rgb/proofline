"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileUp, LoaderCircle, MessageSquareText, Search } from "lucide-react";
import type { UploadResponse } from "@/app/api/resume/upload/route";
import { finishOnboardingAction, saveStepAction } from "@/app/app/onboarding/actions";
import { ONBOARDING_STEPS, PROGRESS_STEPS, type OnboardingStep } from "@/app/app/onboarding/steps";
import { Button } from "@/components/ui/button";
import { storyReady } from "@/lib/agent/story-ready";
import { cn } from "@/lib/utils";
import { AgentSays, StepHint } from "./parts";
import { BasicsStep, GoalsStep } from "./profile-steps";
import { ExperienceStep } from "./experience-step";
import { ReviewStep } from "./review-step";
import { SkillsStep } from "./skills-step";
import type { OnboardingData } from "./types";

export function OnboardingFlow({ data }: { data: OnboardingData }) {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>(data.step);
  const [basics, setBasics] = useState(data.basics);
  const [, startTransition] = useTransition();
  // Which way the last move went, so the next step slides in from that side.
  const [direction, setDirection] = useState<1 | -1>(1);

  const go = (next: OnboardingStep) => {
    setDirection(ONBOARDING_STEPS.indexOf(next) >= ONBOARDING_STEPS.indexOf(step) ? 1 : -1);
    setStep(next);
    startTransition(() => saveStepAction(next));
    window.scrollTo({ top: 0 });
  };

  const progressIndex = PROGRESS_STEPS.findIndex((s) => s.id === step);

  return (
    <div className="mx-auto w-full max-w-2xl overflow-x-clip px-4 py-6 sm:px-6 sm:py-12">
      <div className="flex items-center justify-between gap-4">
        <ol aria-label="Progress" className="flex flex-1 gap-1.5">
          {PROGRESS_STEPS.map((s, i) => (
            <li key={s.id} className="flex-1">
              <span className="block h-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={cn(
                    "block h-full rounded-full transition-[width,background-color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                    step === "done" || i < progressIndex ? "w-full bg-brand" : i === progressIndex ? "w-1/2 bg-ink" : "w-0 bg-ink",
                  )}
                />
              </span>
              <span className={cn("mt-1.5 hidden text-[11.5px] sm:block", i === progressIndex ? "text-foreground" : "text-subtle-foreground")}>
                {s.label}
              </span>
            </li>
          ))}
        </ol>
        {step !== "done" && (
          <Link href="/app" className="-my-2 shrink-0 py-2 text-[13px] text-muted-foreground hover:text-foreground">
            Finish later
          </Link>
        )}
      </div>

      <div
        key={step}
        className={cn(
          "mt-10 [&>div>*:nth-child(n+3)]:motion-safe:animate-rise [&>div>*:nth-child(n+3)]:motion-safe:[animation-delay:340ms]",
          direction > 0 ? "motion-safe:animate-step-forward" : "motion-safe:animate-step-back",
        )}
      >
        {step === "start" && <StartStep onUpload={() => go("upload")} onScratch={() => go("basics")} name={data.firstName} />}
        {step === "upload" && (
          <UploadStep
            onBack={() => go("start")}
            onDone={(parsedBasics) => {
              setBasics((b) => mergeBasics(b, parsedBasics));
              router.refresh();
              go("review");
            }}
          />
        )}
        {step === "review" && <ReviewStep experiences={data.experiences} looseFacts={data.looseFacts} onContinue={() => go("basics")} />}
        {step === "basics" && <BasicsStep initial={basics} onSaved={() => go("experience")} />}
        {step === "experience" && <ExperienceStep experiences={data.experiences} onBack={() => go("basics")} onContinue={() => go("skills")} />}
        {step === "skills" && <SkillsStep skills={data.skills} experiences={data.experiences} onBack={() => go("experience")} onSaved={() => go("goals")} />}
        {step === "goals" && <GoalsStep initial={data.goals} experiences={data.experiences} onBack={() => go("skills")} onSaved={() => go("done")} />}
        {step === "done" && <DoneStep data={data} onGo={go} />}
      </div>
    </div>
  );
}

/** Parsed values fill blanks only; anything the student already typed wins. */
function mergeBasics(current: OnboardingData["basics"], parsed: OnboardingData["basics"]): OnboardingData["basics"] {
  const merged = { ...current };
  for (const key of Object.keys(parsed) as Array<keyof typeof parsed>) {
    if (!merged[key] && parsed[key]) merged[key] = parsed[key];
  }
  return merged;
}

function StartStep({ name, onUpload, onScratch }: { name: string; onUpload: () => void; onScratch: () => void }) {
  return (
    <div>
      <AgentSays>Hi {name}. I&apos;m your agent. Before I go looking for jobs, I need to know what you&apos;ve done.</AgentSays>
      <StepHint>
        Tell me what you have done, then what you want to do next. Jobs, care work, projects, training, and volunteer work all count.
        I only use confirmed facts on your resumes. You can stop anytime and come back.
      </StepHint>
      <div className="mt-8 grid gap-3 pl-0 stagger-in [--stagger-start:420ms] sm:grid-cols-2 sm:pl-11">
        <ChoiceCard
          icon={FileUp}
          title="Upload my resume"
          text="PDF or DOCX. I'll pull out your experience and ask you to confirm each piece."
          onClick={onUpload}
        />
        <ChoiceCard
          icon={MessageSquareText}
          title="Start from scratch"
          text="No resume needed. Tell me about work, projects, responsibilities, or things you've learned."
          onClick={onScratch}
        />
      </div>
    </div>
  );
}

function ChoiceCard({ icon: Icon, title, text, onClick }: { icon: typeof FileUp; title: string; text: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border bg-background p-5 text-left transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift active:translate-y-0"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-brand-soft text-brand-ink transition-colors group-hover:bg-ink group-hover:text-ink-foreground">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <div className="mt-4 text-[15px] font-semibold tracking-tight">{title}</div>
      <p className="mt-1 text-[13.5px] leading-6 text-muted-foreground">{text}</p>
    </button>
  );
}

function UploadStep({ onBack, onDone }: { onBack: () => void; onDone: (basics: OnboardingData["basics"]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState("");

  async function upload(file: File | string) {
    setError(null);
    setStatus(typeof file === "string" ? "Reading your text" : `Reading ${file.name}`);
    const form = new FormData();
    if (typeof file === "string") form.set("text", file);
    else form.set("resume", file);
    const result: UploadResponse = await fetch("/api/resume/upload", { method: "POST", body: form })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: "Couldn't reach the server. Check your connection and try again." }));
    if (!result.ok) {
      setStatus(null);
      setError(result.error);
      return;
    }
    const { experiences, facts } = result.summary;
    setStatus(`Found ${experiences} ${experiences === 1 ? "role" : "roles"} and ${facts} things to confirm.`);
    onDone(result.basics as OnboardingData["basics"]);
  }

  return (
    <div>
      <AgentSays>Add your resume here. I&apos;ll read it and ask you to confirm what I find.</AgentSays>
      <StepHint>Nothing goes on a new resume until you say yes to it. An old or rough resume is fine.</StepHint>

      <div className="mt-8 sm:pl-11">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) void upload(file);
          }}
          className={cn(
            "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors",
            dragging ? "border-brand bg-brand-soft" : "border-border-strong bg-muted/40",
          )}
        >
          {status && !error ? (
            <>
              <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
              <p role="status" className="mt-3 text-[14px] text-muted-foreground">{status}</p>
              <p className="mt-1 text-[12.5px] text-subtle-foreground">This usually takes under a minute. Keep this page open.</p>
            </>
          ) : (
            <>
              <FileUp className="size-6 text-muted-foreground" strokeWidth={1.75} />
              {/* Phones can't drag files, so don't ask them to. */}
              <p className="mt-3 text-[15px] font-medium pointer-coarse:hidden">Drag a PDF or DOCX here</p>
              <p className="mt-3 hidden text-[15px] font-medium pointer-coarse:block">Choose a PDF or DOCX file</p>
              <p className="mt-1 text-[13px] text-muted-foreground">Up to 5 MB</p>
              <Button type="button" variant="outline" className="mt-5 bg-background" onClick={() => input.current?.click()}>
                Choose a file
              </Button>
            </>
          )}
          <input
            ref={input}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
            {error}
          </p>
        )}
        <p className="mt-4 text-[12.5px] text-muted-foreground">
          LinkedIn works too: on your profile, choose More, then Save to PDF, and add that file here.
        </p>
        {pasting ? (
          <form
            className="mt-4 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void upload(pasted);
            }}
          >
            <label htmlFor="pasted" className="text-[13px] font-medium">
              Paste your resume or profile text
            </label>
            <textarea
              id="pasted"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={10}
              maxLength={30000}
              placeholder={"EXPERIENCE\nOakwood Family Dental, Bookkeeping Assistant, May 2025 - Present\n- Reconciled vendor accounts each month in QuickBooks"}
              className="w-full rounded-lg border bg-background px-3 py-2 text-[13.5px] leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={pasted.trim().length < 80 || Boolean(status && !error)}>
                Read my text
              </Button>
              <Button type="button" variant="ghost" onClick={() => setPasting(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setPasting(true)} className="mt-2 text-[13px] font-medium underline-offset-4 hover:underline">
            No file? Paste the text instead
          </button>
        )}
        <div>
          <button type="button" onClick={onBack} className="mt-4 py-2 text-[13.5px] text-muted-foreground hover:text-foreground">
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

function DoneStep({ data, onGo }: { data: OnboardingData; onGo: (step: OnboardingStep) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const confirmed =
    data.experiences.flatMap((e) => e.facts).filter((f) => f.state === "confirmed").length +
    data.skills.filter((f) => f.state === "confirmed").length +
    data.looseFacts.filter((f) => f.state === "confirmed").length;
  const role = data.goals.targetRoles[0];
  const where = data.goals.targetLocations.find((l) => !/^remote$/i.test(l));
  const query = [role, where ? `in ${where}` : "", data.goals.targetTerm ? `for ${data.goals.targetTerm}` : ""].filter(Boolean).join(" ");

  // Don't finish hollow: with no real evidence, a search scores nothing and a resume has nothing to say.
  if (!storyReady({ confirmedFacts: confirmed, experiences: data.experiences.length })) {
    return (
      <div>
        <AgentSays>Almost there, {data.firstName}. Before I search, tell me about one thing you&apos;ve done.</AgentSays>
        <StepHint>
          I only match and write from facts you confirm, and I have {confirmed === 0 ? "none" : `just ${confirmed}`} so far. A part-time job, a class
          project, a club, or volunteering all count. It takes about two minutes.
        </StepHint>
        <div className="mt-8 grid gap-3 stagger-in [--stagger-start:420ms] sm:ml-11 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onGo("experience")}
            className="flex flex-col rounded-xl border border-border-strong bg-background p-5 text-left shadow-lift transition-colors hover:bg-muted/40"
          >
            <MessageSquareText className="size-5 text-brand-ink" />
            <span className="mt-3 text-[15px] font-semibold">Add one experience</span>
            <span className="mt-1 text-[13px] leading-5 text-muted-foreground">Tell me what you did in your own words. I&apos;ll ask about the numbers.</span>
          </button>
          <button
            type="button"
            onClick={() => onGo("upload")}
            className="flex flex-col rounded-xl border bg-background p-5 text-left transition-colors hover:bg-muted/40"
          >
            <FileUp className="size-5 text-muted-foreground" />
            <span className="mt-3 text-[15px] font-semibold">Upload a resume</span>
            <span className="mt-1 text-[13px] leading-5 text-muted-foreground">I&apos;ll pull out facts for you to check with a yes or no.</span>
          </button>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await finishOnboardingAction();
              router.push("/app");
            })
          }
          className="mt-6 text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:ml-11"
        >
          Skip for now. I&apos;ll add it from Today.
        </button>
      </div>
    );
  }

  const finish = (href: string) =>
    startTransition(async () => {
      await finishOnboardingAction();
      router.push(href);
    });

  // Resume first: Today walks them from these facts to a general resume, then to a pasted job.
  return (
    <div>
      <AgentSays>That&apos;s enough to start, {data.firstName}. I&apos;ll keep learning as we go.</AgentSays>
      <StepHint>
        I have {confirmed} confirmed facts to work with. You can add more experience or change your goals at any time.
      </StepHint>
      <div className="relative isolate mt-8 overflow-hidden rounded-2xl border bg-background p-5 shadow-lift motion-safe:animate-rise motion-safe:[animation-delay:420ms] sm:ml-11">
        <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-70 atmosphere-soft" />
        <svg aria-hidden="true" viewBox="0 0 40 40" className="mb-4 size-10">
          <circle cx="20" cy="20" r="18" pathLength={1} className="proof-stroke fill-none stroke-brand motion-safe:animate-draw" strokeWidth="2.5" />
          <path d="M12.5 20.5l5 5 10-11" pathLength={1} className="proof-stroke fill-none stroke-brand motion-safe:animate-draw motion-safe:[animation-delay:500ms]" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="text-[12px] text-subtle-foreground">Next step</div>
        <div className="mt-1 text-[15px] font-medium">Turn these facts into your first resume</div>
        <p className="mt-1 text-[13.5px] leading-5 text-muted-foreground">
          One page, built only from what you confirmed. Then paste any job and I&apos;ll tailor it.
        </p>
        <Button size="xl" className="mt-5" disabled={pending} onClick={() => finish("/app")}>
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Show me the next step
          <ArrowRight data-icon="inline-end" />
        </Button>
        {role && (
          <button
            type="button"
            disabled={pending}
            onClick={() => finish(`/app/jobs?q=${encodeURIComponent(query)}`)}
            className="mt-3 flex min-h-10 items-center gap-1.5 text-left text-[13.5px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <Search className="size-3.5 shrink-0" />
            Or search &ldquo;{query}&rdquo; first
          </button>
        )}
      </div>
    </div>
  );
}
