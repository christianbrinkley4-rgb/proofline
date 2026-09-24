"use client";

import { useState, useTransition } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { saveBasicsAction, saveGoalsAction, type BasicsInput, type GoalsInput } from "@/app/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AgentSays, ChipInput, Field, PillChoice, StepHint } from "./parts";

function FormError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
      {error}
    </p>
  );
}

function Actions({ pending, onBack, label = "Continue" }: { pending: boolean; onBack?: () => void; label?: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <Button type="submit" size="xl" disabled={pending}>
        {pending && <LoaderCircle className="animate-spin" />}
        {label}
        {!pending && <ArrowRight data-icon="inline-end" />}
      </Button>
      {onBack && (
        <button type="button" onClick={onBack} className="text-[13.5px] text-muted-foreground hover:text-foreground">
          Back
        </button>
      )}
    </div>
  );
}

export function BasicsStep({ initial, onSaved }: { initial: BasicsInput; onSaved: () => void }) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (key: keyof BasicsInput) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <div>
      <AgentSays>Let&apos;s start with who you are. We can fill in the details later.</AgentSays>
      <StepHint>Only your name is required. School and training are optional.</StepHint>
      <form
        className="mt-8 space-y-5 sm:pl-11"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const result = await saveBasicsAction(values);
            if (result.ok) onSaved();
            else setError(result.error);
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="fullName">
            <Input id="fullName" value={values.fullName} onChange={set("fullName")} autoComplete="name" required className="h-10" />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <Input id="phone" value={values.phone} onChange={set("phone")} autoComplete="tel" className="h-10" />
          </Field>
          <Field label="City" htmlFor="city">
            <Input id="city" value={values.city} onChange={set("city")} autoComplete="address-level2" className="h-10" />
          </Field>
          <Field label="State" htmlFor="region">
            <Input id="region" value={values.region} onChange={set("region")} autoComplete="address-level1" placeholder="NC" className="h-10" />
          </Field>
        </div>

        <details className="rounded-lg border p-4" open={Boolean(initial.school || initial.degree || initial.major || initial.gradDate)}>
          <summary className="cursor-pointer text-[13.5px] font-medium">Education or training (optional)</summary>
          <p className="mt-2 text-[12.5px] text-muted-foreground">High school, college, a trade program, a certificate, or nothing yet. Your job matches won&apos;t require a degree unless the posting does.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="School" htmlFor="school">
            <Input id="school" value={values.school} onChange={set("school")} className="h-10" />
          </Field>
          <Field label="Degree or credential" htmlFor="degree">
            <Input id="degree" value={values.degree} onChange={set("degree")} placeholder="Diploma, GED, certificate, or degree" className="h-10" />
          </Field>
          <Field label="Field or program" htmlFor="major">
            <Input id="major" value={values.major} onChange={set("major")} placeholder="Accounting, welding, nursing..." className="h-10" />
          </Field>
          <Field label="Minor" htmlFor="minor">
            <Input id="minor" value={values.minor} onChange={set("minor")} className="h-10" />
          </Field>
          <Field label="Completed or expected" htmlFor="gradDate">
            <Input id="gradDate" type="month" value={values.gradDate} onChange={set("gradDate")} className="h-10" />
          </Field>
          <Field label="GPA (optional)" htmlFor="gpa" hint="Only useful when a posting asks for it.">
            <Input id="gpa" inputMode="decimal" value={values.gpa} onChange={set("gpa")} placeholder="3.6" className="h-10" />
          </Field>
          </div>
        </details>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="LinkedIn" htmlFor="linkedinUrl">
            <Input id="linkedinUrl" value={values.linkedinUrl} onChange={set("linkedinUrl")} placeholder="linkedin.com/in/you" className="h-10" />
          </Field>
          <Field label="Portfolio or GitHub" htmlFor="portfolioUrl">
            <Input id="portfolioUrl" value={values.portfolioUrl} onChange={set("portfolioUrl")} className="h-10" />
          </Field>
        </div>

        <FormError error={error} />
        <Actions pending={pending} />
      </form>
    </div>
  );
}

const ROLE_SUGGESTIONS = [
  "Accounting intern",
  "Audit intern",
  "Tax intern",
  "Financial analyst intern",
  "FP&A intern",
  "Investment banking intern",
  "Business analyst intern",
  "Data analyst intern",
  "Software engineering intern",
  "Marketing intern",
  "Consulting intern",
  "Staff accountant",
  "Customer service representative",
  "Administrative assistant",
  "Retail associate",
  "Medical assistant",
  "Warehouse associate",
  "Electrician apprentice",
  "Project coordinator",
] as const;

const MODES = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "In person" },
] as const;

const INDUSTRIES = ["Public accounting", "Banking", "Tech", "Healthcare", "Government", "Nonprofit", "Consulting", "Retail"] as const;

const AUTH = [
  { value: "authorized", label: "Authorized to work in the U.S." },
  { value: "needs_sponsorship", label: "Will need visa sponsorship" },
] as const;

const DEAL_BREAKERS = ["Unpaid", "Commission only", "Requires a CPA already", "Weekend shifts", "Relocation"] as const;

export function GoalsStep({ initial, onBack, onSaved }: { initial: GoalsInput; onBack: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<GoalsInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const update = <K extends keyof GoalsInput>(key: K, value: GoalsInput[K]) => setValues((v) => ({ ...v, [key]: value }));

  return (
    <div>
      <AgentSays>What are you looking for? Tell me like you&apos;d tell a friend.</AgentSays>
      <StepHint>These steer what I search for and how I score each job. You can change them anytime, and I&apos;ll adjust as I learn.</StepHint>
      <form
        className="mt-8 space-y-7 sm:pl-11"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const result = await saveGoalsAction(values);
            if (result.ok) onSaved();
            else setError(result.error);
          });
        }}
      >
        <Field label="Kinds of roles (optional)" htmlFor="roles" hint="Not sure yet? Leave this blank. We'll suggest paths from what you've done.">
          <ChipInput id="roles" value={values.targetRoles} onChange={(v) => update("targetRoles", v)} suggestions={ROLE_SUGGESTIONS} placeholder="Type a role and press Enter" />
        </Field>
        <Field label="When (optional)" htmlFor="targetTerm" hint="Leave blank if you're open to roles posted now.">
          <Input id="targetTerm" value={values.targetTerm} onChange={(e) => update("targetTerm", e.target.value)} placeholder="Now, summer 2027, after graduation..." className="h-10" />
        </Field>
        <Field label="Where" htmlFor="locations" hint='Cities, states, or "Remote". I search within about 50 miles of each place.'>
          <ChipInput id="locations" value={values.targetLocations} onChange={(v) => update("targetLocations", v)} suggestions={["Remote"]} placeholder="Raleigh, NC" />
        </Field>
        <Field label="Work setup you're open to">
          <PillChoice multiple options={MODES} value={values.workModes} onChange={(v) => update("workModes", v)} />
        </Field>
        <Field label="Industries (optional)" htmlFor="industries">
          <ChipInput id="industries" value={values.industries} onChange={(v) => update("industries", v)} suggestions={INDUSTRIES} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lowest pay you'd take (optional)" htmlFor="pay" hint="Enter an hourly rate or annual salary. We'll infer the unit from the amount.">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-subtle-foreground">$</span>
              <Input id="pay" inputMode="numeric" value={values.payFloor} onChange={(e) => update("payFloor", e.target.value.replace(/\D/g, ""))} className="h-10 pl-6" />
            </div>
          </Field>
        </div>
        <Field label="Work authorization" hint="Used only to skip jobs you can't be hired for. Never shown to employers.">
          <PillChoice options={AUTH} value={values.workAuthorization ? [values.workAuthorization] : []} onChange={(v) => update("workAuthorization", v[0] ?? "")} />
        </Field>
        <Field label="Deal-breakers (optional)" htmlFor="dealbreakers">
          <ChipInput id="dealbreakers" value={values.dealBreakers} onChange={(v) => update("dealBreakers", v)} suggestions={DEAL_BREAKERS} />
        </Field>

        <FormError error={error} />
        <Actions pending={pending} onBack={onBack} />
      </form>
    </div>
  );
}
