"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createResumeAction } from "@/app/app/resumes/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STEPS = [
  "Reading what the posting asks for",
  "Ranking your confirmed bullets against it",
  "Fitting the best ones on one page",
  "Checking every claim against your facts",
];

/** Kicks off tailoring from the client, so link prefetching can never create a resume by accident. */
export function TailorStarter({ jobId, jobLabel, variant, template }: { jobId: string | null; jobLabel: string | null; variant?: string; template?: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const ticker = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 450);
    createResumeAction({ jobId, variant, template }).then((r) => {
      clearInterval(ticker);
      if (r.ok) router.replace(`/app/resumes/${r.id}`);
      else setError(r.error);
    });
    return () => clearInterval(ticker);
  }, [jobId, variant, template, router]);

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-4">
      <p className="font-mono text-[12px] text-subtle-foreground">{jobLabel ? "Tailoring for" : "Building"}</p>
      <h1 className="mt-2 text-[22px] leading-snug font-semibold tracking-tight">{jobLabel ?? "Your general resume"}</h1>
      {error ? (
        <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-[14px] leading-6">
          <p>{error}</p>
          <Button asChild className="mt-4">
            <Link href="/app/profile">Go to your profile</Link>
          </Button>
        </div>
      ) : (
        <ol className="mt-6 space-y-2.5">
          {STEPS.map((label, i) => (
            <li key={label} className={cn("flex items-center gap-2.5 text-[14px] transition-colors", i <= step ? "text-foreground" : "text-subtle-foreground")}>
              <span className={cn("size-1.5 rounded-full", i < step ? "bg-brand" : i === step ? "animate-pulse bg-brand" : "bg-border-strong")} />
              {label}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
