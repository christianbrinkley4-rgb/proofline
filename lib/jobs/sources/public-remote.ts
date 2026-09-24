import { detectLevel, htmlToText } from "../text";
import type { NormalizedJob } from "../types";
import { getJson } from "./http";

/** These public APIs require a visible provider credit and a link to each original listing. */
export type PublicRemoteJob = Omit<NormalizedJob, "source"> & { source: "himalayas" | "jobicy" };

type DateValue = string | number | null | undefined;
type HimalayasRecord = {
  guid?: string;
  title?: string;
  companyName?: string;
  applicationLink?: string;
  description?: string;
  excerpt?: string;
  employmentType?: string;
  seniority?: string[];
  locationRestrictions?: Array<{ alpha2?: string; name?: string }>;
  categories?: string[];
  parentCategories?: string[];
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: string;
  currency?: string;
  pubDate?: DateValue;
  expiryDate?: DateValue;
};

type JobicyRecord = {
  id?: number | string;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  jobGeo?: string;
  jobLevel?: string;
  jobIndustry?: string[];
  jobType?: string[];
  jobDescription?: string;
  jobExcerpt?: string;
  pubDate?: DateValue;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryPeriod?: string;
  salaryCurrency?: string;
};

type HimalayasResponse = { jobs?: HimalayasRecord[] };
type JobicyResponse = { jobs?: JobicyRecord[] };

const DAY = 86_400_000;
const CACHE_MS = DAY; // Himalayas refreshes the public feed daily; Jobicy asks integrators to cache.
const CACHE_LIMIT = 100;
const cache = new Map<string, { at: number; promise: Promise<unknown> }>();

async function getCached<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise as Promise<T>;
  const promise = getJson<T>(url, { timeoutMs: 10000 });
  cache.set(url, { at: Date.now(), promise });
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  try {
    return await promise;
  } catch (error) {
    cache.delete(url);
    throw error;
  }
}

function date(value: DateValue): Date | null {
  if (value == null || value === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function providerUrl(value: string | undefined, provider: "himalayas.app" | "jobicy.com"): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || (url.hostname !== provider && url.hostname !== `www.${provider}`)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function pay(record: { min: number | null | undefined; max: number | null | undefined; period?: string; currency?: string }): Pick<NormalizedJob, "payMin" | "payMax" | "payPeriod"> {
  // Proofline currently displays amounts with $, so other currencies must not masquerade as USD.
  const period: NormalizedJob["payPeriod"] = /^(hourly|hour)$/i.test(record.period ?? "") ? "hour" : /^(annual|yearly|year)$/i.test(record.period ?? "annual") ? "year" : null;
  const allowed = record.currency === "USD" && period !== null;
  return {
    payMin: allowed && Number.isFinite(record.min) ? record.min! : null,
    payMax: allowed && Number.isFinite(record.max) ? record.max! : null,
    payPeriod: allowed ? period : null,
  };
}

export function normalizeHimalayas(record: HimalayasRecord, now = Date.now()): PublicRemoteJob | null {
  const url = providerUrl(record.applicationLink, "himalayas.app");
  if (!url || !record.guid || !record.title?.trim() || !record.companyName?.trim()) return null;
  const expires = date(record.expiryDate);
  if (expires && expires.getTime() < now) return null;
  const countries = (record.locationRestrictions ?? []).map((c) => c.name || c.alpha2).filter((c): c is string => Boolean(c));
  const location = countries.length ? `Remote · ${countries.join(", ")}` : "Remote · Worldwide";
  const description = htmlToText(record.description || record.excerpt);
  const seniority = record.seniority ?? [];
  const level = /intern/i.test(record.employmentType ?? "") ? "internship"
    : seniority.some((s) => /entry/i.test(s)) ? "entry"
      : seniority.some((s) => /mid|senior|manager|director|executive/i.test(s)) ? "experienced"
        : detectLevel(record.title);
  return {
    source: "himalayas",
    sourceId: record.guid,
    company: record.companyName.trim(),
    title: htmlToText(record.title),
    location,
    mode: "remote",
    level,
    url,
    description: description || null,
    department: record.parentCategories?.[0] ?? record.categories?.[0] ?? null,
    employmentType: record.employmentType ?? null,
    ...pay({ min: record.minSalary, max: record.maxSalary, period: record.salaryPeriod, currency: record.currency }),
    postedAt: date(record.pubDate),
  };
}

export function normalizeJobicy(record: JobicyRecord): PublicRemoteJob | null {
  const url = providerUrl(record.url, "jobicy.com");
  if (!url || record.id == null || !record.jobTitle?.trim() || !record.companyName?.trim()) return null;
  const description = htmlToText(record.jobDescription || record.jobExcerpt);
  const level = /intern/i.test((record.jobType ?? []).join(" ")) ? "internship"
    : /entry|junior/i.test(record.jobLevel ?? "") ? "entry"
      : /mid|senior|lead|manager|director|executive/i.test(record.jobLevel ?? "") ? "experienced"
        : detectLevel(record.jobTitle);
  return {
    source: "jobicy",
    sourceId: String(record.id),
    company: record.companyName.trim(),
    title: htmlToText(record.jobTitle),
    location: `Remote · ${record.jobGeo?.trim() || "Location not specified"}`,
    mode: "remote",
    level,
    url,
    description: description || null,
    department: record.jobIndustry?.[0] ?? null,
    employmentType: record.jobType?.join(", ") || null,
    ...pay({ min: record.salaryMin, max: record.salaryMax, period: record.salaryPeriod, currency: record.salaryCurrency }),
    postedAt: date(record.pubDate),
  };
}

/** At most two keyword pages, with an optional ISO country eligibility filter. */
export async function searchHimalayas(keyword: string, opts: { country?: string; pages?: number } = {}): Promise<PublicRemoteJob[]> {
  const q = keyword.trim().slice(0, 120);
  if (!q) return [];
  const pages = Math.max(1, Math.min(2, Math.floor(opts.pages ?? 1)));
  const out: PublicRemoteJob[] = [];
  for (let page = 1; page <= pages; page++) {
    const params = new URLSearchParams({ q, sort: "recent", page: String(page) });
    if (opts.country && /^[A-Za-z]{2}$/.test(opts.country)) params.set("country", opts.country.toUpperCase());
    const response = await getCached<HimalayasResponse>(`https://himalayas.app/jobs/api/search?${params}`);
    const jobs = response.jobs ?? [];
    out.push(...jobs.map((job) => normalizeHimalayas(job)).filter((job): job is PublicRemoteJob => job !== null));
    if (!jobs.length) break;
  }
  return [...new Map(out.map((job) => [job.sourceId, job])).values()];
}

/** One filtered request, capped at 100 public listings. `geo` is a Jobicy location slug. */
export async function searchJobicy(keyword: string, opts: { geo?: string; count?: number } = {}): Promise<PublicRemoteJob[]> {
  const tag = keyword.trim().slice(0, 120);
  if (!tag) return [];
  const count = Math.max(1, Math.min(100, Math.floor(opts.count ?? 50)));
  const params = new URLSearchParams({ tag, count: String(count) });
  if (opts.geo && /^[a-z-]{2,40}$/.test(opts.geo)) params.set("geo", opts.geo);
  const response = await getCached<JobicyResponse>(`https://jobicy.com/api/v2/remote-jobs?${params}`);
  return (response.jobs ?? []).map(normalizeJobicy).filter((job): job is PublicRemoteJob => job !== null);
}
