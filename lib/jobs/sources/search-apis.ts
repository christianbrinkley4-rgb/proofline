import { detectLevel, detectMode, htmlToText, parsePay } from "../text";
import type { NormalizedJob } from "../types";
import { getJson } from "./http";

export { searchHimalayas, searchJobicy } from "./public-remote";

/**
 * Sources we query with keywords instead of downloading whole boards:
 * Workday career sites (big employers: banks, Big 4, insurers), The Muse (no key),
 * and Adzuna / USAJOBS when their free keys are configured.
 */

// ─── Workday ──────────────────────────────────────────────────────────────────

export type WorkdayRef = { tenant: string; wd: string; site: string; company: string };

type WorkdayList = {
  total: number;
  jobPostings: Array<{ title: string; externalPath: string; locationsText?: string; postedOn?: string; bulletFields?: string[] }>;
};

function postedFromText(text?: string): Date | null {
  if (!text) return null;
  if (/today/i.test(text)) return new Date();
  if (/yesterday/i.test(text)) return new Date(Date.now() - 864e5);
  const days = text.match(/(\d+)\+?\s*days?/i);
  return days ? new Date(Date.now() - Number(days[1]) * 864e5) : null;
}

export async function searchWorkday(ref: WorkdayRef, keywords: string, pages = 2): Promise<NormalizedJob[]> {
  const base = `https://${ref.tenant}.${ref.wd}.myworkdayjobs.com`;
  const out: NormalizedJob[] = [];
  for (let page = 0; page < pages; page++) {
    const data = await getJson<WorkdayList>(`${base}/wday/cxs/${ref.tenant}/${ref.site}/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: page * 20, searchText: keywords }),
    });
    for (const p of data.jobPostings ?? []) {
      out.push({
        source: "workday",
        sourceId: `${ref.tenant}|${ref.wd}|${ref.site}|${p.externalPath}`,
        company: ref.company,
        title: p.title.trim(),
        location: p.locationsText ?? null,
        mode: detectMode(p.locationsText, p.title),
        level: detectLevel(p.title),
        url: `${base}/en-US/${ref.site}${p.externalPath}`,
        description: null,
        department: null,
        employmentType: null,
        payMin: null,
        payMax: null,
        payPeriod: null,
        postedAt: postedFromText(p.postedOn),
      });
    }
    if ((page + 1) * 20 >= (data.total ?? 0)) break;
  }
  return out;
}

export async function workdayDetail(sourceId: string): Promise<Partial<NormalizedJob> | null> {
  const [tenant, wd, site, path] = sourceId.split("|");
  if (!path) return null;
  const d = await getJson<{ jobPostingInfo?: { jobDescription?: string; location?: string; remoteType?: string; timeType?: string } }>(
    `https://${tenant}.${wd}.myworkdayjobs.com/wday/cxs/${tenant}/${site}${path}`,
  );
  const info = d.jobPostingInfo;
  if (!info) return null;
  const description = htmlToText(info.jobDescription);
  const pay = parsePay(description);
  return {
    description,
    employmentType: info.timeType ?? null,
    mode: detectMode(info.remoteType, info.location, description.slice(0, 1500)),
    payMin: pay.min,
    payMax: pay.max,
    payPeriod: pay.period,
  };
}

// ─── The Muse (no key) ────────────────────────────────────────────────────────

type MuseResponse = {
  page_count: number;
  results: Array<{
    id: number;
    name: string;
    contents: string;
    publication_date: string;
    company: { name: string };
    locations: Array<{ name: string }>;
    levels: Array<{ name: string }>;
    categories: Array<{ name: string }>;
    refs: { landing_page: string };
  }>;
};

/** Give each requested category its own small page budget. */
export function planMuseSearches(levels: string[], categories: string[], locations: string[]) {
  const selected = [...new Set(categories)].slice(0, 4);
  return selected.length
    ? selected.map((category) => ({ levels, categories: [category], locations, pages: selected.length > 1 ? 2 : 3 }))
    : [{ levels, categories: [], locations, pages: 3 }];
}

export async function searchMuse(params: { levels: string[]; categories: string[]; locations: string[]; pages?: number }): Promise<NormalizedJob[]> {
  const out: NormalizedJob[] = [];
  const pages = params.pages ?? 3;
  for (let page = 0; page < pages; page++) {
    const qs = new URLSearchParams({ page: String(page) });
    for (const l of params.levels) qs.append("level", l);
    for (const c of params.categories) qs.append("category", c);
    for (const loc of params.locations) qs.append("location", loc);
    const data = await getJson<MuseResponse>(`https://www.themuse.com/api/public/jobs?${qs}`);
    for (const r of data.results) {
      const location = r.locations.map((l) => l.name).join("; ") || null;
      const description = htmlToText(r.contents);
      const pay = parsePay(description);
      const levelName = r.levels[0]?.name ?? "";
      out.push({
        source: "themuse",
        sourceId: String(r.id),
        company: r.company.name,
        title: r.name.replace(/\\\//g, "/").trim(),
        location,
        mode: detectMode(location, r.name),
        level: /intern/i.test(levelName) ? "internship" : /entry/i.test(levelName) ? "entry" : detectLevel(r.name),
        url: r.refs.landing_page,
        description,
        department: r.categories[0]?.name ?? null,
        employmentType: null,
        payMin: pay.min,
        payMax: pay.max,
        payPeriod: pay.period,
        postedAt: new Date(r.publication_date),
      });
    }
    if (page + 1 >= data.page_count) break;
  }
  return out;
}

// ─── Adzuna (free key) ────────────────────────────────────────────────────────

type AdzunaResponse = {
  results: Array<{
    id: string;
    title: string;
    description: string;
    created: string;
    redirect_url: string;
    company?: { display_name?: string };
    location?: { display_name?: string };
    salary_min?: number;
    salary_max?: number;
    contract_time?: string;
  }>;
};

export function adzunaConfigured() {
  return Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
}

export async function searchAdzuna(what: string, where: string | null): Promise<NormalizedJob[]> {
  if (!adzunaConfigured()) return [];
  const qs = new URLSearchParams({
    app_id: process.env.ADZUNA_APP_ID!,
    app_key: process.env.ADZUNA_APP_KEY!,
    what,
    results_per_page: "50",
    "content-type": "application/json",
  });
  if (where) qs.set("where", where);
  const data = await getJson<AdzunaResponse>(`https://api.adzuna.com/v1/api/jobs/us/search/1?${qs}`);
  return data.results.map((r) => ({
    source: "adzuna",
    sourceId: r.id,
    company: r.company?.display_name ?? "Unknown company",
    title: htmlToText(r.title),
    location: r.location?.display_name ?? null,
    mode: detectMode(r.location?.display_name, r.title, r.description),
    level: detectLevel(r.title),
    url: r.redirect_url,
    description: htmlToText(r.description),
    department: null,
    employmentType: r.contract_time ?? null,
    payMin: r.salary_min ?? null,
    payMax: r.salary_max ?? null,
    payPeriod: r.salary_min ? (r.salary_min < 500 ? "hour" : "year") : null,
    postedAt: new Date(r.created),
  }));
}

// ─── USAJOBS (free key) ───────────────────────────────────────────────────────

type UsaJobsResponse = {
  SearchResult: {
    SearchResultItems: Array<{
      MatchedObjectId: string;
      MatchedObjectDescriptor: {
        PositionTitle: string;
        OrganizationName: string;
        PositionLocationDisplay: string;
        PositionURI: string;
        PublicationStartDate: string;
        QualificationSummary?: string;
        UserArea?: { Details?: { JobSummary?: string } };
        PositionRemuneration?: Array<{ MinimumRange: string; MaximumRange: string; RateIntervalCode: string }>;
      };
    }>;
  };
};

export function usajobsConfigured() {
  return Boolean(process.env.USAJOBS_API_KEY && process.env.USAJOBS_EMAIL);
}

export async function searchUsaJobs(keyword: string, location: string | null): Promise<NormalizedJob[]> {
  if (!usajobsConfigured()) return [];
  const qs = new URLSearchParams({ Keyword: keyword, ResultsPerPage: "50" });
  if (location) qs.set("LocationName", location);
  const data = await getJson<UsaJobsResponse>(`https://data.usajobs.gov/api/search?${qs}`, {
    headers: { Host: "data.usajobs.gov", "User-Agent": process.env.USAJOBS_EMAIL!, "Authorization-Key": process.env.USAJOBS_API_KEY! },
  });
  return data.SearchResult.SearchResultItems.map(({ MatchedObjectId, MatchedObjectDescriptor: d }) => {
    const pay = d.PositionRemuneration?.[0];
    const description = [d.UserArea?.Details?.JobSummary, d.QualificationSummary].filter(Boolean).join("\n\n");
    return {
      source: "usajobs",
      sourceId: MatchedObjectId,
      company: d.OrganizationName,
      title: d.PositionTitle,
      location: d.PositionLocationDisplay,
      mode: detectMode(d.PositionLocationDisplay, d.PositionTitle),
      level: detectLevel(d.PositionTitle),
      url: d.PositionURI,
      description: description || null,
      department: null,
      employmentType: null,
      payMin: pay ? Number(pay.MinimumRange) : null,
      payMax: pay ? Number(pay.MaximumRange) : null,
      payPeriod: pay ? (pay.RateIntervalCode === "PH" ? "hour" : "year") : null,
      postedAt: new Date(d.PublicationStartDate),
    };
  });
}
