"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleAlert, FileText, LoaderCircle, MessageCircleQuestion, Upload } from "lucide-react";
import type { CheckResponse } from "@/app/api/check/route";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DefendReport } from "@/lib/check/defend";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

type Mode = "paste" | "upload";

export function DefendCheck() {
  const [mode, setMode] = useState<Mode>("paste");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<DefendReport | null>(null);
  const results = useRef<HTMLDivElement>(null);

  const ready = mode === "paste" ? text.trim().length > 0 : Boolean(file);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const form = new FormData();
      if (mode === "paste") form.set("text", text);
      else if (file) form.set("resume", file);
      if (job.trim()) form.set("job", job);
      const res = await fetch("/api/check", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({ ok: false, error: "Something went wrong. Try again." }))) as CheckResponse;
      if (!data.ok) {
        setError(data.error);
        return;
      }
      setReport(data.report);
      requestAnimationFrame(() => results.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <form onSubmit={submit} className="rounded-2xl border bg-background p-4 shadow-lift sm:p-6">
        <div role="group" aria-label="How to add your resume" className="inline-flex rounded-full border bg-muted/60 p-1">
          {(
            [
              ["paste", "Paste text", FileText],
              ["upload", "Upload PDF or DOCX", Upload],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] transition-colors",
                mode === id ? "bg-background font-medium text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {mode === "paste" ? (
            <>
              <label htmlFor="resume-text" className="text-[14px] font-medium">
                Your resume
              </label>
              <Textarea
                id="resume-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                maxLength={30_000}
                placeholder="Paste the whole resume: headings, jobs, and bullets."
                className="mt-1.5 text-[14px] leading-6"
              />
            </>
          ) : (
            <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-muted/30 p-6 text-center transition-colors hover:bg-muted/60">
              <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
              <span className="text-[14px] font-medium">{file ? file.name : "Choose a PDF or DOCX"}</span>
              <span className="text-[12.5px] text-muted-foreground">{file ? "Choose a different file" : "Text-based files up to 5 MB"}</span>
              <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          )}
        </div>

        <div className="mt-5">
          <label htmlFor="job-text" className="text-[14px] font-medium">
            A job you want <span className="font-normal text-subtle-foreground">(optional)</span>
          </label>
          <Textarea
            id="job-text"
            value={job}
            onChange={(e) => setJob(e.target.value)}
            rows={4}
            maxLength={20_000}
            placeholder="Paste the posting to see which of its terms your resume shows."
            className="mt-1.5 text-[14px] leading-6"
          />
        </div>

        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 text-[13.5px] text-pending-ink">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Button type="submit" size="xl" disabled={!ready || pending} className="w-full sm:w-auto">
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            {pending ? "Checking every line" : "Check my resume"}
          </Button>
          <p className="text-[12.5px] leading-5 text-subtle-foreground">No account needed. Nothing you paste is saved.</p>
        </div>
      </form>

      {report && (
        <div ref={results} className="scroll-mt-20">
          <Results report={report} />
        </div>
      )}
    </>
  );
}

function Results({ report }: { report: DefendReport }) {
  const failing = report.checks.filter((c) => !c.passed);
  return (
    <div className="mt-12 space-y-10 motion-safe:animate-view-in">
      <div>
        <h2 className="font-display text-[30px] leading-tight font-semibold sm:text-[36px]">
          {report.claims.length === 0 ? "Nothing to be asked about yet." : `${report.claims.length} ${report.claims.length === 1 ? "line" : "lines"} you'll be asked to back up.`}
        </h2>
        <p className="mt-2 text-[15.5px] leading-7 text-muted-foreground">
          We read {report.bullets} {report.bullets === 1 ? "bullet" : "bullets"} across {report.roles} {report.roles === 1 ? "role" : "roles"}. We can&apos;t tell what&apos;s true; only you can. This shows what a recruiter will question.
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          <Stat label="Lines with a number" value={report.claims.length} />
          <Stat label="Vague words" value={report.vague.length} tone={report.vague.length ? "pending" : "brand"} />
          <Stat label="Checks passed" value={`${report.passed}/${report.checks.length}`} tone={failing.length ? "pending" : "brand"} />
        </dl>
      </div>

      {report.claims.length > 0 && (
        <Block title="Be ready to back these up" note="Every number on a resume is an interview question. If you can't answer it in one sentence, change the line.">
          <ul className="divide-y rounded-xl border">
            {report.claims.map((c) => (
              <li key={c.line} className="p-4">
                <p className="text-[14.5px] leading-6">
                  <Highlight line={c.line} tokens={c.numbers} />
                </p>
                <p className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-5 text-muted-foreground">
                  <MessageCircleQuestion className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {c.question}
                </p>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {report.vague.length > 0 && (
        <Block title="Words that invite a follow-up" note="They promise a size without giving one.">
          <ul className="divide-y rounded-xl border">
            {report.vague.map((v) => (
              <li key={v.line} className="p-4">
                <p className="text-[14.5px] leading-6">
                  <Highlight line={v.line} tokens={[v.word]} />
                </p>
                <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">{v.question}</p>
              </li>
            ))}
          </ul>
        </Block>
      )}

      <Block title="The rest of the checks">
        <ul className="divide-y rounded-xl border">
          {report.checks.map((c) => (
            <li key={c.id} className="flex gap-3 p-4">
              {c.passed ? (
                <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand text-background">
                  <Check className="size-2.5" strokeWidth={3.5} aria-hidden="true" />
                </span>
              ) : (
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-pending" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="text-[14px] font-medium">{c.label}</p>
                <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{c.detail}</p>
                {!c.passed &&
                  c.failures.slice(0, 3).map((q) => (
                    <blockquote key={q} className="mt-1.5 border-l-2 border-pending pl-2 text-[13px] leading-5 break-words">
                      {q}
                    </blockquote>
                  ))}
              </div>
            </li>
          ))}
        </ul>
      </Block>

      {report.keywords && (
        <Block title="Against this job" note="Only add a term if you've really done it. A recruiter will ask.">
          <div className="rounded-xl border p-4">
            <p className="text-[13px] font-medium">
              {report.keywords.matched.length} of {report.keywords.matched.length + report.keywords.missing.length} posting terms show on your resume
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {report.keywords.matched.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-0.5 text-[12.5px] text-brand-ink">
                  <Check className="size-3" strokeWidth={2.5} aria-hidden="true" />
                  {k}
                </span>
              ))}
              {report.keywords.missing.map((k) => (
                <span key={k} className="rounded-md border border-dashed px-2 py-0.5 text-[12.5px] text-muted-foreground">
                  {k}
                </span>
              ))}
            </div>
          </div>
        </Block>
      )}

      <section className="rounded-2xl bg-ink p-6 text-ink-foreground sm:p-8">
        <h2 className="font-display text-[26px] leading-tight font-semibold sm:text-[32px]">Fix it at the source.</h2>
        <p className="mt-3 max-w-xl text-[15px] leading-7 text-ink-muted">
          {site.name} builds your resume only from facts you confirm. It asks for the real number instead of inventing one, and checks every line before you can download it.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button size="lg" variant="secondary" asChild>
            <Link href={site.routes.signUp}>
              Get started
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <p className="text-[13px] text-ink-muted">Free during the beta. Any email works.</p>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: "neutral" | "brand" | "pending" }) {
  return (
    <div className="rounded-xl border bg-background p-3 sm:p-4">
      <dt className="text-[12px] leading-4 text-muted-foreground sm:text-[12.5px]">{label}</dt>
      <dd className={cn("mt-1 font-display text-[26px] leading-none font-semibold tabular-nums sm:text-[32px]", tone === "pending" && "text-pending-ink", tone === "brand" && "text-brand-ink")}>{value}</dd>
    </div>
  );
}

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[18px] font-semibold tracking-tight">{title}</h3>
      {note && <p className="mt-1 text-[13.5px] leading-5 text-muted-foreground">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** The line with each flagged token marked, so the eye lands on what will be asked. */
function Highlight({ line, tokens }: { line: string; tokens: string[] }) {
  const escaped = tokens.filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return <>{line}</>;
  const parts = line.split(new RegExp(`(${escaped.join("|")})`, "i"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-pending-soft px-0.5 font-medium text-pending-ink">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
