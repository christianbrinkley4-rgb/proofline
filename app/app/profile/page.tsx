import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { StoryStart } from "@/components/coach/story-start";
import { QuestionCard } from "@/components/onboarding/experience-step";
import { FactRow } from "@/components/onboarding/fact-row";
import { EvidenceLegend } from "@/components/shared/evidence-tag";
import { ExperienceCard } from "@/components/profile/experience-card";
import { LifeNote } from "@/components/profile/life-note";
import { StoryNotebook } from "@/components/profile/story-notebook";
import { VoiceStory } from "@/components/profile/voice-story";
import type { BulletCheck } from "@/lib/resume/bullet-score";
import { requireSession } from "@/lib/auth";
import { listExperiences } from "@/lib/kb/experiences";
import { listFacts, type Fact } from "@/lib/kb/facts";
import { getProfile } from "@/lib/kb/profile";
import { listStoryNotes } from "@/lib/kb/story";
import { listOpenQuestions } from "@/lib/kb/questions";
import { listBullets } from "@/lib/resume/bullets/service";
import { formatMonth, formatRange } from "@/lib/resume/parse/dates";

export const metadata: Metadata = { title: "Profile" };

const toView = (f: Fact) => ({ id: f.id, content: f.content, category: f.category, state: f.verificationState, source: f.source, sourceDetail: f.sourceDetail });

export default async function ProfilePage() {
  const session = await requireSession();
  const userId = session.user.id;
  const [profile, experiences, facts, questions, bullets, storyNotes] = await Promise.all([
    getProfile(userId),
    listExperiences(userId),
    listFacts(userId),
    listOpenQuestions(userId),
    listBullets(userId),
    listStoryNotes(userId),
  ]);

  const orgFor = new Map(experiences.map((e) => [e.id, e.org]));
  const waitingFacts = facts.filter((f) => f.verificationState !== "confirmed" && !["skill", "tool"].includes(f.category));
  const skills = facts.filter((f) => ["skill", "tool"].includes(f.category) && f.verificationState === "confirmed");
  const confirmedCount = facts.filter((f) => f.verificationState === "confirmed").length;
  const waitingCount = questions.length + waitingFacts.length;
  // Nothing to show yet: one way in, not every capture tool at once.
  const empty = experiences.length === 0 && confirmedCount === 0 && waitingCount === 0;
  const firstName = (profile?.fullName || session.user.name).split(/\s+/)[0] ?? "";
  // The one thing between them and a resume: a role with confirmed facts but no resume lines yet.
  const needsLines = experiences.find(
    (e) =>
      e.kind !== "education" &&
      !bullets.some((b) => b.experienceId === e.id && b.status === "active") &&
      facts.some((f) => f.experienceId === e.id && f.verificationState === "confirmed"),
  );

  return (
    <PageBody>
      <PageHeader
        title="Profile"
        description={
          empty
            ? "Your agent learns about you here. Only facts you confirm ever reach a resume."
            : `Everything your agent knows about you: ${confirmedCount} confirmed facts. Only confirmed facts ever reach a resume.`
        }
      />

      {empty && <StoryStart name={firstName} />}

      {!empty && <EvidenceLegend className="mt-5" />}

      {needsLines && (
        <p className="mt-6 rounded-xl border border-brand/30 bg-brand-soft/50 px-4 py-3 text-[13.5px] leading-6">
          <span className="font-medium">Next:</span> press <span className="font-medium">Write bullets</span> on {needsLines.org}. I&apos;ll draft
          resume lines from its confirmed facts, and you can edit any of them. Roles without resume lines stay off your resume.
        </p>
      )}

      {waitingCount > 0 && (
        <section className="mt-8 rounded-2xl border border-pending/30 bg-pending-soft/40 p-5 sm:p-6">
          {waitingFacts.length > 0 ? (
            <>
              <h2 className="text-[15px] font-semibold">Check these first <span className="font-normal text-pending-ink">({waitingCount} waiting on you)</span></h2>
              <p className="mt-1 text-[13px] text-muted-foreground">Say yes to what&apos;s true, fix what&apos;s close. Confirmed facts power your matches and resumes.</p>
            </>
          ) : (
            <>
              <h2 className="text-[15px] font-semibold">Questions from your agent <span className="font-normal text-pending-ink">({questions.length}, optional)</span></h2>
              <p className="mt-1 text-[13px] text-muted-foreground">An honest answer can make a resume line stronger. Skip anything you&apos;re unsure of.</p>
            </>
          )}
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {questions.slice(0, 6).map((q) => (
              <QuestionCard
                key={q.id}
                question={{ id: q.id, prompt: q.prompt, kind: q.kind, proposedValue: q.kind === "yes_no" ? null : q.proposedValue }}
                org={q.experienceId ? orgFor.get(q.experienceId) : undefined}
              />
            ))}
          </div>
          {waitingFacts.length > 0 && (
            <ul className="mt-3 space-y-2">
              {waitingFacts.slice(0, 10).map((f) => (
                <FactRow key={f.id} fact={toView(f)} />
              ))}
            </ul>
          )}
        </section>
      )}

      {!empty && (
      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section>
          <div className="flex items-end justify-between">
            <h2 className="text-[18px] font-semibold tracking-tight">Experience</h2>
            <Link href="#start" className="text-[13px] text-muted-foreground hover:text-foreground">
              Add experience
            </Link>
          </div>
          <div className="mt-4 space-y-4">
            {experiences.length === 0 && (
              <div className="rounded-xl border border-dashed p-8 text-center text-[14px] text-muted-foreground">
                No experience recorded yet.{" "}
                <Link href="#start" className="font-medium text-foreground underline-offset-4 hover:underline">
                  Tell your agent about work, a project, or volunteering
                </Link>
                .
              </div>
            )}
            {experiences.map((e) => (
              <ExperienceCard
                key={e.id}
                experience={{
                  id: e.id,
                  kind: e.kind,
                  org: e.org,
                  title: e.title,
                  location: e.location,
                  startDate: e.startDate,
                  endDate: e.endDate,
                  dates: e.startDate || e.endDate ? formatRange(e.startDate, e.endDate) : "",
                  facts: facts.filter((f) => f.experienceId === e.id).map(toView),
                  bullets: bullets
                    .filter((b) => b.experienceId === e.id)
                    .map((b) => ({
                      id: b.id,
                      text: b.text,
                      score: b.score,
                      favorite: b.favorite,
                      status: b.status,
                      verified: b.status === "active",
                      checks: ((b.scoreDetail?.checks as BulletCheck[] | undefined) ?? []),
                    })),
                }}
              />
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <SideCard title="About you" edit="/app/onboarding?step=basics">
            <dl className="space-y-2 text-[13.5px]">
              <Row label="Name" value={profile?.fullName} />
              <Row label="Location" value={[profile?.city, profile?.region].filter(Boolean).join(", ")} />
              {(profile?.school || profile?.degree || profile?.major || profile?.gradDate || profile?.gpa != null) && (
                <>
                  <Row label="School" value={profile?.school} />
                  <Row label="Degree" value={[profile?.degree, profile?.major].filter(Boolean).join(", ")} />
                  <Row label="Graduation" value={profile?.gradDate ? formatMonth(profile.gradDate) : null} />
                  <Row label="GPA" value={profile?.gpa != null ? String(profile.gpa) : null} />
                </>
              )}
            </dl>
          </SideCard>
          <SideCard title="What you want" edit="/app/onboarding?step=goals">
            <dl className="space-y-2 text-[13.5px]">
              <Row label="Roles" value={profile?.targetRoles.join(", ")} />
              <Row label="When" value={profile?.targetTerm} />
              <Row label="Where" value={profile?.targetLocations.join(", ")} />
              <Row label="Setup" value={profile?.workModes.join(", ")} />
              <Row label="Pay floor" value={profile?.payFloor ? `$${profile.payFloor}${profile.payFloor < 500 ? "/hr" : "/yr"}` : null} />
              <Row
                label="Deal-breakers"
                value={profile?.dealBreakers.map((b) => (b.toLowerCase().startsWith("company:") ? `${b.slice(8).trim()} (company)` : b)).join(", ")}
              />
            </dl>
          </SideCard>
          <SideCard title={`Skills (${skills.length})`} edit="/app/onboarding?step=skills">
            <div className="flex flex-wrap gap-1.5">
              {skills.length === 0 && <p className="text-[13px] text-muted-foreground">None yet.</p>}
              {skills.map((s) => (
                <span key={s.id} className="rounded-md bg-muted px-2 py-0.5 text-[12.5px]">
                  {s.content}
                </span>
              ))}
            </div>
          </SideCard>
        </aside>
      </div>
      )}

      {!empty && (
        <section id="start" className="mt-12 border-t pt-10">
          <h2 className="font-display text-[24px] font-semibold">Add to your story</h2>
          <p className="mt-1 max-w-2xl text-[14px] leading-6 text-muted-foreground">
            New job, class project, or win? Talk it out, write a structured entry, or jot a private note to organize later.
          </p>
          <VoiceStory />
          <LifeNote />
          <StoryNotebook notes={storyNotes} />
        </section>
      )}
    </PageBody>
  );
}

function SideCard({ title, edit, children }: { title: string; edit: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        <Link href={edit} aria-label={`Edit ${title}`} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground pointer-coarse:size-10">
          <Pencil className="size-3.5" />
        </Link>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-subtle-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value || <span className="text-subtle-foreground">Not set</span>}</dd>
    </div>
  );
}
