import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { QuestionCard } from "@/components/onboarding/experience-step";
import { FactRow } from "@/components/onboarding/fact-row";
import { ExperienceCard } from "@/components/profile/experience-card";
import { LifeNote } from "@/components/profile/life-note";
import { StoryNotebook } from "@/components/profile/story-notebook";
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

const toView = (f: Fact) => ({ id: f.id, content: f.content, category: f.category, state: f.verificationState, source: f.source });

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

  return (
    <PageBody>
      <PageHeader
        title="Profile"
        description={`Everything your agent knows about you: ${confirmedCount} confirmed facts. Only confirmed facts ever reach a resume.`}
      />

      <StoryNotebook notes={storyNotes} />
      <LifeNote />

      {(questions.length > 0 || waitingFacts.length > 0) && (
        <section className="mt-8">
          <h2 className="text-[13px] font-medium text-pending-ink">Waiting on you ({questions.length + waitingFacts.length})</h2>
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

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section>
          <div className="flex items-end justify-between">
            <h2 className="text-[18px] font-semibold tracking-tight">Experience</h2>
            <Link href="/app/onboarding?step=experience" className="text-[13px] text-muted-foreground hover:text-foreground">
              Add experience
            </Link>
          </div>
          <div className="mt-4 space-y-4">
            {experiences.length === 0 && (
              <div className="rounded-xl border border-dashed p-8 text-center text-[14px] text-muted-foreground">
                No experience yet.{" "}
                <Link href="/app/onboarding" className="font-medium text-foreground underline-offset-4 hover:underline">
                  Tell your agent about a job, club, or project
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
              <Row label="School" value={profile?.school} />
              <Row label="Degree" value={[profile?.degree, profile?.major].filter(Boolean).join(", ")} />
              <Row label="Graduation" value={profile?.gradDate ? formatMonth(profile.gradDate) : null} />
              <Row label="GPA" value={profile?.gpa != null ? String(profile.gpa) : null} />
              <Row label="Location" value={[profile?.city, profile?.region].filter(Boolean).join(", ")} />
            </dl>
          </SideCard>
          <SideCard title="What you want" edit="/app/onboarding?step=goals">
            <dl className="space-y-2 text-[13.5px]">
              <Row label="Roles" value={profile?.targetRoles.join(", ")} />
              <Row label="When" value={profile?.targetTerm} />
              <Row label="Where" value={profile?.targetLocations.join(", ")} />
              <Row label="Setup" value={profile?.workModes.join(", ")} />
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
    </PageBody>
  );
}

function SideCard({ title, edit, children }: { title: string; edit: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[13.5px] font-semibold">{title}</h2>
        <Link href={edit} aria-label={`Edit ${title}`} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
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
      <dt className="w-20 shrink-0 text-subtle-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value || <span className="text-subtle-foreground">Not set</span>}</dd>
    </div>
  );
}
