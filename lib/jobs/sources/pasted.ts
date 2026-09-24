import { createHash } from "node:crypto";
import { z } from "zod";
import { detectLevel, detectMode, parsePay } from "../text";
import type { NormalizedJob } from "../types";

/**
 * A job the student pasted in by hand, for postings Proofline can't open
 * (Handshake and LinkedIn need a sign-in; some come as a PDF or an email).
 * It's keyed to the student, so it only ever shows up for them.
 */

export const PastedJobSchema = z.object({
  company: z.string().trim().min(1, "Add the company.").max(160),
  title: z.string().trim().min(2, "Add the job title.").max(200),
  location: z.string().trim().max(160).optional(),
  url: z
    .union([z.literal(""), z.string().trim().url("Links start with https://").max(2000)])
    .optional()
    .refine((v) => !v || /^https?:\/\//i.test(v), "Use an http or https link."),
  description: z.string().trim().min(200, "Paste the full description (at least a few paragraphs) so the fit score has something to read.").max(40_000),
});
export type PastedJob = z.infer<typeof PastedJobSchema>;

export function pastedJob(userId: string, input: PastedJob): NormalizedJob {
  const job = PastedJobSchema.parse(input);
  const pay = parsePay(job.description);
  const digest = createHash("sha256").update(`${userId}\n${job.company}\n${job.title}\n${job.description.slice(0, 2000)}`).digest("hex").slice(0, 24);
  return {
    source: "link",
    sourceId: `pasted:${digest}`,
    company: job.company,
    title: job.title,
    location: job.location || null,
    mode: detectMode(job.location, job.title, job.description.slice(0, 2000)),
    level: detectLevel(job.title, job.description.slice(0, 600)),
    url: job.url || "",
    description: job.description,
    department: null,
    employmentType: null,
    payMin: pay.min,
    payMax: pay.max,
    payPeriod: pay.period,
    postedAt: null,
  };
}
