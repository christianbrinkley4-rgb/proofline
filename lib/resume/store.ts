import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { listFacts } from "@/lib/kb/facts";
import { listBullets } from "./bullets/service";
import type { ResumeDocument, VariantId } from "./document";
import { layoutResume } from "./layout";
import { runQualityGate, type QualityCheck } from "./quality";
import type { CutItem, WhyItem } from "./tailor";
import { TEMPLATES, type Template } from "./templates";

export type ResumeRow = typeof schema.resume.$inferSelect;

export type StoredResume = {
  row: ResumeRow;
  document: ResumeDocument;
  template: Template;
  adjustments: string[];
  why: WhyItem[];
  cuts: CutItem[];
  checks: QualityCheck[];
  variant: VariantId;
};

export function unpack(row: ResumeRow): StoredResume {
  const content = row.content as { document: ResumeDocument; templateOverrides?: Template; adjustments?: string[] };
  const base = TEMPLATES[row.template as keyof typeof TEMPLATES] ?? TEMPLATES.classic;
  return {
    row,
    document: content.document,
    template: { ...base, ...(content.templateOverrides ?? {}) },
    adjustments: content.adjustments ?? [],
    why: ((row.why as { items?: WhyItem[] } | null)?.items ?? []) as WhyItem[],
    cuts: ((row.cuts as { items?: CutItem[] } | null)?.items ?? []) as CutItem[],
    checks: ((row.checks as { items?: QualityCheck[] } | null)?.items ?? []) as QualityCheck[],
    variant: row.variant as VariantId,
  };
}

export async function getResume(userId: string, id: string): Promise<StoredResume | null> {
  const row = await db.query.resume.findFirst({ where: and(eq(schema.resume.id, id), eq(schema.resume.userId, userId)) });
  return row ? unpack(row) : null;
}

export async function listResumes(userId: string) {
  const rows = await db.query.resume.findMany({ where: eq(schema.resume.userId, userId), orderBy: [desc(schema.resume.createdAt)] });
  const jobIds = [...new Set(rows.map((r) => r.jobId).filter((id): id is string => Boolean(id)))];
  const jobs = jobIds.length ? await db.query.job.findMany({ where: inArray(schema.job.id, jobIds) }) : [];
  const byId = new Map(jobs.map((j) => [j.id, j]));
  return rows.map((r) => ({ ...unpack(r), job: r.jobId ? byId.get(r.jobId) ?? null : null }));
}

/**
 * Re-checks a stored resume against the profile as it is right now. A fact
 * rejected after tailoring must not slip out in an export.
 * Returns the layout so callers (preview, export) can reuse ops without measuring again.
 */
export async function freshChecks(userId: string, stored: StoredResume) {
  const [facts, bullets] = await Promise.all([listFacts(userId, { states: ["confirmed"] }), listBullets(userId, undefined, true)]);
  const layout = await layoutResume(stored.document, stored.template);
  const checks = runQualityGate(
    stored.document,
    layout,
    new Map(facts.map((f) => [f.id, f.content])),
    new Set(bullets.filter((b) => b.status === "active").map((b) => b.id)),
  );
  return { layout, checks };
}

export function resumeFileName(name: string, company: string | null, ext: "pdf" | "docx") {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${clean(name || "Resume")}${company ? `-${clean(company)}` : ""}-Resume.${ext}`;
}
