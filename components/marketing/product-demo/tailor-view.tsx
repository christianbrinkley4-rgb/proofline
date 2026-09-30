"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CircleAlert, Download, Minus, RotateCcw, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CASH_REPORT_BULLET_ID,
  DEMO_CANDIDATE,
  DEMO_CUTS,
  DEMO_EXPERIENCE,
  DEMO_LEADERSHIP,
  cashReportText,
  type DemoJob,
  type ResumeBullet,
  type ResumeRole,
} from "@/lib/demo/sample-data";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";
import { findVoiceIssues, findWeakOpener } from "@/lib/voice/rules";
import { FactChip } from "./parts";
import { onTabListKeyDown } from "@/components/shared/tab-keys";

export type PendingState = "pending" | "confirmed" | "removed";

type Panel = "why" | "cut" | "checks";

type Props = {
  job: DemoJob;
  pending: PendingState;
  hours: number;
  onConfirm: (hours: number) => void;
  onRemove: () => void;
  onUndo: () => void;
};

export function TailorView({ job, pending, hours, onConfirm, onRemove, onUndo }: Props) {
  const [panel, setPanel] = useState<Panel>("why");
  const [hovered, setHovered] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftHours, setDraftHours] = useState(String(hours));

  const resolve = (bullet: ResumeBullet): ResumeBullet =>
    bullet.id === CASH_REPORT_BULLET_ID
      ? { ...bullet, text: cashReportText(hours), facts: [...bullet.facts, `About ${hours} hrs a week`] }
      : bullet;
  const isVisible = (bullet: ResumeBullet) => !(bullet.id === CASH_REPORT_BULLET_ID && pending === "removed");
  const roles: ResumeRole[] = [...DEMO_EXPERIENCE, DEMO_LEADERSHIP].map((role) => ({
    ...role,
    bullets: role.bullets.filter(isVisible).map(resolve),
  }));
  const bullets = roles.flatMap((r) => r.bullets);
  const cashBullet = bullets.find((b) => b.id === CASH_REPORT_BULLET_ID);
  const isPending = pending === "pending";

  const checks = runChecks(bullets, isPending);
  const passed = checks.filter((c) => c.status === "pass").length;

  const saveEdit = () => {
    const n = Number.parseInt(draftHours, 10);
    if (Number.isFinite(n) && n > 0 && n <= 40) {
      onConfirm(n);
      setEditing(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <div className="text-[12px] text-subtle-foreground">Tailored resume · v1</div>
          <h3 className="truncate text-[15px] font-semibold tracking-tight">
            {job.title} <span className="font-normal text-muted-foreground">at {job.company}</span>
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {isPending && <span className="hidden text-[12px] text-pending-ink lg:inline">Answer 1 question to export</span>}
          {(["DOCX", "PDF"] as const).map((format) =>
            isPending ? (
              <Button key={format} variant="outline" size="sm" disabled>
                <Download data-icon="inline-start" />
                {format}
              </Button>
            ) : (
              <Button key={format} variant="outline" size="sm" asChild>
                <Link href={site.routes.signUp}>
                  <Download data-icon="inline-start" />
                  {format}
                </Link>
              </Button>
            ),
          )}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Resume page */}
        <div className="bg-muted/60 p-3 sm:p-5 md:overflow-y-auto scroll-thin">
          <article
            aria-label="Resume preview"
            className="mx-auto w-full max-w-[34rem] rounded-[3px] border bg-white px-5 py-5 text-[10.5px] leading-[1.45] text-zinc-800 shadow-[0_1px_3px_rgb(0_0_0/0.06)] sm:px-8 sm:py-7 sm:text-[11px]"
          >
            <header className="text-center">
              <div className="text-[16px] font-semibold tracking-tight text-zinc-950">{DEMO_CANDIDATE.name}</div>
              <div className="mt-0.5 text-zinc-500">{DEMO_CANDIDATE.contact}</div>
            </header>

            <ResumeSection title="Education">
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-zinc-950">{DEMO_CANDIDATE.school}</span>
                <span className="shrink-0 text-zinc-500">{DEMO_CANDIDATE.grad}</span>
              </div>
              <div>{DEMO_CANDIDATE.degree}</div>
              <div className="text-zinc-500">Coursework: {DEMO_CANDIDATE.coursework}</div>
            </ResumeSection>

            <ResumeSection title="Experience">
              <div className="space-y-2">
                {roles.slice(0, DEMO_EXPERIENCE.length).map((role) => (
                  <ResumeRoleBlock
                    key={role.org}
                    role={role}
                    hovered={hovered}
                    onHover={setHovered}
                    pendingId={isPending ? CASH_REPORT_BULLET_ID : null}
                  />
                ))}
              </div>
            </ResumeSection>

            <ResumeSection title="Leadership">
              <ResumeRoleBlock role={roles[roles.length - 1]} hovered={hovered} onHover={setHovered} pendingId={null} />
            </ResumeSection>

            <ResumeSection title="Skills">
              <div>{DEMO_CANDIDATE.skills}</div>
            </ResumeSection>
          </article>
        </div>

        {/* Reasoning panel */}
        <aside className="flex min-h-0 flex-col border-t lg:border-t-0 lg:border-l">
          <div role="tablist" aria-label="Resume reasoning" onKeyDown={onTabListKeyDown} className="flex gap-1 border-b p-2">
            {(
              [
                ["why", "Why this works"],
                ["cut", `What I cut (${DEMO_CUTS.length + (pending === "removed" ? 1 : 0)})`],
                ["checks", `Checks ${passed}/${checks.length}`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={panel === id}
                tabIndex={panel === id ? 0 : -1}
                onClick={() => setPanel(id)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[12.5px] whitespace-nowrap transition-colors",
                  panel === id ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-2.5 p-3 lg:overflow-y-auto scroll-thin">
            {panel === "why" && (
              <>
                {isPending && cashBullet?.pending && (
                  <div className="rounded-lg border border-pending/50 bg-pending-soft p-3">
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-pending-ink">
                      <CircleAlert className="size-3.5" />
                      Needs your OK before it goes on
                    </div>
                    <p className="mt-1.5 text-[13px] leading-5">{cashBullet.pending.question}</p>
                    {editing ? (
                      <form
                        className="mt-2.5 flex items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          saveEdit();
                        }}
                      >
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={40}
                          value={draftHours}
                          onChange={(e) => setDraftHours(e.target.value)}
                          aria-label="Hours saved per week"
                          className="h-7 w-14 rounded-md border bg-background px-2 text-[13px] tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                          autoFocus
                        />
                        <span className="text-[12.5px] text-muted-foreground">hours a week</span>
                        <Button type="submit" size="sm" className="ml-auto">
                          Save
                        </Button>
                      </form>
                    ) : (
                      <div className="mt-2.5 flex gap-1.5">
                        <Button size="sm" onClick={() => onConfirm(hours)}>
                          Yes
                        </Button>
                        <Button size="sm" variant="outline" className="bg-background" onClick={onRemove}>
                          No
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                          Edit
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {pending === "removed" && (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed p-3 text-[12.5px] text-muted-foreground">
                    Removed the cash report bullet. Add the real number anytime and it comes back.
                    <Button size="xs" variant="ghost" onClick={onUndo}>
                      <RotateCcw data-icon="inline-start" />
                      Undo
                    </Button>
                  </div>
                )}
                {bullets
                  .filter((b) => !(isPending && b.id === CASH_REPORT_BULLET_ID))
                  .map((b) => (
                    <div
                      key={b.id}
                      onMouseEnter={() => setHovered(b.id)}
                      onMouseLeave={() => setHovered(null)}
                      className={cn(
                        "rounded-lg border p-3 transition-colors",
                        hovered === b.id && "border-border-strong bg-muted/50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11.5px] text-subtle-foreground">
                        <span>Answers</span>
                        {b.id === CASH_REPORT_BULLET_ID && pending === "confirmed" && (
                          <span className="inline-flex items-center gap-1 text-brand-ink">
                            <Check className="size-3" strokeWidth={2.5} />
                            You confirmed this
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[13px] font-medium">&ldquo;{b.addresses[job.id]}&rdquo;</div>
                      <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">{b.why}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {b.facts.map((f) => (
                          <FactChip key={f}>{f}</FactChip>
                        ))}
                      </div>
                    </div>
                  ))}
              </>
            )}

            {panel === "cut" && (
              <>
                <p className="px-1 text-[12.5px] leading-5 text-muted-foreground">
                  These are true and confirmed. They didn&apos;t make this version because the page is one page and they
                  answer less of what this job asks for.
                </p>
                {pending === "removed" && (
                  <CutCard text={cashReportText(hours)} reason="You said the hours weren't right. Add the real number and it comes back." />
                )}
                {DEMO_CUTS.map((c) => (
                  <CutCard key={c.text} text={c.text} reason={c.reason} />
                ))}
              </>
            )}

            {panel === "checks" && (
              <ul className="divide-y rounded-lg border">
                {checks.map((c) => (
                  <li key={c.label} className="flex gap-2.5 p-3">
                    {c.status === "pass" ? (
                      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-brand text-white">
                        <Check className="size-2.5" strokeWidth={3.5} />
                      </span>
                    ) : c.status === "wait" ? (
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-pending" />
                    ) : (
                      <Minus className="mt-0.5 size-4 shrink-0 text-destructive" />
                    )}
                    <div>
                      <div className="text-[13px] font-medium">{c.label}</div>
                      <div className="mt-0.5 text-[12.5px] leading-5 text-muted-foreground">{c.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ResumeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3.5">
      <h4 className="mb-1.5 border-b border-zinc-300 pb-0.5 text-[9.5px] font-semibold tracking-[0.12em] text-zinc-950 uppercase">
        {title}
      </h4>
      {children}
    </section>
  );
}

function ResumeRoleBlock({
  role,
  hovered,
  onHover,
  pendingId,
}: {
  role: ResumeRole;
  hovered: string | null;
  onHover: (id: string | null) => void;
  pendingId: string | null;
}) {
  return (
    <div>
      <div className="flex justify-between gap-3">
        <span>
          <span className="font-semibold text-zinc-950">{role.org}</span>
          <span className="text-zinc-500"> · {role.title}</span>
        </span>
        <span className="shrink-0 text-zinc-500">{role.dates}</span>
      </div>
      <ul className="mt-0.5 space-y-0.5">
        {role.bullets.map((b) => {
          const isPending = b.id === pendingId;
          return (
            <li
              key={b.id}
              onMouseEnter={() => onHover(b.id)}
              onMouseLeave={() => onHover(null)}
              className={cn(
                "relative -mx-1 rounded-[3px] px-1 pl-3.5 transition-colors before:absolute before:left-1 before:content-['•']",
                hovered === b.id && "bg-brand-soft",
                isPending && "bg-pending-soft",
              )}
            >
              <span className={cn(isPending && "underline decoration-pending decoration-dashed underline-offset-[3px]")}>
                {b.text}
              </span>
              {isPending && (
                <span className="ml-1 rounded-sm bg-pending/25 px-1 text-[9px] font-medium tracking-wide text-pending-ink uppercase">
                  Not exported
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CutCard({ text, reason }: { text: string; reason: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex gap-2 text-[12.5px] leading-5 text-muted-foreground">
        <Scissors className="mt-0.5 size-3.5 shrink-0" />
        <span>{text}</span>
      </div>
      <p className="mt-1.5 pl-5.5 text-[12.5px] leading-5 text-foreground">{reason}</p>
    </div>
  );
}

type QualityCheck = { label: string; status: "pass" | "wait" | "fail"; detail: string };

/** Runs the same voice rules the export quality gate uses, against the bullets on the page. */
function runChecks(bullets: ResumeBullet[], hasPending: boolean): QualityCheck[] {
  const weak = bullets.map((b) => findWeakOpener(b.text)).filter((w): w is string => w !== null);
  const issues = bullets.flatMap((b) => findVoiceIssues(b.text));
  const emDashes = issues.filter((i) => i.rule === "em-dash").length;
  const banned = issues.filter((i) => i.rule === "banned-phrase").map((i) => i.match);

  return [
    { label: "Fits on one page", status: "pass", detail: "About 0.4 in of room left at the bottom." },
    hasPending
      ? {
          label: "Every claim is confirmed",
          status: "wait",
          detail: "1 bullet is waiting on you. It stays out of exports until you answer.",
        }
      : {
          label: "Every claim is confirmed",
          status: "pass",
          detail: `All ${bullets.length} bullets trace back to facts you confirmed.`,
        },
    weak.length
      ? { label: "Strong opening verbs", status: "fail", detail: `Weak openers: ${weak.join(", ")}.` }
      : {
          label: "Strong opening verbs",
          status: "pass",
          detail: bullets.map((b) => b.text.split(" ")[0]).join(", ") + ".",
        },
    emDashes
      ? { label: "No em dashes", status: "fail", detail: `Found ${emDashes}.` }
      : { label: "No em dashes", status: "pass", detail: "Checked every line." },
    banned.length
      ? { label: "Plain language", status: "fail", detail: `Filler found: ${banned.join(", ")}.` }
      : { label: "Plain language", status: "pass", detail: "No filler words or buzzwords." },
  ];
}
