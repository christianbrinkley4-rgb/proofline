import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { kitFields, type AnswerKit, type KitField } from "@/lib/packet/kit";

/**
 * What the extension may type into a Greenhouse or Lever form: the answer kit's
 * filled fields, flattened. Blank kit fields travel as blanks so the review panel
 * can say why; nothing is added that the kit page doesn't show.
 */

export type FillAnswer = { key: string; label: string; value: string; source: string };
export type FillPlan = {
  jobId: string;
  company: string;
  title: string;
  digest: string;
  kitUrl: string;
  answers: FillAnswer[];
  /** Every kit field key in kit order, so "the newest role" and "the latest school" mean the same as on the kit page. */
  keys: string[];
  blanks: Array<{ key: string; label: string; reason: string }>;
  resumeFileName: string | null;
};

/** The posting a Greenhouse or Lever page belongs to, as "greenhouse:<id>" or "lever:<uuid>". */
export function atsKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host === "jobs.lever.co" || host === "jobs.eu.lever.co") {
    const id = url.pathname.split("/")[2];
    return id && /^[0-9a-f-]{36}$/i.test(id) ? `lever:${id.toLowerCase()}` : null;
  }
  const ghId = url.searchParams.get("gh_jid") ?? (host.endsWith("greenhouse.io") ? url.searchParams.get("token") ?? url.pathname.match(/\/jobs\/(\d+)/)?.[1] : null);
  return ghId && /^\d+$/.test(ghId) ? `greenhouse:${ghId}` : null;
}

/** The saved job this application page is for, among jobs on the person's account. */
export async function findJobForPage(userId: string, pageUrl: string): Promise<string | null> {
  const key = atsKey(pageUrl);
  const [matches, apps] = await Promise.all([
    db.query.jobMatch.findMany({ where: and(eq(schema.jobMatch.userId, userId), inArray(schema.jobMatch.status, ["new", "saved"])), columns: { jobId: true } }),
    db.query.application.findMany({ where: eq(schema.application.userId, userId), columns: { jobId: true } }),
  ]);
  const ids = [...new Set([...matches.map((m) => m.jobId), ...apps.flatMap((a) => (a.jobId ? [a.jobId] : []))])];
  if (!ids.length) return null;
  const jobs = await db.query.job.findMany({ where: inArray(schema.job.id, ids), columns: { id: true, url: true } });
  const bare = (u: string) => u.replace(/[?#].*$/, "").replace(/\/apply\/?$/, "").replace(/\/$/, "").toLowerCase();
  const hit = jobs.find((j) => (key && atsKey(j.url) === key) || bare(j.url) === bare(pageUrl));
  return hit?.id ?? null;
}

function sourceLine(field: KitField): string {
  const facts = field.sources.filter((s) => s.kind === "fact");
  if (facts.length === 1 && facts[0].text.trim() === field.value.trim()) return "Confirmed fact";
  if (facts.length) return facts.length === 1 ? `From your confirmed fact: "${facts[0].text.slice(0, 120)}"` : `From ${facts.length} confirmed facts`;
  const other = field.sources.find((s) => s.kind !== "fact");
  return other && "label" in other ? `From ${other.label.charAt(0).toLowerCase()}${other.label.slice(1)}` : "";
}

export function fillPlan(kit: AnswerKit, origin: string): FillPlan {
  const fields = kitFields(kit);
  const resume = fields.find((f) => f.key === "documents.resume");
  return {
    jobId: kit.jobId,
    company: kit.company,
    title: kit.title,
    digest: kit.digest,
    kitUrl: `${origin}/app/jobs/${kit.jobId}/kit`,
    answers: fields.filter((f) => f.value && !f.unfinished && !f.file).map((f) => ({ key: f.key, label: f.label, value: f.value, source: sourceLine(f) })),
    keys: fields.map((f) => f.key),
    blanks: fields.filter((f) => f.blank).map((f) => ({ key: f.key, label: f.label, reason: f.blank!.reason })),
    resumeFileName: resume?.file ? resume.value : null,
  };
}
