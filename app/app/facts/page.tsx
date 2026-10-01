import type { Metadata } from "next";
import Link from "next/link";
import { FileUp, Plus, ShieldCheck } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { AddFact, DeleteEducationButton, DeleteRoleButton, FactRow, type FactRowView } from "@/components/facts/fact-list";
import { DraftLinesToggle } from "@/components/facts/draft-lines";
import { Button } from "@/components/ui/button";
import { AddEducation } from "@/components/facts/add-education";
import { ContactDetails } from "@/components/facts/contact-details";
import { getProfile } from "@/lib/kb/profile";
import { requireSession } from "@/lib/auth";
import { ensureFactBase, GROUP_LABEL, loadFactBase, type FactRow as Row } from "@/lib/facts/base";

export const metadata: Metadata = { title: "My experience" };

const view = (f: Row): FactRowView => ({ id: f.id, text: f.text, label: f.label, field: f.field, verifiedAt: f.verifiedAt?.toISOString() ?? null });

export default async function FactsPage({ searchParams }: PageProps<"/app/facts">) {
  const session = await requireSession();
  const userId = session.user.id;
  await ensureFactBase(userId);
  const [base, profile] = await Promise.all([loadFactBase(userId), getProfile(userId)]);
  const back = (await searchParams).back;
  const backHref = typeof back === "string" && back.startsWith("/app/") ? back : null;
  const experienceRoles = base.roles.filter((r) => r.group === "experience");
  const projectRoles = base.roles.filter((r) => r.group === "project");

  return (
    <PageBody className="max-w-3xl">
      {backHref && (
        <Link href={backHref} className="text-[13px] text-muted-foreground hover:text-foreground">
          Back to your resume
        </Link>
      )}
      <PageHeader
        className={backHref ? "mt-3" : undefined}
        title="My experience"
        description="Everything a resume can say about you, in your words. Change a line here and it changes on every resume you make from now on."
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <Link href="/app/onboarding?step=education&import=1">
                <FileUp data-icon="inline-start" />
                Import from resume
              </Link>
            </Button>
            {base.total > 0 && (
              <Button size="sm" variant="outline" asChild>
                <Link href="/app/facts/linkedin">LinkedIn profile</Link>
              </Button>
            )}
          </>
        }
      />
      <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-[13px] leading-5 text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" />
        Proofline never adds anything here for you. Every line is one you kept, edited, or wrote yourself, and only these can go on a resume.
      </p>

      <RoleSection title={GROUP_LABEL.experience} roles={experienceRoles} project={false} />
      <RoleSection title={GROUP_LABEL.project} roles={projectRoles} project />

      <Section title={GROUP_LABEL.education} empty="No school yet." count={(base.educationEntries ?? []).length}>
        <div className="space-y-4">
          {(base.educationEntries ?? []).map((entry) => (
            <div key={entry.id} className="rounded-xl border bg-background p-2 sm:p-3">
              <div className="flex items-start justify-between gap-2 px-1">
                <h3 className="min-w-0 pt-1 text-[14.5px] font-semibold">{entry.school || "Other education detail"}</h3>
                <DeleteEducationButton entryId={entry.id} name={entry.school || "this detail"} />
              </div>
              <ul className="mt-1 space-y-0.5">{entry.facts.map((f) => <FactRow key={f.id} fact={view(f)} canDelete={f.field !== "school"} />)}</ul>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <AddEducation />
            <AddFact group="education" schools={(base.educationEntries ?? []).filter((entry) => entry.school).map((entry) => ({ id: entry.id, name: entry.school }))} label="Add honors or coursework" />
          </div>
        </div>
      </Section>

      <Section title={GROUP_LABEL.skill} empty="No skills yet." count={base.skill.length}>
        <ul className="space-y-0.5">{base.skill.map((f) => <FactRow key={f.id} fact={view(f)} />)}</ul>
        <div className="mt-2">
          <AddFact group="skill" label="Add a skill" />
        </div>
      </Section>

      <Section title={GROUP_LABEL.license} empty="None yet. Add any license or certificate you hold." count={base.license.length}>
        <ul className="space-y-0.5">{base.license.map((f) => <FactRow key={f.id} fact={view(f)} />)}</ul>
        <div className="mt-2">
          <AddFact group="license" label="Add a license or certificate" />
        </div>
      </Section>

      <Section title="Numbers and other details" empty="Numbers you can stand behind: how many, how much, how often." count={base.number.length + base.other.length}>
        <ul className="space-y-0.5">
          {base.number.map((f) => <FactRow key={f.id} fact={view(f)} multiline />)}
          {base.other.map((f) => <FactRow key={f.id} fact={view(f)} multiline />)}
        </ul>
        <div className="mt-2">
          <AddFact group="number" label="Add a number or result" />
        </div>
      </Section>

      <details id="contact" className="group mt-8 rounded-xl border bg-background">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-[15px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
          Contact details on your resume
          <span className="text-[12.5px] font-normal text-muted-foreground group-open:hidden">Name, email, phone, links</span>
        </summary>
        <div className="border-t px-4 pb-4">
          <ContactDetails initial={{ fullName: profile?.fullName ?? "", contactEmail: profile?.contactEmail ?? "", phone: profile?.phone ?? "", city: profile?.city ?? "", region: profile?.region ?? "", linkedinUrl: profile?.linkedinUrl ?? "", portfolioUrl: profile?.portfolioUrl ?? "" }} />
        </div>
      </details>
    </PageBody>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="flex items-baseline gap-2 border-b pb-2 text-[17px] font-semibold tracking-tight">
        {title}
        <span className="text-[13px] font-normal text-subtle-foreground tabular-nums">{count}</span>
      </h2>
      {count === 0 && empty && <p className="mt-2 px-3 text-[13.5px] text-muted-foreground">{empty}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function RoleSection({ title, roles, project }: { title: string; roles: Awaited<ReturnType<typeof loadFactBase>>["roles"]; project: boolean }) {
  return (
    <Section title={title} count={roles.length} empty={project ? "No projects yet. Class, personal, and club projects all count." : "No roles yet. Jobs, internships, clubs, and volunteering all count."}>
      <div className="space-y-4">
        {roles.map((role) => {
          const name = [role.experience.title, role.experience.org].filter(Boolean).join(", ");
          // A role with a start and no end is current; one with no dates at all is finished work.
          const ended = Boolean(role.experience.endDate) || !role.experience.startDate;
          return (
            <div key={role.experience.id} className="rounded-xl border bg-background p-2 sm:p-3">
              <div className="flex items-start justify-between gap-2 px-1">
                <h3 className="min-w-0 pt-1 text-[14.5px] font-semibold">{name}</h3>
                <DeleteRoleButton experienceId={role.experience.id} name={role.experience.org} />
              </div>
              <ul className="mt-1 space-y-0.5">
                {role.header.map((f) => (
                  <FactRow key={f.id} fact={view(f)} canDelete={f.field !== "org"} />
                ))}
              </ul>
              <p className="mt-2 px-3 text-[12px] font-medium text-subtle-foreground">Resume lines</p>
              <ul className="space-y-0.5">
                {role.bullets.map((f) => (
                  <FactRow key={f.id} fact={view({ ...f, label: "" })} multiline />
                ))}
                {role.bullets.length === 0 && <li className="px-3 py-1 text-[13px] text-pending-ink">No lines yet, so this role shows up empty on a resume.</li>}
              </ul>
              <div className="mt-3 flex flex-wrap items-start gap-2 px-3 pb-1">
                <DraftLinesToggle experienceId={role.experience.id} kind={role.experience.kind} ended={ended} description={role.experience.rawNotes ?? ""} existing={role.bullets.map((b) => b.text)} ideas />
              </div>
            </div>
          );
        })}
        <Button size="sm" variant="outline" className="bg-background" asChild>
          <Link href={`/app/onboarding?step=${project ? "projects" : "experience"}&add=1&back=${encodeURIComponent("/app/facts")}`}>
            <Plus data-icon="inline-start" />
            {project ? "Add a project" : "Add a role"}
          </Link>
        </Button>
      </div>
    </Section>
  );
}
