import { detectLevel, detectMode, htmlToText, parsePay } from "../text";
import type { NormalizedJob } from "../types";
import { getJson } from "./http";

/**
 * Company job boards with public JSON: Greenhouse, Lever, Ashby, SmartRecruiters.
 * These are the same postings that get syndicated to LinkedIn and Indeed, straight
 * from the source.
 */

export type BoardRef =
  | { source: "greenhouse"; slug: string; company: string }
  | { source: "lever"; slug: string; company: string }
  | { source: "ashby"; slug: string; company: string }
  | { source: "smartrecruiters"; slug: string; company: string };

// ─── Greenhouse ───────────────────────────────────────────────────────────────

type GreenhouseList = {
  jobs: Array<{ id: number; title: string; updated_at: string; first_published?: string; absolute_url: string; location: { name: string } }>;
};
type GreenhouseJob = GreenhouseList["jobs"][number] & { content: string; departments?: Array<{ name: string }> };

async function greenhouse(ref: BoardRef, opts: BoardFetchOptions): Promise<NormalizedJob[]> {
  // `content=true` returns every description in the same response, which saves one request per posting.
  const data = await getJson<GreenhouseList & { jobs: Array<Partial<GreenhouseJob>> }>(
    `https://boards-api.greenhouse.io/v1/boards/${ref.slug}/jobs${opts.withContent ? "?content=true" : ""}`,
    { timeoutMs: opts.timeoutMs },
  );
  return data.jobs.map((j) => {
    const content = greenhouseContent(j);
    return {
      source: "greenhouse",
      sourceId: `${ref.slug}:${j.id}`,
      company: ref.company,
      title: j.title.trim(),
      location: j.location?.name ?? null,
      mode: detectMode(j.location?.name, j.title, content.description?.slice(0, 1500)),
      level: detectLevel(j.title),
      url: j.absolute_url,
      ...content,
      employmentType: null,
      postedAt: new Date(j.first_published ?? j.updated_at),
    };
  });
}

function greenhouseContent(j: Partial<GreenhouseJob>): Pick<NormalizedJob, "description" | "department" | "payMin" | "payMax" | "payPeriod"> {
  if (!j.content) return { description: null, department: null, payMin: null, payMax: null, payPeriod: null };
  const description = htmlToText(j.content);
  const pay = parsePay(description);
  return { description, department: j.departments?.[0]?.name ?? null, payMin: pay.min, payMax: pay.max, payPeriod: pay.period };
}

async function greenhouseDetail(slug: string, id: string): Promise<Partial<NormalizedJob>> {
  const j = await getJson<GreenhouseJob>(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs/${id}`);
  const content = greenhouseContent(j);
  return { ...content, mode: detectMode(j.location?.name, j.title, content.description?.slice(0, 1500)) };
}

// ─── Lever ────────────────────────────────────────────────────────────────────

type LeverPosting = {
  id: string;
  text: string;
  createdAt: number;
  hostedUrl: string;
  workplaceType?: "remote" | "hybrid" | "onsite" | "unspecified";
  categories: { location?: string; team?: string; commitment?: string; department?: string };
  descriptionPlain?: string;
  lists?: Array<{ text: string; content: string }>;
  additionalPlain?: string;
  salaryRange?: { min: number; max: number; currency: string; interval: string };
};

async function lever(ref: BoardRef, opts: BoardFetchOptions): Promise<NormalizedJob[]> {
  const data = await getJson<LeverPosting[]>(`https://api.lever.co/v0/postings/${ref.slug}?mode=json`, { timeoutMs: opts.timeoutMs });
  return data.map((p) => {
    const lists = (p.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join("\n\n");
    const description = [p.descriptionPlain, lists, p.additionalPlain].filter(Boolean).join("\n\n").trim();
    const interval = p.salaryRange?.interval ?? "";
    return {
      source: "lever",
      sourceId: `${ref.slug}:${p.id}`,
      company: ref.company,
      title: p.text.trim(),
      location: p.categories.location ?? null,
      mode: p.workplaceType && p.workplaceType !== "unspecified" ? p.workplaceType : detectMode(p.categories.location, p.text),
      level: detectLevel(p.text, p.categories.commitment),
      url: p.hostedUrl,
      description: description || null,
      department: p.categories.team ?? p.categories.department ?? null,
      employmentType: p.categories.commitment ?? null,
      payMin: p.salaryRange?.min ?? null,
      payMax: p.salaryRange?.max ?? null,
      payPeriod: p.salaryRange ? (/hour/i.test(interval) ? "hour" : "year") : null,
      postedAt: new Date(p.createdAt),
    };
  });
}

// ─── Ashby ────────────────────────────────────────────────────────────────────

type AshbyBoard = {
  jobs: Array<{
    id: string;
    title: string;
    department?: string;
    team?: string;
    employmentType?: string;
    location?: string;
    isRemote?: boolean;
    workplaceType?: string;
    publishedAt?: string;
    jobUrl: string;
    descriptionPlain?: string;
    compensation?: { compensationTierSummary?: string };
  }>;
};

async function ashby(ref: BoardRef, opts: BoardFetchOptions): Promise<NormalizedJob[]> {
  const data = await getJson<AshbyBoard>(`https://api.ashbyhq.com/posting-api/job-board/${ref.slug}?includeCompensation=true`, { timeoutMs: opts.timeoutMs });
  return data.jobs.map((j) => {
    const pay = parsePay(j.compensation?.compensationTierSummary);
    const workplace = j.workplaceType?.toLowerCase();
    return {
      source: "ashby",
      sourceId: `${ref.slug}:${j.id}`,
      company: ref.company,
      title: j.title.trim(),
      location: j.location ?? null,
      mode: workplace === "remote" || j.isRemote ? "remote" : workplace === "hybrid" ? "hybrid" : workplace === "onsite" ? "onsite" : detectMode(j.location, j.title),
      level: j.employmentType === "Intern" ? "internship" : detectLevel(j.title),
      url: j.jobUrl,
      description: j.descriptionPlain ?? null,
      department: j.department ?? j.team ?? null,
      employmentType: j.employmentType ?? null,
      payMin: pay.min,
      payMax: pay.max,
      payPeriod: pay.period,
      postedAt: j.publishedAt ? new Date(j.publishedAt) : null,
    };
  });
}

// ─── SmartRecruiters ──────────────────────────────────────────────────────────

type SmartList = {
  totalFound: number;
  content: Array<{
    id: string;
    name: string;
    releasedDate?: string;
    location?: { city?: string; region?: string; country?: string; remote?: boolean; hybrid?: boolean };
    typeOfEmployment?: { label?: string };
    experienceLevel?: { label?: string };
    department?: { label?: string };
    company?: { name?: string; identifier?: string };
  }>;
};

async function smartrecruiters(ref: BoardRef, opts: BoardFetchOptions): Promise<NormalizedJob[]> {
  const data = await getJson<SmartList>(`https://api.smartrecruiters.com/v1/companies/${ref.slug}/postings?limit=100`, { timeoutMs: opts.timeoutMs });
  return data.content.map((p) => {
    const loc = [p.location?.city, p.location?.region, p.location?.country?.toUpperCase()].filter(Boolean).join(", ");
    return {
      source: "smartrecruiters",
      sourceId: `${ref.slug}:${p.id}`,
      company: p.company?.name ?? ref.company,
      title: p.name.trim(),
      location: loc || null,
      mode: p.location?.remote ? "remote" : p.location?.hybrid ? "hybrid" : detectMode(loc, p.name),
      level: /intern/i.test(p.experienceLevel?.label ?? "") ? "internship" : /entry/i.test(p.experienceLevel?.label ?? "") ? "entry" : detectLevel(p.name),
      url: `https://jobs.smartrecruiters.com/${ref.slug}/${p.id}`,
      description: null,
      department: p.department?.label ?? null,
      employmentType: p.typeOfEmployment?.label ?? null,
      payMin: null,
      payMax: null,
      payPeriod: null,
      postedAt: p.releasedDate ? new Date(p.releasedDate) : null,
    };
  });
}

async function smartrecruitersDetail(slug: string, id: string): Promise<Partial<NormalizedJob>> {
  const d = await getJson<{ jobAd?: { sections?: Record<string, { text?: string }> } }>(
    `https://api.smartrecruiters.com/v1/companies/${slug}/postings/${id}`,
  );
  const sections = d.jobAd?.sections ?? {};
  const description = ["jobDescription", "qualifications", "additionalInformation"]
    .map((k) => htmlToText(sections[k]?.text))
    .filter(Boolean)
    .join("\n\n");
  const pay = parsePay(description);
  return { description, payMin: pay.min, payMax: pay.max, payPeriod: pay.period };
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

/** `withContent` asks Greenhouse for descriptions in the list call; big boards then need a longer timeout. */
export type BoardFetchOptions = { timeoutMs?: number; withContent?: boolean };

export async function fetchBoard(ref: BoardRef, opts: BoardFetchOptions = {}): Promise<NormalizedJob[]> {
  switch (ref.source) {
    case "greenhouse":
      return greenhouse(ref, opts);
    case "lever":
      return lever(ref, opts);
    case "ashby":
      return ashby(ref, opts);
    case "smartrecruiters":
      return smartrecruiters(ref, opts);
  }
}

/** Fills in the description (and anything that depends on it) for sources whose list endpoint omits it. */
export async function fetchBoardDetail(source: NormalizedJob["source"], sourceId: string): Promise<Partial<NormalizedJob> | null> {
  const [slug, id] = sourceId.split(":");
  if (!slug || !id) return null;
  if (source === "greenhouse") return greenhouseDetail(slug, id);
  if (source === "smartrecruiters") return smartrecruitersDetail(slug, id);
  return null;
}
