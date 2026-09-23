import { detectLevel, detectMode, htmlToText, parsePay } from "../text";
import type { NormalizedJob } from "../types";
import { BOARDS } from "../registry";
import { fetchBoard, fetchBoardDetail } from "./boards";
import { USER_AGENT } from "./http";
import { workdayDetail } from "./search-apis";

/**
 * Paste-a-link: a job the student found anywhere (LinkedIn, Indeed, Handshake,
 * a company site). Known job boards go through their APIs; everything else is
 * read from the page's schema.org JobPosting data, which nearly every job page
 * publishes for Google.
 */

export class LinkImportError extends Error {}

type JsonLdPosting = {
  "@type"?: string | string[];
  title?: string;
  description?: string;
  datePosted?: string;
  employmentType?: string | string[];
  hiringOrganization?: { name?: string } | string;
  jobLocation?: Array<{ address?: { addressLocality?: string; addressRegion?: string } }> | { address?: { addressLocality?: string; addressRegion?: string } };
  jobLocationType?: string;
  baseSalary?: { value?: { minValue?: number; maxValue?: number; value?: number; unitText?: string } };
  identifier?: { value?: string };
};

function findPosting(node: unknown): JsonLdPosting | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findPosting(n);
      if (hit) return hit;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return obj as JsonLdPosting;
  if (obj["@graph"]) return findPosting(obj["@graph"]);
  return null;
}

export function postingFromHtml(html: string, url: string): NormalizedJob | null {
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const p = findPosting(data);
    if (!p?.title) continue;
    const locations = (Array.isArray(p.jobLocation) ? p.jobLocation : p.jobLocation ? [p.jobLocation] : [])
      .map((l) => [l.address?.addressLocality, l.address?.addressRegion].filter(Boolean).join(", "))
      .filter(Boolean);
    const location = p.jobLocationType === "TELECOMMUTE" ? ["Remote", ...locations].join("; ") : locations.join("; ") || null;
    const description = htmlToText(p.description);
    const salary = p.baseSalary?.value;
    const pay = salary?.minValue || salary?.value ? null : parsePay(description);
    const period = salary?.unitText ? (/hour/i.test(salary.unitText) ? "hour" : "year") : pay?.period ?? null;
    const company = typeof p.hiringOrganization === "string" ? p.hiringOrganization : p.hiringOrganization?.name;
    const employment = Array.isArray(p.employmentType) ? p.employmentType.join(", ") : p.employmentType ?? null;
    return {
      source: "link",
      sourceId: url,
      company: company?.trim() || new URL(url).hostname.replace(/^www\./, ""),
      title: htmlToText(p.title),
      location,
      mode: p.jobLocationType === "TELECOMMUTE" ? "remote" : detectMode(location, p.title, description.slice(0, 1500)),
      level: /intern/i.test(employment ?? "") ? "internship" : detectLevel(p.title),
      url,
      description,
      department: null,
      employmentType: employment,
      payMin: salary?.minValue ?? salary?.value ?? pay?.min ?? null,
      payMax: salary?.maxValue ?? salary?.value ?? pay?.max ?? null,
      payPeriod: period,
      postedAt: p.datePosted ? new Date(p.datePosted) : null,
    };
  }
  return null;
}

/** Known ATS links resolve through the board's API for full, clean data. */
async function viaBoard(url: URL): Promise<NormalizedJob | null> {
  const host = url.hostname;
  const parts = url.pathname.split("/").filter(Boolean);
  const pick = async (source: "greenhouse" | "lever" | "ashby", slug: string, id: string) => {
    const known = BOARDS.find((b) => b.source === source && b.slug.toLowerCase() === slug.toLowerCase());
    const jobs = await fetchBoard({ source, slug, company: known?.company ?? capitalize(slug) });
    const job = jobs.find((j) => j.sourceId.endsWith(`:${id}`)) ?? null;
    if (job && !job.description) Object.assign(job, (await fetchBoardDetail(job.source, job.sourceId).catch(() => null)) ?? {});
    return job;
  };
  if (/greenhouse\.io$/.test(host)) {
    const idx = parts.indexOf("jobs");
    const id = url.searchParams.get("gh_jid") ?? (idx >= 0 ? parts[idx + 1] : undefined);
    if (parts[0] && id) return pick("greenhouse", parts[0], id);
  }
  // Company-hosted Greenhouse pages (stripe.com/jobs/search?gh_jid=123): the board is usually named after the domain.
  const ghId = url.searchParams.get("gh_jid");
  if (ghId) {
    const domainName = host.replace(/^(www|careers|jobs)\./, "").split(".")[0];
    const hit = await pick("greenhouse", domainName, ghId).catch(() => null);
    if (hit) return hit;
  }
  if (host === "jobs.lever.co" && parts.length >= 2) return pick("lever", parts[0], parts[1]);
  if (host === "jobs.ashbyhq.com" && parts.length >= 2) return pick("ashby", parts[0], parts[1]);
  if (/myworkdayjobs\.com$/.test(host)) {
    const [tenant, wd] = host.split(".");
    const siteIdx = parts[0]?.includes("-") && parts[0].length <= 5 ? 1 : 0;
    const site = parts[siteIdx];
    const path = `/${parts.slice(siteIdx + 1).join("/")}`;
    const detail = await workdayDetail(`${tenant}|${wd}|${site}|${path}`);
    if (detail?.description) {
      const title = parts[parts.length - 1]?.replace(/_[A-Z0-9-]+$/, "").replace(/-/g, " ") ?? "Job";
      return {
        source: "workday",
        sourceId: `${tenant}|${wd}|${site}|${path}`,
        company: tenant,
        title,
        location: null,
        mode: detail.mode ?? "unknown",
        level: detectLevel(title),
        url: url.toString(),
        description: detail.description,
        department: null,
        employmentType: detail.employmentType ?? null,
        payMin: detail.payMin ?? null,
        payMax: detail.payMax ?? null,
        payPeriod: detail.payPeriod ?? null,
        postedAt: null,
      };
    }
  }
  return null;
}

export async function importJobLink(raw: string): Promise<NormalizedJob> {
  let url: URL;
  try {
    url = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    throw new LinkImportError("That doesn't look like a link.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new LinkImportError("That doesn't look like a web link.");

  const fromBoard = await viaBoard(url).catch(() => null);
  if (fromBoard) return fromBoard;

  const res = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "text/html" }, signal: AbortSignal.timeout(12000), redirect: "follow" }).catch(() => null);
  if (!res?.ok) {
    throw new LinkImportError(
      /handshake|linkedin/.test(url.hostname)
        ? "That page needs you to be signed in, so we can't read it. Open the posting, copy the description, and paste it instead."
        : "We couldn't open that page. Check the link, or paste the job description instead.",
    );
  }
  const html = await res.text();
  const posting = postingFromHtml(html, res.url || url.toString());
  if (posting) return posting;

  // Last resort: the page's own title and text.
  const title = htmlToText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").split(/\s[|\-–]\s/)[0];
  const body = htmlToText(html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? "").slice(0, 20000);
  const generic = /^(careers?|jobs?|job search|open (positions|roles)|join us|work with us)\b|\bcareers$/i.test(title.trim()) || /\bcareers\b/i.test(title) && title.split(" ").length <= 3;
  if (!title || generic || body.length < 200) throw new LinkImportError("We couldn't find a job posting on that page. Try the link to the specific job, or paste the description instead.");
  return {
    source: "link",
    sourceId: url.toString(),
    company: url.hostname.replace(/^www\./, "").split(".")[0],
    title,
    location: null,
    mode: detectMode(body.slice(0, 2000)),
    level: detectLevel(title),
    url: url.toString(),
    description: body,
    department: null,
    employmentType: null,
    payMin: null,
    payMax: null,
    payPeriod: null,
    postedAt: null,
  };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
