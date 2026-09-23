"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, FileUp, LoaderCircle, MessageSquareText, Search } from "lucide-react";
import type { UploadResponse } from "@/app/api/resume/upload/route";
import { finishOnboardingAction, saveStepAction } from "@/app/app/onboarding/actions";
import { PROGRESS_STEPS, type OnboardingStep } from "@/app/app/onboarding/steps";
import { Button } from "@/components/ui/button";
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

  const go = (next: OnboardingStep) => {
    setStep(next);
    startTransition(() => saveStepAction(next));
    window.scrollTo({ top: 0 });
  };

  const progressIndex = PROGRESS_STEPS.findIndex((s) => s.id === step);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-12">
      <div className="flex items-center justify-between gap-4">
        <ol aria-label="Progress" className="flex flex-1 gap-1.5">
          {PROGRESS_STEPS.map((s, i) => (
            <li key={s.id} className="flex-1">
              <span
                className={cn(
                  "block h-1 rounded-full transition-colors",
                  step === "done" || i < progressIndex ? "bg-foreground" : i === progressIndex ? "bg-brand" : "bg-muted",
                )}
              />
              <span className={cn("mt-1.5 hidden text-[11.5px] sm:block", i === progressIndex ? "text-foreground" : "text-subtle-foreground")}>
                {s.label}
              </span>
            </li>
          ))}
        </ol>
        {step !== "done" && (
          <Link href="/app" className="shrink-0 text-[13px] text-muted-foreground hover:text-foreground">
            Finish later
          </Link>
        )}
      </div>

      <div key={step} className="mt-10 motion-safe:animate-view-in">
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
        {step === "basics" && <BasicsStep initial={basics} onSaved={() => go("goals")} />}
        {step === "goals" && <GoalsStep initial={data.goals} onBack={() => go("basics")} onSaved={() => go("experience")} />}
        {step === "experience" && <ExperienceStep experiences={data.experiences} onBack={() => go("goals")} onContinue={() => go("skills")} />}
        {step === "skills" && <SkillsStep skills={data.skills} onBack={() => go("experience")} onSaved={() => go("done")} />}
        {step === "done" && <DoneStep data={data} />}
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
        Everything you tell me becomes a fact you confirm. I only use confirmed facts on your resumes, so you&apos;ll be able to
        back up every line. You can stop anytime and I&apos;ll remember where we were.
      </StepHint>
      <div className="mt-8 grid gap-3 pl-0 sm:grid-cols-2 sm:pl-11">
        <ChoiceCard
          icon={FileUp}
          title="Upload my resume"
          text="PDF or DOCX. I'll pull out your experience and ask you to confirm each piece."
          onClick={onUpload}
        />
        <ChoiceCard
          icon={MessageSquareText}
          title="Start from scratch"
          text="No resume yet? Tell me about your jobs, clubs, and projects in your own words."
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
      className="group rounded-xl border bg-background p-5 text-left transition-all hover:border-border-strong hover:shadow-sm"
    >
      <Icon className="size-5 text-muted-foreground transition-colors group-hover:text-foreground" strokeWidth={1.75} />
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

  async function upload(file: File) {
    setError(null);
    setStatus(`Reading ${file.name}`);
    const form = new FormData();
    form.set("resume", file);
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
      <AgentSays>Drop your resume here. I&apos;ll read it and ask you to confirm what I find.</AgentSays>
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
              <p className="mt-3 text-[14px] text-muted-foreground">{status}</p>
            </>
          ) : (
            <>
              <FileUp className="size-6 text-muted-foreground" strokeWidth={1.75} />
              <p className="mt-3 text-[15px] font-medium">Drag a PDF or DOCX here</p>
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
        <button type="button" onClick={onBack} className="mt-6 text-[13.5px] text-muted-foreground hover:text-foreground">
          Back
        </button>
      </div>
    </div>
  );
}

function DoneStep({ data }: { data: OnboardingData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const confirmed =
    data.experiences.flatMap((e) => e.facts).filter((f) => f.state === "confirmed").length +
    data.skills.filter((f) => f.state === "confirmed").length;
  const role = data.goals.targetRoles[0] ?? "internships";
  const where = data.goals.targetLocations[0];
  const query = [role, where ? `in ${where}` : "", data.goals.targetTerm ? `for ${data.goals.targetTerm}` : ""].filter(Boolean).join(" ");

  return (
    <div>
      <AgentSays>That&apos;s enough to start, {data.firstName}. I&apos;ll keep learning as we go.</AgentSays>
      <StepHint>
        I know {confirmed} confirmed facts about you and {data.goals.targetRoles.length || "a few"} kinds of roles you want.
        Every time you save a job, edit a bullet, or hear back from a company, I get better at picking for you.
      </StepHint>
      <div className="mt-8 rounded-xl border bg-background p-5 sm:ml-11">
        <div className="text-[12px] text-subtle-foreground">First search</div>
        <div className="mt-1 text-[15px] font-medium">&ldquo;{query}&rdquo;</div>
        <Button
          size="xl"
          className="mt-5"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await finishOnboardingAction();
              router.push(`/app/jobs?q=${encodeURIComponent(query)}`);
            })
          }
        >
          {pending ? <LoaderCircle className="animate-spin" /> : <Search data-icon="inline-start" />}
          Find my first jobs
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
