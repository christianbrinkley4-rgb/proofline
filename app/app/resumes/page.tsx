import { hiddenInBeta } from "@/lib/beta";
import type { Metadata } from "next";
import Link from "next/link";
import { Check, CircleAlert, FileText, Plus } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { VARIANT_LABEL } from "@/lib/resume/document";
import { listResumes } from "@/lib/resume/store";
import { TEMPLATES } from "@/lib/resume/templates";

export const metadata: Metadata = { title: "Resumes" };

export default async function ResumesPage() {
  hiddenInBeta("/app/jobs");
  const session = await requireSession();
  const resumes = await listResumes(session.user.id);

  return (
    <PageBody>
      <PageHeader
        title="Resumes"
        description="Every version you've made. Each one is a snapshot of what was on the page, so you always know exactly what you sent."
        actions={
          <Button asChild>
            <Link href="/app/resumes/new" prefetch={false}>
              <Plus data-icon="inline-start" />
              General resume
            </Link>
          </Button>
        }
      />

      {resumes.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed p-10 text-center">
          <FileText className="mx-auto size-6 text-muted-foreground" strokeWidth={1.5} />
          <p className="mt-3 text-[15px] font-medium">No resumes yet</p>
          <p className="mx-auto mt-1 max-w-sm text-[14px] leading-6 text-muted-foreground">
            Open any job and choose &ldquo;Tailor my resume&rdquo;, or make a general one from your best confirmed bullets.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button asChild variant="outline">
              <Link href="/app/jobs">Find a job</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ul className="mt-8 divide-y overflow-hidden rounded-xl border bg-background">
          {resumes.map((r) => {
            const failed = r.checks.some((c) => c.blocking && c.status === "fail");
            return (
              <li key={r.row.id}>
                <Link href={`/app/resumes/${r.row.id}`} className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/60 sm:px-5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border bg-muted">
                    <FileText className="size-4 text-muted-foreground" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{r.row.name}</span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">
                      {[TEMPLATES[r.template.id]?.label ?? r.template.id, VARIANT_LABEL[r.variant], `v${r.row.version}`, r.row.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })].join(" · ")}
                    </span>
                  </span>
                  {failed ? (
                    <span className="flex items-center gap-1 text-[12px] text-pending-ink">
                      <CircleAlert className="size-3.5" />
                      Needs a fix
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[12px] text-brand-ink">
                      <Check className="size-3.5" strokeWidth={2.5} />
                      Ready
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageBody>
  );
}
