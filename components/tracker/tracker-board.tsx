"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, CalendarClock, Check, FileText, GripVertical, LayoutList, MailCheck, Plus, Search, SquareKanban, X } from "lucide-react";
import { toast } from "sonner";
import { addManualApplicationAction, deleteApplicationAction, moveApplicationAction, recordReplyAction, updateApplicationAction } from "@/app/app/tracker/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { KitGroups } from "@/components/packet/answer-kit";
import { readSent, sentSummary } from "@/lib/packet/sent-record";
import { followUpState, safeJobUrl, STAGES, STAGE_LABEL, stagePatch, trackerStats, type Application, type Stage } from "@/lib/tracker/model";
import { REPLY_LABEL, type ApplicationActivity, type ReplyKind } from "@/lib/tracker/activity";
import { cn } from "@/lib/utils";
import { RelationshipLane } from "./relationship-lane";
import type { RelationshipLane as Lane } from "@/lib/outreach/model";
import { InterviewOutcomes, type InterviewInsight } from "./interview-outcomes";
import { ApplicationGates, type ApplicationGatesView } from "./application-gates";

export type ApplicationInsight = { score: number; strengths: string[]; gaps: string[]; nextSteps: string[]; versions: number };

const date = (value: Date | string | null) => {
  if (!value) return "";
  const dateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(dateOnly ? { timeZone: "UTC" } : {}) });
};
const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring";
const errorMessage = "Couldn't save that change. Your information is still here; please try again.";

export function TrackerBoard({ applications, insights, interviews = {}, relationships = {}, gates = {}, activity, name, now, initialAppId = null }: {
  applications: Application[]; insights: Record<string, ApplicationInsight>; interviews?: Record<string, InterviewInsight>; relationships?: Record<string, Lane>; gates?: Record<string, ApplicationGatesView>; activity: ApplicationActivity[]; name: string; now: string; initialAppId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"board" | "list">("board");
  const [dueOnly, setDueOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(initialAppId);
  const [reviewFollowUp, setReviewFollowUp] = useState(false);
  const [adding, setAdding] = useState(false);
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [pending, startTransition] = useTransition();
  const instant = new Date(now);
  // Moves and "Mark as sent" show on the board and in the counts at once; the server catches up.
  const [apps, applyLocal] = useOptimistic(applications, (state: Application[], change: { id: string; stage?: Stage; sent?: boolean }) =>
    state.map((a) => {
      if (a.id !== change.id) return a;
      if (change.sent) return { ...a, followUpSentAt: new Date() };
      return change.stage ? ({ ...a, ...stagePatch(a, change.stage, new Date()) } as Application) : a;
    }),
  );
  const stats = trackerStats(apps, instant);
  const repliesLogged = new Set(activity.filter((item) => item.type === "reply").map((item) => item.applicationId)).size;
  const isDue = (a: Application) => followUpState(a, instant) === "due";
  const visible = apps.filter((a) => (!dueOnly || isDue(a)) && (a.company + " " + a.title + " " + (a.confirmationRef ?? "")).toLowerCase().includes(query.toLowerCase()));
  const active = apps.find((a) => a.id === selected);
  function openApplication(id: string, followUp = false) { setReviewFollowUp(followUp); setSelected(id); }
  function move(id: string, stage: Stage) {
    startTransition(async () => {
      applyLocal({ id, stage });
      try { await moveApplicationAction(id, stage); toast("Moved to " + STAGE_LABEL[stage] + "."); }
      catch { toast.error(errorMessage); }
    });
  }
  return (
    <>
      <Link href="/app/calibration" className="mt-5 inline-block text-sm font-medium underline">Check interview prediction accuracy</Link>
      {/* Counters and filters only help once there's something to count. */}
      {apps.length > 0 && (<>
      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Applications", stats.applications, "Roles you've applied to"],
          ["Replies logged", repliesLogged, "Only replies you record"],
          ["Active interviews & offers", stats.interviews, "Current stage"],
          ["Follow-ups due", stats.dueFollowUps, "A good time to check in"],
        ].map(([label, value, detail]) => (
          <div key={label} className="rounded-xl border bg-background p-4">
            <p className="text-[12px] text-muted-foreground">{label}</p>
            <p className={cn("mt-1 text-3xl font-semibold tracking-tight tabular-nums", label === "Follow-ups due" && stats.dueFollowUps > 0 && "text-pending-ink")}>{value}</p>
            <p className="mt-1 text-[11.5px] text-subtle-foreground">{detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-7 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 max-sm:basis-full sm:max-w-xs">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-subtle-foreground" />
          <Input aria-label="Search applications" placeholder="Search role, company, or confirmation #" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
        <Button variant={dueOnly ? "secondary" : "outline"} size="sm" aria-pressed={dueOnly} onClick={() => setDueOnly(!dueOnly)}>
          <CalendarClock data-icon="inline-start" /> Follow-ups {stats.dueFollowUps > 0 && <span className="tabular-nums">{stats.dueFollowUps}</span>}
        </Button>
        <div className="ml-auto flex rounded-lg border p-0.5" role="group" aria-label="Applications view">
          <Button variant={view === "board" ? "secondary" : "ghost"} size="icon-sm" aria-label="Board view" aria-pressed={view === "board"} onClick={() => setView("board")}><SquareKanban /></Button>
          <Button variant={view === "list" ? "secondary" : "ghost"} size="icon-sm" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><LayoutList /></Button>
        </div>
        <Button size="sm" onClick={() => setAdding(true)}><Plus data-icon="inline-start" />Add application</Button>
      </div>
      </>)}
      {apps.length === 0 ? (
        <div className="mt-7 rounded-xl border border-dashed px-6 py-14 text-center">
          <BriefcaseBusiness className="mx-auto size-8 text-subtle-foreground" strokeWidth={1.25} />
          <h2 className="mt-4 text-xl font-semibold tracking-tight">Nothing tracked yet.</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Track a job from its page, or add one you applied to somewhere else.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2"><Button asChild><Link href="/app/jobs">Paste a job<ArrowRight data-icon="inline-end" /></Link></Button><Button variant="outline" onClick={() => setAdding(true)}>Add a role manually</Button></div>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-5 rounded-xl border p-10 text-center text-sm text-muted-foreground">No applications match these filters.<Button className="ml-2" variant="ghost" onClick={() => { setQuery(""); setDueOnly(false); }}>Clear filters</Button></div>
      ) : view === "board" ? (
        <div className="mt-5 overflow-x-auto pb-4" tabIndex={0} aria-label="Application board. Scroll to see all stages. Use a card's stage selector to move it with a keyboard." aria-busy={pending}>
          <div className="grid min-w-[1512px] grid-cols-6 items-start gap-3">
            {STAGES.map((stage) => {
              const cards = visible.filter((a) => a.stage === stage);
              return (
                <section key={stage} aria-label={STAGE_LABEL[stage]} onDragOver={(e) => { e.preventDefault(); setOver(stage); }} onDragLeave={() => setOver(null)} onDrop={(e) => { e.preventDefault(); if (dragged && !pending) move(dragged, stage); setDragged(null); setOver(null); }} className={cn("min-h-72 rounded-xl border bg-muted/40 p-2 transition-colors", over === stage && "border-border-strong bg-muted")}>
                  <header className="mb-2 flex items-center justify-between px-2 py-2"><h2 className="flex items-center gap-2 text-[13px] font-medium"><span className={cn("size-1.5 rounded-full bg-border-strong", stage === "offer" && "bg-brand", stage === "applied" && "bg-pending")} />{STAGE_LABEL[stage]}</h2><span className="font-mono text-xs text-subtle-foreground">{cards.length}</span></header>
                  <div className="space-y-2">{cards.map((a) => <ApplicationCard key={a.id} app={a} insight={insights[a.id]} interview={interviews[a.id]} due={isDue(a)} pending={pending} onOpen={() => openApplication(a.id)} onMove={(s) => move(a.id, s)} onSent={() => openApplication(a.id, true)} onDrag={() => setDragged(a.id)} onDragEnd={() => { setDragged(null); setOver(null); }} />)}</div>
                  {!cards.length && <p className="px-3 py-8 text-center text-xs text-subtle-foreground">{dragged ? "Drop here" : "No roles here yet"}</p>}
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <ApplicationTable apps={visible} instant={instant} pending={pending} onOpen={(id) => openApplication(id)} onMove={move} onSent={(id) => openApplication(id, true)} />
      )}
      {apps.length > 0 && <p className="mt-2 text-[12px] leading-5 text-subtle-foreground">Proofline never applies for you. Apply on the employer&apos;s site, then mark the role Applied here; you choose what to send when the follow-up comes due.</p>}
      <Dialog open={adding} onOpenChange={setAdding}><DialogContent><DialogHeader><DialogTitle>Add an application</DialogTitle><DialogDescription>A role from anywhere, all in one place.</DialogDescription></DialogHeader><AddApplication onDone={() => setAdding(false)} /></DialogContent></Dialog>
      <Sheet open={Boolean(active)} onOpenChange={(open) => { if (!open) setSelected(null); }}><SheetContent className="data-[side=right]:w-full sm:data-[side=right]:max-w-lg overflow-y-auto">
        {active && <ApplicationDetail key={active.id} app={active} insight={insights[active.id]} interview={interviews[active.id]} lane={relationships[active.id]} gates={gates[active.id]} due={isDue(active)} reviewFollowUp={reviewFollowUp} logs={activity.filter((item) => item.applicationId === active.id)} name={name} onClose={() => setSelected(null)} />}
      </SheetContent></Sheet>
    </>
  );
}

function ApplicationTable({ apps, instant, pending, onOpen, onMove, onSent }: {
  apps: Application[]; instant: Date; pending: boolean; onOpen: (id: string) => void; onMove: (id: string, stage: Stage) => void; onSent: (id: string) => void;
}) {
  // Soonest deadline first, then the rest by the date applied.
  const rows = [...apps].sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") || (b.appliedAt ? new Date(b.appliedAt).getTime() : 0) - (a.appliedAt ? new Date(a.appliedAt).getTime() : 0));
  return (
    <div className="mt-5 overflow-x-auto rounded-xl border bg-background">
      <table className="w-full min-w-[760px] text-left text-[13px]">
        <thead className="border-b bg-muted/40 text-[12px] text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Role</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Deadline</th>
            <th className="px-3 py-2 font-medium">Applied</th>
            <th className="px-3 py-2 font-medium">Follow-up</th>
            <th className="px-3 py-2 font-medium">Confirmation</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((a) => {
            const follow = followUpState(a, instant);
            return (
              <tr key={a.id}>
                <td className="px-3 py-2.5">
                  <button type="button" onClick={() => onOpen(a.id)} className="text-left hover:underline">
                    <span className="block font-medium">{a.title}</span>
                    <span className="block text-[12px] text-muted-foreground">{a.company}</span>
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <select aria-label={`Stage for ${a.title} at ${a.company}`} className={cn(selectClass, "w-32")} value={a.stage} disabled={pending} onChange={(e) => onMove(a.id, e.target.value as Stage)}>
                    {STAGES.map((stage) => <option key={stage} value={stage}>{STAGE_LABEL[stage]}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2.5 tabular-nums">{a.deadline ? date(a.deadline) : <span className="text-subtle-foreground">None</span>}</td>
                <td className="px-3 py-2.5 tabular-nums">{a.appliedAt ? date(a.appliedAt) : <span className="text-subtle-foreground">Not yet</span>}</td>
                <td className="px-3 py-2.5">
                  {follow === "due" ? (
                    <Button size="xs" variant="outline" disabled={pending} onClick={() => onSent(a.id)}><MailCheck data-icon="inline-start" />Review follow-up</Button>
                  ) : follow === "sent" ? (
                    <span className="text-muted-foreground">Sent {date(a.followUpSentAt)}</span>
                  ) : follow === "upcoming" ? (
                    <span className="tabular-nums">Due {date(a.nextFollowUpAt)}</span>
                  ) : (
                    <span className="text-subtle-foreground">None</span>
                  )}
                </td>
                <td className="px-3 py-2.5">{a.confirmationRef || <span className="text-subtle-foreground">None</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ApplicationCard({ app, insight, interview, due, pending, onOpen, onMove, onSent, onDrag, onDragEnd }: {
  app: Application; insight?: ApplicationInsight; interview?: InterviewInsight; due: boolean; pending: boolean; onOpen: () => void; onMove: (stage: Stage) => void; onSent: () => void; onDrag?: () => void; onDragEnd?: () => void;
}) {
  return (
    <article draggable={Boolean(onDrag) && !pending} onDragStart={(e) => { e.dataTransfer.setData("text/plain", app.id); e.dataTransfer.effectAllowed = "move"; onDrag?.(); }} onDragEnd={onDragEnd} className="rounded-lg border bg-background p-3 shadow-xs">
      <div className="flex items-start gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
          <span className="block truncate text-[12px] text-muted-foreground">{app.company}</span>
          <span className="mt-1 block text-[13px] leading-5 font-medium">{app.title}</span>
        </button>
        {onDrag && <GripVertical aria-hidden="true" className="mt-1 size-3.5 shrink-0 text-subtle-foreground" />}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        {insight && <span className="rounded border px-1.5 py-0.5">{`${insight.score} fit`}</span>}
        {app.resumeId && <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-muted-foreground"><FileText className="size-3" />Resume attached</span>}
        {app.sent && <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-muted-foreground"><Check className="size-3" />Record of what you sent</span>}
        {app.appliedAt && <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">Applied {date(app.appliedAt)}</span>}
        {app.deadline && <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">Deadline {date(app.deadline)}</span>}
        {app.confirmationRef && <span className="max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-muted-foreground">Conf. {app.confirmationRef}</span>}
        {due && <span className="rounded bg-pending-soft px-1.5 py-0.5 text-pending-ink">Follow-up due</span>}
        {app.followUpSentAt && <span className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground"><Check className="size-3" />Follow-up sent {date(app.followUpSentAt)}</span>}
      </div>
      {due && <Button size="xs" variant="outline" className="mt-2 w-full" disabled={pending} onClick={onSent}><MailCheck data-icon="inline-start" />Review follow-up</Button>}
      <label className="mt-3 block"><span className="sr-only">Stage for {app.title} at {app.company}</span><select className={selectClass} value={app.stage} disabled={pending} onChange={(e) => onMove(e.target.value as Stage)}>{STAGES.map((stage) => <option key={stage} value={stage}>{STAGE_LABEL[stage]}</option>)}</select></label>
      <InterviewOutcomes applicationId={app.id} submitted={Boolean(app.appliedAt)} data={interview} />
    </article>
  );
}

function AddApplication({ onDone }: { onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return <form className="space-y-4" onSubmit={(e) => {
    e.preventDefault(); const form = new FormData(e.currentTarget); setError("");
    startTransition(async () => {
      try { await addManualApplicationAction({ company: String(form.get("company")), title: String(form.get("title")), url: String(form.get("url") || "") || undefined, stage: String(form.get("stage")) as Stage }); onDone(); toast("Application added."); }
      catch { setError("Check the fields and try again. Links must start with https:// or http://."); }
    });
  }}>
    <label className="block space-y-1.5 text-sm"><span>Company</span><Input name="company" required maxLength={160} placeholder="Company name" /></label>
    <label className="block space-y-1.5 text-sm"><span>Role</span><Input name="title" required maxLength={200} placeholder="Position title" /></label>
    <label className="block space-y-1.5 text-sm"><span>Posting link <span className="text-muted-foreground">(optional)</span></span><Input name="url" type="url" maxLength={2000} placeholder="https://" /></label>
    <label className="block space-y-1.5 text-sm"><span>Stage</span><select name="stage" className={selectClass} defaultValue="saved">{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select></label>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : "Add application"}</Button>
  </form>;
}

function ApplicationDetail({ app, insight, interview, lane, gates, due, reviewFollowUp, logs, onClose }: { app: Application; insight?: ApplicationInsight; interview?: InterviewInsight; lane?: Lane; gates?: ApplicationGatesView; due: boolean; reviewFollowUp: boolean; logs: ApplicationActivity[]; name: string; onClose: () => void }) {
  const [notes, setNotes] = useState(app.notes ?? "");
  const [deadline, setDeadline] = useState(app.deadline ?? "");
  const [confirmationRef, setConfirmationRef] = useState(app.confirmationRef ?? "");
  const [contact, setContact] = useState(app.contacts?.[0]?.name ?? "");
  const [email, setEmail] = useState(app.contacts?.[0]?.email ?? "");
  const [replyKind, setReplyKind] = useState<ReplyKind>("update");
  const [replySummary, setReplySummary] = useState("");
  const [whatHelped, setWhatHelped] = useState("");
  const [nextTime, setNextTime] = useState("");
  const [consentToImprove, setConsentToImprove] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const url = safeJobUrl(app.url);
  const sent = readSent(app.sent);
  const sentCounts = sent ? sentSummary(sent) : null;
  function run(action: () => Promise<unknown>, message: string) {
    startTransition(async () => { try { await action(); toast(message); } catch { toast.error(errorMessage); } });
  }
  return <>
    <SheetHeader className="border-b pr-12"><SheetTitle>{app.title}</SheetTitle><SheetDescription>{app.company} · {STAGE_LABEL[app.stage]}{app.appliedAt ? " · Applied " + date(app.appliedAt) : ""}</SheetDescription></SheetHeader>
    <div className="space-y-6 px-4 pb-8">
      <div className="flex flex-wrap gap-2">
        {url && <Button asChild size="sm"><a href={url} target="_blank" rel="noreferrer">Open posting<ArrowUpRight data-icon="inline-end" /></a></Button>}
        {app.jobId && <Button asChild size="sm" variant="outline"><Link href={"/app/jobs/" + app.jobId}>Fit score</Link></Button>}
        {app.jobId && <Button asChild size="sm" variant="outline"><Link href={"/app/jobs/" + app.jobId + "?tab=resume"}><FileText data-icon="inline-start" />{app.resumeId ? "Linked resume" : "Make a resume"}</Link></Button>}
        {app.jobId && !sent && <Button asChild size="sm" variant="outline"><Link href={"/app/jobs/" + app.jobId + "/kit"}>Application answers</Link></Button>}
      </div>
      {sent && sentCounts && <section className="rounded-xl border p-4">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span>
              <span className="block text-sm font-semibold">What you sent</span>
              <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">Saved {date(sent.at)} from your answer kit: {sentCounts.filled} fields filled from what you confirmed, {sentCounts.blank} left blank.</span>
            </span>
            <ArrowRight aria-hidden="true" className="mt-1 size-3.5 shrink-0 text-subtle-foreground transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-4"><KitGroups groups={sent.kit.groups} readOnly /></div>
        </details>
        {app.jobId && <Link href={"/app/jobs/" + app.jobId + "/kit"} className="mt-3 inline-flex min-h-8 items-center gap-1 text-xs font-medium hover:underline">Open it as a page<ArrowRight className="size-3" /></Link>}
      </section>}
      {!app.jobId && <div className="rounded-lg border border-dashed p-3 text-[12.5px] leading-5 text-muted-foreground">
        Paste this posting on Jobs to get the knockouts, a fit score, and a tailored resume for it. It links up with this entry automatically.
        <Button asChild size="sm" variant="outline" className="mt-2 flex w-fit"><Link href="/app/jobs">Paste the posting</Link></Button>
      </div>}
      {insight && <section className="rounded-xl border p-4">
        <div className="flex items-baseline justify-between"><h3 className="text-sm font-semibold">Your plan for this role</h3><span className="text-sm font-medium tabular-nums">{insight.score}/100 fit</span></div>
        <p className="mt-1 text-xs text-muted-foreground">Match to your confirmed background, not a hiring prediction.</p>
        <h4 className="mt-4 text-xs font-medium text-brand-ink">What to lead with</h4>
        <ul className="mt-2 space-y-2 text-[13px]">{(insight.strengths.length ? insight.strengths : ["Add more of your experience to see what to lead with."]).map((s) => <li key={s} className="flex gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-brand" />{s}</li>)}</ul>
        <h4 className="mt-4 text-xs font-medium">Gaps to address</h4>
        <ul className="mt-2 space-y-2 text-[13px] text-muted-foreground">{(insight.gaps.length ? insight.gaps : ["No obvious gaps in the available posting. Check the employer's full requirements."]).map((s) => <li key={s}>{s}</li>)}</ul>
        <h4 className="mt-4 text-xs font-medium">Make your next move count</h4>
        <ol className="mt-2 list-decimal space-y-2 pl-4 text-[13px] leading-5">{insight.nextSteps.map((s) => <li key={s}>{s}</li>)}</ol>
      </section>}
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => updateApplicationAction(app.id, { notes, deadline: deadline || null, confirmationRef: confirmationRef.trim() || null, contacts: contact.trim() ? [{ name: contact.trim(), email }, ...(app.contacts ?? []).slice(1)] : [] }), "Application details saved."); }}>
        <h3 className="text-sm font-semibold">Details</h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1.5 text-xs"><span>Deadline</span><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
          <label className="block space-y-1.5 text-xs"><span>Confirmation reference</span><Input value={confirmationRef} onChange={(e) => setConfirmationRef(e.target.value)} maxLength={160} placeholder="From their confirmation email" /></label>
        </div>
        <label className="block space-y-1.5 text-xs"><span>Notes</span><Textarea aria-label="Application notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} rows={4} placeholder="Interview prep, conversations, what to do next..." /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1.5 text-xs"><span>Contact name</span><Input value={contact} maxLength={160} onChange={(e) => setContact(e.target.value)} /></label>
          <label className="space-y-1.5 text-xs"><span>Contact email</span><Input type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} /></label>
        </div>
        <Button size="sm" type="submit" disabled={pending}>Save details</Button>
      </form>
      <InterviewOutcomes applicationId={app.id} submitted={Boolean(app.appliedAt)} data={interview} />
      <ApplicationGates gates={gates} />
      {app.jobId && <RelationshipLane applicationId={app.id} lane={lane} submitted={Boolean(app.appliedAt)} due={due} reviewFollowUp={reviewFollowUp} />}
      {app.appliedAt && <section className="space-y-3 border-t pt-5">
        <h3 className="text-sm font-semibold">Record a reply</h3>
        <p className="text-xs leading-5 text-muted-foreground">Log what the employer actually said. Invitations and decisions update the application stage; a general update leaves it as is.</p>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await recordReplyAction(app.id, { kind: replyKind, summary: replySummary, whatHelped, nextTime, consentToImprove });
            setReplySummary("");
            setWhatHelped("");
            setNextTime("");
            setConsentToImprove(false);
          }, "Reply recorded.");
        }}>
          <label className="block space-y-1.5 text-xs"><span>What happened?</span><select className={selectClass} value={replyKind} onChange={(e) => setReplyKind(e.target.value as ReplyKind)}>{(Object.keys(REPLY_LABEL) as ReplyKind[]).map((kind) => <option key={kind} value={kind}>{REPLY_LABEL[kind]}</option>)}</select></label>
          <label className="block space-y-1.5 text-xs"><span>Your note</span><Textarea value={replySummary} onChange={(e) => setReplySummary(e.target.value)} required minLength={2} maxLength={3000} rows={3} placeholder="Who replied, what they said, and any next step..." /></label>
          <p className="text-xs leading-5 text-muted-foreground">Optional reflection: these are your clues, not proof that a resume or letter caused the result.</p>
          <label className="block space-y-1.5 text-xs"><span>What might have helped?</span><Textarea value={whatHelped} onChange={(e) => setWhatHelped(e.target.value)} maxLength={800} rows={2} placeholder="A relevant project, referral, interview answer..." /></label>
          <label className="block space-y-1.5 text-xs"><span>What will you try next time?</span><Textarea value={nextTime} onChange={(e) => setNextTime(e.target.value)} maxLength={800} rows={2} placeholder="One change you can actually test..." /></label>
          <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <input type="checkbox" checked={consentToImprove} onChange={(e) => setConsentToImprove(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-foreground" />
            <span>Allow Proofline to consider this reply and reflection in future guidance improvements for others. Optional and off by default.</span>
          </label>
          <Button size="sm" type="submit" disabled={pending || replySummary.trim().length < 2}>Record reply</Button>
        </form>
      </section>}
      {logs.length > 0 && <section className="border-t pt-5"><h3 className="text-sm font-semibold">Activity</h3><ol className="mt-3 space-y-2">{logs.map((log) => <li key={log.id} className="rounded-lg border p-3"><p className="text-[11px] text-subtle-foreground">{date(log.at)}</p><p className="mt-0.5 text-[13px] font-medium">{log.title}</p>{log.detail && <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{log.detail}</p>}{log.whatHelped && <p className="mt-1 text-xs leading-5"><span className="font-medium">Possible help:</span> {log.whatHelped}</p>}{log.nextTime && <p className="mt-1 text-xs leading-5"><span className="font-medium">Next experiment:</span> {log.nextTime}</p>}{log.subject && log.body && <details className="mt-2 text-xs"><summary className="cursor-pointer text-muted-foreground">View saved draft: {log.subject}</summary><p className="mt-2 whitespace-pre-wrap leading-5 text-muted-foreground">{log.body}</p></details>}</li>)}</ol></section>}
      <div className="border-t pt-5">{confirmDelete ? <div className="space-y-2"><p className="text-xs text-destructive">Remove this application and its notes? Your resume files will remain.</p><div className="flex gap-2"><Button size="sm" variant="destructive" disabled={pending} onClick={() => run(async () => { await deleteApplicationAction(app.id); onClose(); }, "Application removed.")}>Remove application</Button><Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button></div></div> : <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}><X data-icon="inline-start" />Remove application</Button>}</div>
    </div>
  </>;
}


