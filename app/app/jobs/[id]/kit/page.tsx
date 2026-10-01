import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, ArrowUpRight, CircleAlert, ShieldCheck } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { KitGroups, MarkSubmitted } from "@/components/packet/answer-kit";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { hasUsableJobDescription } from "@/lib/jobs/description";
import { getJobForUser } from "@/lib/jobs/store";
import { ANSWER_YOURSELF } from "@/lib/packet/kit";
import { loadAnswerKit } from "@/lib/packet/kit-service";
import { readSent } from "@/lib/packet/sent";

export async function generateMetadata({ params }: PageProps<"/app/jobs/[id]/kit">): Promise<Metadata> {
  const session = await requireSession();
  const data = await getJobForUser(session.user.id, (await params).id);
  return { title: data ? `Application answers for ${data.job.company}` : "Application answers" };
}

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

export default async function KitPage({ params }: PageProps<"/app/jobs/[id]/kit">) {
  const session = await requireSession();
  const userId = session.user.id;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [loaded, application] = await Promise.all([
    loadAnswerKit(userId, id, session.user.name),
    db.query.application.findFirst({ where: and(eq(schema.application.userId, userId), eq(schema.application.jobId, id)), columns: { id: true, sent: true } }),
  ]);
  if (!loaded) notFound();
  const { kit } = loaded;
  const job = await db.query.job.findFirst({ where: eq(schema.job.id, id), columns: { url: true, description: true } });
  const applyUrl = job && /^https?:\/\//.test(job.url) ? job.url : null;
  const sent = readSent(application?.sent);

  const back = (
    <Link href={`/app/jobs/${id}/packet`} className="inline-flex min-h-6 items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-3.5" />
      Back to the packet
    </Link>
  );

  if (sent) {
    return (
      <PageBody className="max-w-3xl">
        {back}
        <PageHeader className="mt-4" title="What you sent" description={`${sent.kit.title} at ${sent.kit.company}. Saved on ${day(sent.at)}, when you marked it submitted. It doesn't change when your experience does.`} />
        <div className="mt-6 flex flex-wrap gap-2">
          {application && (
            <Button variant="outline" asChild>
              <Link href={`/app/tracker?app=${application.id}`}>Open in tracker</Link>
            </Button>
          )}
        </div>
        <div className="mt-6">
          <KitGroups groups={sent.kit.groups} readOnly />
        </div>
      </PageBody>
    );
  }

  const fields = kit.groups.flatMap((g) => g.entries.flatMap((e) => e.fields));
  const filled = fields.filter((f) => f.value).length;

  return (
    <PageBody className="max-w-3xl">
      {back}
      <PageHeader
        className="mt-4"
        title="Application answers"
        description={`${kit.title} at ${kit.company}. Keep this open next to their application form and copy each answer across. You press submit on their site; Proofline never does.`}
      />

      <div
        role="status"
        className={
          kit.blankCount
            ? "mt-6 flex items-start gap-2.5 rounded-xl border border-pending/40 bg-pending-soft px-4 py-3 text-[14px] leading-6 text-pending-ink"
            : "mt-6 flex items-start gap-2.5 rounded-xl border bg-brand-soft px-4 py-3 text-[14px] leading-6 text-brand-ink"
        }
      >
        {kit.blankCount ? <CircleAlert className="mt-1 size-4 shrink-0" aria-hidden /> : <ShieldCheck className="mt-1 size-4 shrink-0" aria-hidden />}
        <p>
          {kit.blankCount
            ? `We left ${kit.blankCount} ${kit.blankCount === 1 ? "field" : "fields"} blank because we don't have confirmed facts for ${kit.blankCount === 1 ? "it" : "them"}. Each one says what to add. The other ${filled} come from facts and details you confirmed.`
            : `All ${filled} filled fields come from facts and details you confirmed. Nothing here was guessed.`}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {applyUrl && (
          <Button size="lg" variant="outline" asChild>
            <a href={applyUrl} target="_blank" rel="noreferrer">
              Open their application
              <ArrowUpRight data-icon="inline-end" />
            </a>
          </Button>
        )}
        <a href="#done" className="inline-flex min-h-10 items-center px-2 text-[13px] text-muted-foreground hover:text-foreground hover:underline">
          Already submitted? Mark it
        </a>
      </div>

      <div className="mt-6">
        <KitGroups groups={kit.groups} jobId={id} canDraft={hasUsableJobDescription(job?.description)} />
      </div>

      <section aria-labelledby="yours-title" className="mt-4 rounded-2xl border bg-muted/40 p-4 sm:p-5">
        <h2 id="yours-title" className="text-[16px] font-semibold">Answer these yourself</h2>
        <ul className="mt-3 space-y-2.5">
          {ANSWER_YOURSELF.map((item) => (
            <li key={item.label} className="text-[13.5px] leading-5">
              <span className="font-medium">{/[.?)]$/.test(item.label) ? item.label : `${item.label}.`}</span> <span className="text-muted-foreground">{item.why}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="done" aria-labelledby="done-title" className="mt-8 scroll-mt-20 rounded-2xl border border-border-strong bg-background p-5 shadow-lift sm:p-6">
        <h2 id="done-title" className="font-display text-[22px] font-semibold">After you press submit on their site</h2>
        <p className="mt-2 max-w-xl text-[14px] leading-6 text-muted-foreground">
          Mark it here. Proofline saves this kit as what you sent, so your tracker can show it later, and moves the job to Applied.
        </p>
        <div className="mt-4">
          <MarkSubmitted jobId={id} digest={kit.digest} company={kit.company} />
        </div>
      </section>
    </PageBody>
  );
}
