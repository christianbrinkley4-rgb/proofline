import { hiddenInBeta } from "@/lib/beta";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Check, FileText } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { VariantCompareActions } from "@/components/resume/variant-compare";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { VARIANT_BLURB, VARIANT_LABEL, type VariantId } from "@/lib/resume/document";
import { getJobForUser } from "@/lib/jobs/store";
import { listResumes } from "@/lib/resume/store";
import { TEMPLATES } from "@/lib/resume/templates";

export const metadata: Metadata = { title: "Compare tailored resumes" };
export default async function ComparePage({ searchParams }: PageProps<"/app/resumes/compare">) {
  hiddenInBeta("/app/jobs");
  const session = await requireSession();
  const { job: id, select } = await searchParams;
  if (typeof id !== "string") notFound();
  const data = await getJobForUser(session.user.id, id);
  if (!data) notFound();
  const { job } = data;
  const history = (await listResumes(session.user.id)).filter((r) => r.row.jobId === id);
  const order: VariantId[] = ["experience", "skills", "ats"];
  const resumes = order.flatMap((variant) => history.find((resume) => resume.variant === variant) ?? []);
  const selected = typeof select === "string" && resumes.some((r) => r.row.id === select) ? select : null;
  return <PageBody>
    <Link href={"/app/jobs/" + id} className="inline-flex min-h-6 items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Back to job</Link>
    <PageHeader className="mt-4" title="Choose your best evidence" description={`${job.title} at ${job.company}. Compare the latest version of each strategy, built from your confirmed history.`} />
    <div className="mt-6"><VariantCompareActions jobId={id} selected={selected} /></div>
    {resumes.length === 0 ? <div className="mt-8 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Build versions to see how your experience, skills, and keywords tell different true stories for this posting.</div> :
      <div className="mt-7 grid gap-4 lg:grid-cols-3">{resumes.map((r) => {
        const isSelected = selected === r.row.id;
        const failed = r.checks.some((c) => c.blocking && c.status === "fail");
        return <article key={r.row.id} className={`rounded-xl border bg-background p-5 ${isSelected ? "ring-2 ring-foreground" : ""}`}>
          <div className="flex items-start justify-between gap-2"><div><p className="font-mono text-[11px] uppercase tracking-wide text-subtle-foreground">Version {r.row.version} · {TEMPLATES[r.template.id]?.label ?? r.template.id}</p><h2 className="mt-1 text-[17px] font-semibold tracking-tight">{VARIANT_LABEL[r.variant]}</h2></div><FileText className="size-5 text-subtle-foreground" /></div>
          <p className="mt-2 min-h-14 text-[13px] leading-5 text-muted-foreground">{VARIANT_BLURB[r.variant]}</p>
          <div className="mt-3 rounded-lg bg-muted/50 p-3 text-[12px] leading-5"><span className="font-medium">Page order:</span> {r.document.sections.map((section) => section.title).join(" → ")}{r.document.sections.some((section) => section.kind === "skills") && <span className="mt-1 block text-muted-foreground">Skills are drawn from confirmed facts and evidence lines.</span>}</div>
          <div className="mt-4 flex gap-3 border-t pt-4 text-xs"><span>{r.why.length} evidence lines</span><span>{r.cuts.length} cut</span></div>
          <h3 className="mt-4 text-[12px] font-medium">Top evidence</h3>
          <ul className="mt-2 space-y-2">{r.why.slice(0, 3).map((w) => <li key={w.bulletId} className="flex gap-2 text-[12px] leading-5"><Check className="mt-0.5 size-3 shrink-0 text-brand" />{w.text}</li>)}</ul>
          <p className={`mt-4 text-xs ${failed ? "text-pending-ink" : "text-brand-ink"}`}>{failed ? "Review needed before export" : "Checks passed when created"}</p>
          <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" asChild variant={isSelected ? "secondary" : "outline"}><Link href={`/app/resumes/compare?job=${id}&select=${r.row.id}`}>{isSelected ? "Selected" : "Select"}</Link></Button><Button size="sm" asChild variant="ghost"><Link href={`/app/resumes/${r.row.id}`}>Review page<ArrowUpRight data-icon="inline-end" /></Link></Button></div>
        </article>;
      })}</div>}
    {history.length > resumes.length && <p className="mt-4 text-xs text-muted-foreground">Showing the latest of each strategy. {history.length - resumes.length} older {history.length - resumes.length === 1 ? "version remains" : "versions remain"} saved in your Resumes list.</p>}
    <p className="mt-5 text-xs leading-5 text-muted-foreground">A tailored resume can reorder or omit your real accomplishments. It cannot add an unconfirmed claim. Review the full version before applying.</p>
  </PageBody>;
}

