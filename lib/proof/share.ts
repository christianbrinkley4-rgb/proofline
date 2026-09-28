import { randomBytes } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getResume, type StoredResume } from "@/lib/resume/store";
import { gateStatus } from "@/lib/review/gate";

/**
 * Proof links: a page the person chooses to share that shows how one resume was
 * made, line by line, with the confirmed fact behind each bullet. What it can
 * honestly say is narrow and exact: every line matches something the person
 * confirmed in their own words, and nothing was invented or inflated by AI.
 * Proofline doesn't contact employers or schools, and the page says so.
 */

export type ShareRow = typeof schema.resumeShare.$inferSelect;

/** Shown when the person's facts or the resume changed after sharing. */
export class ShareNotReady extends Error {}

export async function activeShare(userId: string, resumeId: string): Promise<ShareRow | null> {
  return (
    (await db.query.resumeShare.findFirst({
      where: and(eq(schema.resumeShare.userId, userId), eq(schema.resumeShare.resumeId, resumeId), isNull(schema.resumeShare.revokedAt)),
    })) ?? null
  );
}

/** The share for a resume that has passed review; the same link if it's already shared. */
export async function shareResume(userId: string, resumeId: string): Promise<ShareRow> {
  const stored = await getResume(userId, resumeId);
  if (!stored) throw new ShareNotReady("That resume isn't on your account anymore.");
  if (!(await gateStatus(userId, stored)).canExport) throw new ShareNotReady("Share it once the review passes, so every line on the page is one you've confirmed.");
  const existing = await activeShare(userId, resumeId);
  if (existing) return existing;
  const [row] = await db.insert(schema.resumeShare).values({ userId, resumeId, slug: randomBytes(18).toString("base64url") }).returning();
  return row;
}

export async function stopSharing(userId: string, resumeId: string): Promise<void> {
  await db
    .update(schema.resumeShare)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.resumeShare.userId, userId), eq(schema.resumeShare.resumeId, resumeId), isNull(schema.resumeShare.revokedAt)));
}

export type ProofSource = { text: string; confirmedAt: string | null; origin: "own_words" | "uploaded_resume" | "suggested" };
export type ProofBullet = { text: string; wording: "own" | "rules" | "ai" | "uploaded"; sources: ProofSource[] };
export type ProofEntry = { heading: string; dates: string; bullets: ProofBullet[] };
export type ProofSection = { title: string; entries?: ProofEntry[]; lines?: string[] };

export type ProofView =
  | { state: "missing" }
  | { state: "changed"; firstName: string }
  | {
      state: "ok";
      name: string;
      firstName: string;
      job: { title: string; company: string } | null;
      builtAt: string;
      reviewedAt: string | null;
      sections: ProofSection[];
      bulletCount: number;
    };

const ORIGIN: Record<string, ProofSource["origin"]> = { user_stated: "own_words", resume_parsed: "uploaded_resume" };
const WORDING: Record<string, ProofBullet["wording"]> = { user: "own", offline: "rules", anthropic: "ai", resume: "uploaded" };

/** Everything the public page shows. Contact details stay off it; the reader already has the resume. */
export async function proofView(slug: string): Promise<ProofView> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(slug)) return { state: "missing" };
  const share = await db.query.resumeShare.findFirst({ where: and(eq(schema.resumeShare.slug, slug), isNull(schema.resumeShare.revokedAt)) });
  if (!share) return { state: "missing" };
  const stored = await getResume(share.userId, share.resumeId);
  if (!stored) return { state: "missing" };
  const name = stored.document.header.name.trim();
  const firstName = name.split(/\s+/)[0] ?? name;
  const gate = await gateStatus(share.userId, stored);
  if (!gate.canExport) return { state: "changed", firstName };
  return { state: "ok", name, firstName, ...(await describe(share.userId, stored)), reviewedAt: gate.review?.at ?? null };
}

async function describe(userId: string, stored: StoredResume) {
  const doc = stored.document;
  const bulletItems = doc.sections.flatMap((s) => (s.kind === "entries" ? s.entries.flatMap((e) => e.bullets) : []));
  const factIds = [...new Set(bulletItems.flatMap((b) => b.factIds))];
  const bulletIds = bulletItems.map((b) => b.id);
  const [facts, bullets, job] = await Promise.all([
    factIds.length ? db.query.fact.findMany({ where: and(eq(schema.fact.userId, userId), inArray(schema.fact.id, factIds)) }) : [],
    bulletIds.length ? db.query.bullet.findMany({ where: and(eq(schema.bullet.userId, userId), inArray(schema.bullet.id, bulletIds)), columns: { id: true, generator: true } }) : [],
    stored.row.jobId ? db.query.job.findFirst({ where: eq(schema.job.id, stored.row.jobId), columns: { title: true, company: true } }) : undefined,
  ]);
  const factById = new Map(facts.map((f) => [f.id, f]));
  const generatorById = new Map(bullets.map((b) => [b.id, b.generator]));

  const sections: ProofSection[] = doc.sections.map((section) => {
    if (section.kind === "education") {
      return { title: section.title, lines: section.entries.flatMap((e) => [[e.school, e.gradLine].filter(Boolean).join(", "), e.degreeLine, ...e.details].filter(Boolean)) };
    }
    if (section.kind === "skills") {
      return { title: section.title, lines: section.lines.filter((l) => l.items.length).map((l) => `${l.label}: ${l.items.join(", ")}`) };
    }
    return {
      title: section.title,
      entries: section.entries.map((e) => ({
        heading: [e.title, e.org, e.location].filter(Boolean).join(", "),
        dates: e.dates,
        bullets: e.bullets.map((b) => ({
          text: b.text,
          wording: WORDING[generatorById.get(b.id) ?? ""] ?? "rules",
          sources: b.factIds
            .map((id) => factById.get(id))
            .filter((f): f is NonNullable<typeof f> => Boolean(f))
            .map((f) => ({ text: f.content, confirmedAt: f.confirmedAt?.toISOString() ?? null, origin: ORIGIN[f.source] ?? "suggested" })),
        })),
      })),
    };
  });

  return {
    job: job ? { title: job.title, company: job.company } : null,
    builtAt: stored.row.createdAt.toISOString(),
    sections,
    bulletCount: bulletItems.length,
  };
}
