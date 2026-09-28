import { extractSkills } from "@/lib/fit/skills";
import { extractKeywords, matchKeywords } from "@/lib/jobs/keywords";
import { toPastTense } from "@/lib/resume/polish";
import { ACTION_VERBS } from "@/lib/resume/verbs";
import { canonical, numbersIn } from "@/lib/resume/verify";

/**
 * The review gate's deterministic linter. Input is the resume as text (see
 * resume-text.ts: bold is **marked**, bullets start with "- "), the job
 * description, and the user's confirmed facts. Output is one result per check.
 *
 * The iron rule of this module: a check that cannot quote the exact offending
 * text from the resume passes. Every failure carries an evidence_quote that is a
 * verbatim substring of resumeText; `enforceQuotes` turns any failure without one
 * into a pass before results leave this file.
 */

export type Severity = "BLOCKING" | "WARN" | "INFO";

export type LintCheckId =
  | "one_page"
  | "no_em_dashes"
  | "bullets_start_with_verb"
  | "bullets_have_numbers"
  | "jd_keyword_overlap"
  | "no_unconfirmed_claims"
  | "no_banned_content"
  | "no_empty_bullets_or_paragraphs"
  | "consistent_bold"
  | "no_duplicate_words_in_skills"
  | "consistent_date_format"
  | "no_trailing_or_double_spaces"
  | "section_headers_present"
  | "contact_info_complete"
  | "contractions_consistent"
  | "no_corporate_filler";

export type LintCheck = {
  id: LintCheckId;
  label: string;
  severity: Severity;
  passed: boolean;
  /** Verbatim text from the resume that shows the problem. Empty when passed. */
  evidence_quote: string;
  /** Every offending quote, when there's more than one (for example each bullet without a number). */
  failures: string[];
  /** One plain sentence for the person: what's wrong, or what passed. */
  detail: string;
};

export type LintInput = {
  resumeText: string;
  jobDescription: string;
  userFacts: string[];
  /** The posting's keyword phrases (Phase D). Extracted from the description when absent. */
  keywords?: string[];
  /** Pages the PDF needs, measured by the layout engine. Absent: the line-count heuristic below. */
  pageCount?: number;
};

// ─── Shipped word lists ───────────────────────────────────────────────────────

/** Every verb in lib/resume/verbs.ts plus common past-tense resume verbs. */
const VERBS = new Set<string>([
  ...Object.values(ACTION_VERBS).flat().map((v) => v.toLowerCase()),
  ...(
    "achieved added addressed administered advised analyzed answered applied arranged assembled assessed assisted audited automated balanced booked briefed budgeted built calculated " +
    "catalogued caught changed checked cleaned closed coached collaborated collected completed composed computed conducted configured consolidated contacted contributed controlled " +
    "converted coordinated corrected counseled created cut debugged decreased defined delivered demonstrated deployed designed detected determined developed diagnosed directed " +
    "discovered distributed documented drafted drove earned edited eliminated enabled engineered entered established estimated evaluated examined executed expanded explained " +
    "facilitated filed filled fixed forecast forecasted formed founded gathered generated grew guided handled hired identified implemented improved increased influenced informed " +
    "initiated inspected installed instructed integrated interviewed introduced inventoried investigated launched led lifted logged lowered maintained managed mapped measured " +
    "mentored merged met migrated modeled monitored motivated moved negotiated opened operated optimized ordered organized oversaw packed performed placed planned posted prepared " +
    "presented prevented prioritized processed produced programmed promoted proposed protected provided published purchased raised ran reached recommended reconciled recorded " +
    "recruited redesigned reduced refined registered reorganized repaired replaced reported represented researched resolved restocked restored reviewed revised saved scheduled " +
    "screened secured served set shipped simplified sold solved sorted spearheaded staffed standardized started streamlined strengthened structured supervised supported surveyed " +
    "sustained taught tested tracked trained transcribed transformed translated tutored updated upgraded validated verified volunteered won wrote"
  ).split(/\s+/),
]);

const WEAK_PHRASES = ["responsible for", "was responsible for", "helped with", "helped to", "assisted with", "worked on", "duties included", "tasked with", "participated in", "in charge of"];
const LEADING_FILLER = new Set(["a", "an", "the", "and", "but", "or", "so", "also", "then", "i", "my", "we", "our"]);

/** Phrases that read as machine-written. Blocking: a recruiter who spots one stops trusting the page. */
export const AI_TELLTALES = [
  "delve", "delved", "delving", "tapestry", "testament to", "in today's fast-paced", "fast-paced environment", "ever-evolving", "ever-changing landscape",
  "navigate the complexities", "navigating the complexities", "seamlessly", "meticulous", "meticulously", "unwavering", "paramount", "pivotal role", "played a pivotal",
  "showcasing", "fostering a culture", "harness the power", "harnessing the power", "unlock the potential", "unlocking the potential", "in the realm of", "embarked on",
  "a proven track record", "it's worth noting", "at the intersection of", "keen eye for detail", "multifaceted", "holistic approach", "as an ai", "i am excited to",
  "spearheaded synergies", "state-of-the-art", "cutting-edge",
];

/** Corporate filler: says nothing a result wouldn't say better. */
export const CORPORATE_FILLER = [
  "leverage", "leveraged", "leverages", "leveraging", "synergy", "synergies", "passionate", "dynamic", "results-driven", "results-oriented", "detail-oriented",
  "team player", "self-starter", "go-getter", "hard-working", "hardworking", "highly motivated", "think outside the box", "best-in-class", "value-add", "proactive",
  "rockstar", "ninja", "guru", "utilize", "utilized", "utilizing", "world-class", "strategic thinker", "go-to person",
];

const CONTRACTIONS = /\b(?:don't|doesn't|didn't|can't|won't|isn't|aren't|wasn't|weren't|it's|i'm|we're|they're|you're|i've|we've|haven't|hasn't|shouldn't|couldn't|wouldn't)\b/i;
const EXPANDED = /\b(?:do not|does not|did not|can not|cannot|will not|is not|are not|was not|were not|it is|i am|we are|they are|have not|has not|should not|could not|would not)\b/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Line = { text: string; kind: "name" | "contact" | "heading" | "entry" | "bullet" | "skills" | "other"; section: string | null };

const HEADING = /^[A-Z][A-Z &/,-]{2,40}$/;

function parseLines(text: string): Line[] {
  const raw = text.split("\n");
  let section: string | null = null;
  return raw.map((line, i) => {
    const trimmed = line.trim();
    if (i === 0) return { text: line, kind: "name", section };
    if (i === 1 && !HEADING.test(trimmed)) return { text: line, kind: "contact", section };
    if (HEADING.test(trimmed)) {
      section = trimmed;
      return { text: line, kind: "heading", section };
    }
    if (/^\s*-\s?/.test(line)) return { text: line, kind: "bullet", section };
    // A role heading: any bold on it, or pipe-separated parts outside Education and Skills.
    if (trimmed.includes("**") || (/ \| /.test(trimmed) && section && !/SKILL|EDUCATION/.test(section))) return { text: line, kind: "entry", section };
    if (section && /SKILL/.test(section) && /:/.test(line)) return { text: line, kind: "skills", section };
    return { text: line, kind: "other", section };
  });
}

const bulletBody = (line: string) => line.replace(/^\s*-\s?/, "");
/** "Technical: Excel (pivot tables, XLOOKUP), QuickBooks": commas inside parentheses don't split. */
const skillItems = (line: string) => line.slice(line.indexOf(":") + 1).split(/,(?![^()]*\))/).map((s) => s.trim()).filter(Boolean);
const stripBold = (text: string) => text.replace(/\*\*/g, "");

/** Crude stem so "reconciled" and "reconcile" and "reconciliations" meet. */
function stem(word: string): string {
  return word
    .toLowerCase()
    .replace(/(iations?|ations?|ings?|ed|es|s|ly|ment|ments)$/, "")
    .replace(/(.)\1$/, "$1")
    .slice(0, 7);
}

const CLAIM_STOP = new Set(
  "a an and the of for to in on at by with from as or per each every into over under about than this that these those it its our my their was were is are be been being".split(" "),
);

function contentStems(text: string): string[] {
  return [...new Set(stripBold(text).toLowerCase().match(/[a-z][a-z'+#-]*/g) ?? [])].filter((w) => w.length > 2 && !CLAIM_STOP.has(w)).map(stem);
}

const WORD_NUMBERS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12",
  fifteen: "15", twenty: "20", thirty: "30", fifty: "50", hundred: "100", first: "1", second: "2", third: "3", half: "50%", double: "2x", doubled: "2x", triple: "3x", tripled: "3x",
};

/** "3.50" and "3.5" are the same number; so are "$3,200.00" and "$3,200". */
function sameNumber(value: string): string {
  return /^\d+\.\d+$/.test(value) ? String(Number(value)) : value;
}

function factNumbers(facts: string[]): Set<string> {
  const set = new Set<string>();
  for (const f of facts) {
    for (const n of numbersIn(f)) set.add(sameNumber(n));
    for (const w of f.toLowerCase().match(/[a-z]+/g) ?? []) if (WORD_NUMBERS[w]) set.add(canonical(WORD_NUMBERS[w]));
  }
  return set;
}

/** Numbers that are claims: skips years, dates, and a GPA scale like "/4.0". */
export function claimNumbers(line: string): Array<{ token: string; value: string }> {
  // Plan and form names ("401(k)", "403(b)", "Form 1040") are names, not claims.
  const text = line.replace(/\/\s*4(?:\.0+)?\b/g, "").replace(/\b(?:401|403|457)\s*\(\s*[a-z]\s*\)/gi, "").replace(/\bform\s+\d{3,4}[a-z-]*\b/gi, "");
  const out: Array<{ token: string; value: string }> = [];
  for (const m of text.matchAll(/\$?\d[\d,]*(?:\.\d+)?\s?(?:%|k|m|x|\+)?/gi)) {
    const token = m[0].trim();
    const value = sameNumber(canonical(token));
    if (!value || /^(19|20)\d{2}$/.test(value)) continue;
    out.push({ token, value });
  }
  return out;
}

// ─── The checks ───────────────────────────────────────────────────────────────

/**
 * one_page. With a measured page count, that decides it. Without one, the
 * documented heuristic: a US Letter page with 0.5 inch margins at 10 to 11 pt
 * holds about 58 lines of about 95 characters. Every resume line counts as
 * ceil(length / 95) rendered lines, headings count 2 (they carry spacing), and
 * more than 58 fails, quoting the line where the page runs out.
 */
export const LINES_PER_PAGE = 58;
export const CHARS_PER_LINE = 95;

function onePage(lines: Line[], pageCount?: number): Pick<LintCheck, "passed" | "evidence_quote" | "failures" | "detail"> {
  if (pageCount !== undefined) {
    const last = [...lines].reverse().find((l) => l.text.trim())?.text.trim() ?? "";
    return pageCount <= 1
      ? { passed: true, evidence_quote: "", failures: [], detail: "Fits on one page, measured with the real fonts." }
      : { passed: false, evidence_quote: last, failures: [last], detail: `Runs to ${pageCount} pages. The page ends before this line.` };
  }
  let used = 0;
  for (const line of lines) {
    const text = stripBold(line.text);
    used += line.kind === "heading" ? 2 : Math.max(1, Math.ceil(text.length / CHARS_PER_LINE));
    if (used > LINES_PER_PAGE) {
      const quote = line.text.trim();
      return { passed: false, evidence_quote: quote, failures: [quote], detail: `About ${used} lines; a page holds about ${LINES_PER_PAGE}. It runs over at this line.` };
    }
  }
  return { passed: true, evidence_quote: "", failures: [], detail: `About ${used} of ${LINES_PER_PAGE} lines used.` };
}

function firstWords(bullet: string) {
  const words = bullet.trim().split(/\s+/);
  return { first: (words[0] ?? "").toLowerCase().replace(/[^a-z'-]/g, ""), opening: words.slice(0, 3).join(" ") };
}

export function lintResume(input: LintInput): LintCheck[] {
  const { resumeText } = input;
  const lines = parseLines(resumeText);
  const bullets = lines.filter((l) => l.kind === "bullet");
  const body = lines.filter((l) => l.kind !== "name" && l.kind !== "contact");
  const checks: LintCheck[] = [];
  const add = (id: LintCheckId, label: string, severity: Severity, result: Pick<LintCheck, "passed" | "evidence_quote" | "failures" | "detail">) =>
    checks.push({ id, label, severity, ...result });
  const fail = (failures: string[], detail: string) => ({ passed: false, evidence_quote: failures[0] ?? "", failures, detail });
  const pass = (detail: string) => ({ passed: true, evidence_quote: "", failures: [], detail });

  // ── Content
  add("one_page", "Fits on one page", "BLOCKING", onePage(lines, input.pageCount));

  const dashLines = lines.filter((l) => l.text.includes("—")).map((l) => l.text.trim());
  add("no_em_dashes", "No em dashes", "BLOCKING", dashLines.length ? fail(dashLines, `${dashLines.length === 1 ? "A line uses" : `${dashLines.length} lines use`} an em dash. Use a comma or a period instead.`) : pass("No em dashes anywhere."));

  const weakOpeners = bullets
    .map((l) => bulletBody(l.text))
    .filter((b) => {
      const lower = b.trim().toLowerCase();
      if (WEAK_PHRASES.some((p) => lower.startsWith(`${p} `) || lower === p)) return true;
      const { first } = firstWords(b);
      if (LEADING_FILLER.has(first)) return true;
      // Present tense is right for a current role or ongoing project ("Guide", "Build").
      return !VERBS.has(first) && !/^[a-z]+ed$/.test(first) && !toPastTense(first);
    })
    .map((b) => firstWords(b).opening);
  add(
    "bullets_start_with_verb",
    "Bullets start with an action verb",
    "WARN",
    weakOpeners.length ? fail(weakOpeners, `${weakOpeners.length} ${weakOpeners.length === 1 ? "bullet doesn't" : "bullets don't"} open with an action verb. Lead with what you did: Reconciled, Built, Trained.`) : pass(bullets.length ? "Every bullet opens with an action verb." : "No bullets to check."),
  );

  const NUMBER_WORD = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen|dozens|hundred|hundreds|thousand|thousands|half|twice|double[ds]?|triple[ds]?)\b/i;
  const unmeasured = bullets.map((l) => bulletBody(l.text)).filter((b) => !/\d|%|\$/.test(b) && !NUMBER_WORD.test(b));
  add(
    "bullets_have_numbers",
    "Every bullet has a number",
    "WARN",
    unmeasured.length ? fail(unmeasured, `${unmeasured.length} of ${bullets.length} bullets have no number. Add how many, how much, or how often to your fact, if you know it.`) : pass(bullets.length ? `All ${bullets.length} bullets carry a number.` : "No bullets to check."),
  );

  const keywords = input.keywords?.length ? input.keywords : extractKeywords(input.jobDescription);
  const found = matchKeywords(keywords, stripBold(resumeText));
  add("jd_keyword_overlap", "Posting keywords on the page", "INFO", {
    passed: true,
    evidence_quote: "",
    failures: [],
    detail: keywords.length
      ? `${found.matched.length} of ${keywords.length} posting keywords appear.${found.matched.length ? ` On the page: ${found.matched.slice(0, 8).join(", ")}.` : ""}${found.missing.length ? ` Not on the page: ${found.missing.slice(0, 8).join(", ")}. Only add one if a fact of yours backs it.` : ""}`
      : "The posting has no clear keywords to compare.",
  });

  // no_unconfirmed_claims: every number, and every factual claim, must match a fact.
  const facts = input.userFacts.map((f) => f.trim()).filter(Boolean);
  const factText = facts.join("\n").toLowerCase();
  const allowedNumbers = factNumbers(facts);
  const factSkills = new Set(extractSkills(facts.join("\n")));
  const factStems = facts.map((f) => new Set(contentStems(f)));
  const unconfirmed: string[] = [];
  const unconfirmedWhy: string[] = [];
  for (const line of body) {
    if (line.kind === "heading") continue;
    for (const n of claimNumbers(stripBold(line.text))) {
      if (!allowedNumbers.has(n.value) && !allowedNumbers.has(n.value.replace(/%$/, ""))) {
        unconfirmed.push(n.token);
        unconfirmedWhy.push(`"${n.token}" isn't in any of your facts`);
      }
    }
    if (line.kind === "bullet") {
      const stems = contentStems(bulletBody(line.text));
      const best = factStems.reduce((max, set) => Math.max(max, stems.filter((s) => set.has(s)).length / Math.max(1, stems.length)), 0);
      if (stems.length && best < 0.6) {
        unconfirmed.push(bulletBody(line.text).trim());
        unconfirmedWhy.push("a bullet no fact supports");
      }
    }
    if (line.kind === "entry") {
      // "**Title** | Org | Location | Dates": the title and the org are claims.
      for (const part of stripBold(line.text).split(" | ").slice(0, 2)) {
        const clean = part.trim();
        // Dates and a "City, ST" location aren't claims about what the person did.
        if (!clean || /\d{4}|present/i.test(clean) || /^[A-Z][A-Za-z .'-]+,\s*[A-Z]{2}$/.test(clean) || /^remote$/i.test(clean)) continue;
        if (!factText.includes(clean.toLowerCase())) {
          unconfirmed.push(clean);
          unconfirmedWhy.push(`"${clean}" isn't a confirmed role or organization`);
        }
      }
    }
    if (line.kind === "skills") {
      const items = skillItems(line.text);
      for (const item of items) {
        const base = item.replace(/\s*\(.*\)$/, "");
        const skills = extractSkills(base);
        const backed = factText.includes(base.toLowerCase()) || (skills.length > 0 && skills.every((s) => factSkills.has(s)));
        if (!backed) {
          unconfirmed.push(item);
          unconfirmedWhy.push(`"${item}" isn't in your facts`);
        }
      }
    }
  }
  add(
    "no_unconfirmed_claims",
    "Every claim matches a confirmed fact",
    "BLOCKING",
    unconfirmed.length
      ? fail(unconfirmed, `${unconfirmed.length === 1 ? "One claim doesn't" : `${unconfirmed.length} claims don't`} match a fact you confirmed: ${unconfirmedWhy.slice(0, 3).join("; ")}. Confirm it on My facts or take it off.`)
      : pass("Every number and claim matches a fact you confirmed."),
  );

  const banned: string[] = [];
  const bannedWhy: string[] = [];
  const scan = (pattern: RegExp, why: string) => {
    for (const line of lines) {
      const m = line.text.match(pattern);
      if (m) {
        banned.push(m[0]);
        bannedWhy.push(why);
      }
    }
  };
  scan(/\b(?:u\.?s\.? citizen(?:ship)?|citizenship|green card|permanent resident|visa status|h-?1b|work authorization)\b/i, "citizenship or visa status");
  scan(/\b(?:req(?:uisition)?\.?\s*(?:#|no\.?|id)\s*[:#]?\s*[A-Z0-9-]*\d{3,}|job\s*(?:id|#|number|no\.?)\s*[:#]?\s*[A-Z0-9-]*\d{2,}|\bR-?\d{5,}\b)/i, "a requisition or job number");
  scan(/\$\s?\d[\d,.]*\s?k?\b[^.\n]{0,25}\b(?:bonus|premium|salary|signing|compensation|stipend|per hour|\/\s?hr|an hour|hourly)\b|\b(?:bonus|premium|salary|stipend|pay rate) of \$\s?\d[\d,.]*/i, "a pay or premium amount");
  const telltale = new RegExp(`(?<![\\w-])(?:${AI_TELLTALES.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\w-])`, "i");
  scan(telltale, "a phrase that reads as machine-written");
  add(
    "no_banned_content",
    "No citizenship, job numbers, pay amounts, or machine phrases",
    "BLOCKING",
    banned.length ? fail(banned, `Remove ${[...new Set(bannedWhy)].join(", ")}. None of these belong on a resume.`) : pass("Nothing a resume shouldn't carry."),
  );

  // ── Formatting
  const empties = lines.filter((l) => l.kind === "bullet" && !bulletBody(l.text).trim()).map((l) => l.text);
  const emptySections = lines.filter((l, i) => l.kind === "heading" && (!lines[i + 1] || lines[i + 1].kind === "heading" || !lines[i + 1].text.trim())).map((l) => l.text.trim());
  const emptyFound = [...empties, ...emptySections].filter((q) => q.length > 0);
  add("no_empty_bullets_or_paragraphs", "No empty bullets or sections", "WARN", emptyFound.length ? fail(emptyFound, "There's an empty bullet or a heading with nothing under it.") : pass("No empty bullets or sections."));

  const boldProblems = lines
    .filter((l) => l.kind === "entry")
    .filter((l) => {
      const parts = l.text.split(" | ");
      const leadBold = /^\*\*[^*]+\*\*$/.test(parts[0].trim());
      const restBold = parts.slice(1).some((p) => p.includes("**"));
      return !leadBold || restBold;
    })
    .map((l) => l.text.trim());
  add("consistent_bold", "Titles bold; company and location plain", "WARN", boldProblems.length ? fail(boldProblems, "Bold only the job title. Keep the company and location plain.") : pass("Titles bold, company and location plain, everywhere."));

  const dupes: string[] = [];
  for (const line of lines.filter((l) => l.kind === "skills")) {
    const items = skillItems(line.text);
    const seen = new Map<string, string>();
    for (const item of items) {
      const key = item.toLowerCase().replace(/\s*\(.*\)$/, "");
      if (seen.has(key)) dupes.push(item);
      else seen.set(key, item);
      const doubled = item.match(/\b(\w+)\s+\1\b/i);
      if (doubled) dupes.push(doubled[0]);
    }
  }
  add("no_duplicate_words_in_skills", "No repeats in Skills", "WARN", dupes.length ? fail(dupes, "Skills lists the same thing twice.") : pass("Every skill appears once."));

  const DATE_FORMS: Array<[string, RegExp]> = [
    ["Mon YYYY", /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.? (?:19|20)\d{2}\b/g],
    ["Month YYYY", /\b(?:January|February|March|April|June|July|August|September|October|November|December) (?:19|20)\d{2}\b/g],
    ["MM/YYYY", /\b\d{1,2}\/(?:19|20)\d{2}\b/g],
    ["Season YYYY", /\b(?:Spring|Summer|Fall|Winter) (?:19|20)\d{2}\b/g],
  ];
  const forms = new Map<string, string>();
  for (const line of lines.filter((l) => l.kind === "entry" || (l.kind === "other" && /\d{4}/.test(l.text)) || l.text.includes("**"))) {
    for (const [name, pattern] of DATE_FORMS) for (const m of line.text.matchAll(pattern)) if (!forms.has(name)) forms.set(name, m[0]);
  }
  const formNames = [...forms.keys()];
  add(
    "consistent_date_format",
    "One date format",
    "WARN",
    formNames.length > 1 ? fail(formNames.slice(1).map((n) => forms.get(n)!), `Dates mix ${formNames.join(" and ")}. Pick one.`) : pass(formNames.length ? `Dates all use ${formNames[0]}.` : "No dates to compare."),
  );

  const spacing: string[] = [];
  for (const line of lines) {
    const double = line.text.match(/\S+ {2,}\S+/);
    if (double) spacing.push(double[0]);
    else if (/\S[ \t]+$/.test(line.text)) spacing.push(line.text.trimStart());
  }
  add("no_trailing_or_double_spaces", "No stray spaces", "WARN", spacing.length ? fail(spacing, "There's a double space or a space at the end of a line.") : pass("No double or trailing spaces."));

  const headings = lines.filter((l) => l.kind === "heading").map((l) => l.text.trim());
  const has = (pattern: RegExp) => headings.some((h) => pattern.test(h));
  const missing = [
    has(/EDUCATION/) ? null : "EDUCATION",
    has(/EXPERIENCE|EMPLOYMENT|WORK|LEADERSHIP|ACTIVITIES/) ? null : "EXPERIENCE",
    has(/SKILL/) ? null : "SKILLS",
  ].filter((x): x is string => Boolean(x));
  const blendedHeading = lines.filter((l) => l.kind === "other" && /^(education|experience|projects|skills)\s*:?\s*$/i.test(l.text.trim())).map((l) => l.text.trim());
  add(
    "section_headers_present",
    "Standard section headings",
    "WARN",
    blendedHeading.length
      ? fail(blendedHeading, "A section heading isn't set apart. Headings should stand alone in capitals.")
      : missing.length && headings.length
        ? fail([headings[0]], `Missing ${missing.join(" and ")}. Sections found start with this one.`)
        : pass(`Sections: ${headings.join(", ") || "none"}.`),
  );

  const contact = lines.find((l) => l.kind === "contact")?.text ?? "";
  const hasEmail = /\S+@\S+\.\S+/.test(contact);
  const hasPhone = contact.split("|").some((part) => {
    const digits = part.replace(/\D/g, "");
    return /^[+()\d\s.-]+$/.test(part.trim()) && digits.length >= 10 && digits.length <= 15;
  });
  const contactMissing = [hasEmail ? null : "email", hasPhone ? null : "phone"].filter(Boolean);
  add(
    "contact_info_complete",
    "Email and phone at the top",
    "WARN",
    contactMissing.length && contact.trim() ? fail([contact.trim()], `Your contact line has no ${contactMissing.join(" or ")}. Add it in onboarding details or Settings.`) : pass(contact.trim() ? "Email and phone are there." : "No contact line to check."),
  );

  // ── Voice
  const contraction = resumeText.match(CONTRACTIONS);
  const expanded = resumeText.match(EXPANDED);
  add(
    "contractions_consistent",
    "Contractions used consistently",
    "WARN",
    contraction && expanded ? fail([contraction[0], expanded[0]], `Mixes "${contraction[0]}" with "${expanded[0]}". Pick one style.`) : pass("Consistent."),
  );

  const filler = new RegExp(`(?<![\\w-])(?:${CORPORATE_FILLER.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\w-])`, "gi");
  const fillerFound = [...new Set([...stripBold(resumeText).matchAll(filler)].map((m) => m[0]))];
  add("no_corporate_filler", "No corporate filler", "WARN", fillerFound.length ? fail(fillerFound, `Filler words: ${fillerFound.join(", ")}. Show it with a result instead.`) : pass("No filler words."));

  return enforceQuotes(checks, resumeText);
}

/** A failure that can't quote the resume verbatim becomes a pass. Quotes that don't appear are dropped. */
export function enforceQuotes(checks: LintCheck[], resumeText: string): LintCheck[] {
  return checks.map((check) => {
    if (check.passed) return check;
    const failures = check.failures.filter((q) => q && resumeText.includes(q));
    if (!failures.length) return { ...check, passed: true, evidence_quote: "", failures: [], detail: `${check.detail} (No exact text to quote, so this passes.)` };
    return { ...check, evidence_quote: failures[0], failures };
  });
}

export function blockingFailures(checks: LintCheck[]): LintCheck[] {
  return checks.filter((c) => c.severity === "BLOCKING" && !c.passed);
}
