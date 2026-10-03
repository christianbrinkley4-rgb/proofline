import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, count, isNotNull, isNull, max } from "drizzle-orm";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { AiCheck, CopyText, TestEmail } from "@/components/owner/owner-checks";
import { SentryCheck } from "@/components/owner/sentry-check";
import { requireSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { emailConfigured } from "@/lib/email";
import { listInbox } from "@/lib/inbox/service";
import { isOwner } from "@/lib/owner";
import { reviewConfigured } from "@/lib/review/model";

export const metadata: Metadata = { title: "Owner" };
export const dynamic = "force-dynamic";

const RESET_HOURS = 72;

function when(date: Date) {
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 rounded-xl border bg-background p-5 sm:p-6">
      <h2 className="text-[16px] font-semibold">{title}</h2>
      {note && <p className="mt-1.5 max-w-3xl text-[13.5px] leading-6 text-muted-foreground">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[13.5px] text-muted-foreground">{children}</p>;
}

export default async function OwnerPage() {
  const session = await requireSession();
  // Anyone else gets the ordinary not-found page, so the page's existence isn't advertised.
  if (!isOwner(session.user.email)) notFound();

  const [fresh, alerts, feedback, contact, [pool]] = await Promise.all([
    // Older links have expired; there's nothing to send.
    listInbox("password_reset", 30, RESET_HOURS),
    listInbox("alert", 10),
    listInbox("feedback", 50),
    listInbox("contact", 30),
    db.select({ listed: count(), newest: max(schema.job.listedAt) }).from(schema.job).where(and(isNotNull(schema.job.listedAt), isNull(schema.job.closedAt))),
  ]);

  return (
    <PageBody className="max-w-4xl">
      <PageHeader title="Owner" description="Only accounts in OWNER_EMAILS see this page. Testers' messages, reset requests, and the checks that keep the beta working." />

      <Section title="System checks">
        <dl className="grid gap-5 text-[13.5px] sm:grid-cols-3">
          <div>
            <dt className="font-medium">AI review</dt>
            <dd className="mt-1 text-muted-foreground">{reviewConfigured() ? "Key is set. Downloads wait for this review." : "No key set. Nobody can download a resume."}</dd>
            <dd className="mt-3"><AiCheck /></dd>
          </div>
          <div>
            <dt className="font-medium">Password-reset email</dt>
            <dd className="mt-1 text-muted-foreground">{emailConfigured() ? "Resend is set up; testers get their own reset links." : "Not set up. Reset links collect below for you to send."}</dd>
            <dd className="mt-3"><TestEmail /></dd>
          </div>
          <div>
            <dt className="font-medium">Find jobs</dt>
            <dd className="mt-1 text-muted-foreground">
              {pool?.listed ? `${pool.listed.toLocaleString("en-US")} open listings${pool.newest ? `, newest ${when(pool.newest)}` : ""}.` : "No listings yet. The pool fills at 10:00 UTC each day."}
            </dd>
          </div>
        </dl>
      </Section>

      <Section title="Browser error reporting" note="Send a fixed synthetic error, then confirm its event ID in the Proofline Sentry project."><SentryCheck /></Section>

      <Section title="Alerts" note="Problems the daily checks found. The AI check runs at 9:00 UTC.">
        {alerts.length ? (
          <ul className="space-y-3">
            {alerts.map((row) => (
              <li key={row.id} className="text-[13.5px] leading-6">
                <span className="text-subtle-foreground">{when(row.createdAt)}</span> <span className="text-destructive">{row.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nothing has failed.</Empty>
        )}
      </Section>

      <Section
        title="Password resets waiting for you"
        note={emailConfigured() ? "Email is set up, so new requests go straight to the tester. Older ones stay here." : `Each link works once, for ${RESET_HOURS} hours. Send it only to the address that asked; "Email it" opens a draft to them.`}
      >
        {fresh.length ? (
          <ul className="divide-y">
            {fresh.map((row) => {
              const url = row.message.match(/https?:\/\/\S+/)?.[0] ?? "";
              const body = `Here's the link to choose a new Proofline password. It works once, within ${RESET_HOURS} hours of your request:\n\n${url}\n\nIf you didn't ask for this, ignore it and nothing changes.`;
              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-[13.5px]">
                  <span className="min-w-0 break-all">
                    <span className="font-medium">{row.email}</span> <span className="text-subtle-foreground">{when(row.createdAt)}</span>
                  </span>
                  {url && (
                    <span className="flex gap-1">
                      <CopyText text={url} label={`Copy reset link for ${row.email}`} />
                      <a
                        className="inline-flex h-7 items-center rounded-md px-2.5 text-[13px] font-medium hover:bg-muted"
                        href={`mailto:${row.email}?subject=${encodeURIComponent("Reset your Proofline password")}&body=${encodeURIComponent(body)}`}
                      >
                        Email it
                      </a>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>No reset requests in the last {RESET_HOURS} hours.</Empty>
        )}
      </Section>

      <Section title="Feedback" note="From the Send feedback button in the app, newest first.">
        {feedback.length ? (
          <ul className="divide-y">
            {feedback.map((row) => (
              <li key={row.id} className="py-3 text-[13.5px] leading-6">
                <p className="text-subtle-foreground">
                  {row.email} · {when(row.createdAt)}
                  {row.page ? ` · ${row.page}` : ""}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{row.message}</p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No feedback yet.</Empty>
        )}
      </Section>

      <Section title="Contact form" note="From the public Contact page.">
        {contact.length ? (
          <ul className="divide-y">
            {contact.map((row) => (
              <li key={row.id} className="py-3 text-[13.5px] leading-6">
                <p className="text-subtle-foreground">
                  {[row.name, row.email].filter(Boolean).join(", ")} · {when(row.createdAt)}
                </p>
                <p className="mt-1 whitespace-pre-wrap">{row.message}</p>
                {row.email && (
                  <a className="mt-1 inline-flex min-h-6 items-center text-[13px] font-medium hover:underline" href={`mailto:${row.email}?subject=${encodeURIComponent("Re: your message to Proofline")}`}>
                    Reply
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No messages yet.</Empty>
        )}
      </Section>
    </PageBody>
  );
}
