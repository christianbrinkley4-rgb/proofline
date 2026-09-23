import { normalizeDate } from "@/lib/resume/parse/dates";
import { extractSkills } from "./skills";

/**
 * What a posting asks for, read from its text with rules. Cached on the job row,
 * so every student scored against the same posting reuses the work.
 */
export type Requirements = {
  required: string[];
  preferred: string[];
  /** Skills grouped by requirement line: "Power BI or Tableau" is one requirement either skill meets. */
  requiredGroups: string[][];
  preferredGroups: string[][];
  /** All skills mentioned anywhere, for keyword overlap. */
  mentioned: string[];
  degreeFields: string[];
  minGpa: number | null;
  /** Graduation dates the posting accepts, as YYYY-MM bounds. */
  gradWindow: { from: string | null; to: string | null; text: string } | null;
  yearsExperience: number | null;
  noSponsorship: boolean;
  licensesRequired: string[];
  requiredLines: string[];
  preferredLines: string[];
};

const REQUIRED_HEADING =
  /^(requirements?|qualifications?|minimum qualifications|basic qualifications|required qualifications|what you('ll)? (need|bring)|what we('re)? looking for|who you are|you (have|bring|are)|must[- ]haves?|skills (and|&) experience|about you|your background)\b/i;
const PREFERRED_HEADING = /^(preferred( qualifications)?|nice[- ]to[- ]haves?|bonus( points)?|pluses|it'?s a plus|ideally|preferred skills|extra credit)\b/i;
const OTHER_HEADING = /^(responsibilities|what you('ll)? do|the role|about (the role|us|the team)|benefits|perks|compensation|pay|salary|why (join|us)|our (team|company)|equal opportunity|eeo)\b/i;

const FIELDS = [
  "accounting", "finance", "economics", "business administration", "business", "computer science", "information systems",
  "engineering", "mathematics", "math", "statistics", "data science", "marketing", "communications", "supply chain",
  "management", "physics", "public health", "political science",
];

export function parseRequirements(description: string | null | undefined): Requirements {
  const text = description ?? "";
  const lines = text.split("\n").map((l) => l.replace(/^[•\-*·]\s*/, "").trim()).filter(Boolean);

  const requiredLines: string[] = [];
  const preferredLines: string[] = [];
  let mode: "required" | "preferred" | "other" | null = null;
  for (const line of lines) {
    const short = line.length < 70 && !/[.;]\s*\w/.test(line);
    const head = line.replace(/[:\s]+$/, "");
    if (short && PREFERRED_HEADING.test(head)) mode = "preferred";
    else if (short && REQUIRED_HEADING.test(head)) mode = "required";
    else if (short && OTHER_HEADING.test(head)) mode = "other";
    else if (mode === "required") requiredLines.push(line);
    else if (mode === "preferred") preferredLines.push(line);
    else if (/\b(preferred|a plus|nice to have|bonus)\b/i.test(line)) preferredLines.push(line);
    else if (/\b(required|must have|must be|minimum of|you have)\b/i.test(line)) requiredLines.push(line);
  }

  const requiredText = requiredLines.join("\n");
  const preferredText = preferredLines.join("\n");
  const mentioned = extractSkills(text);
  const preferred = extractSkills(preferredText);
  let required = extractSkills(requiredText).filter((sk) => !preferred.includes(sk) || extractSkills(requiredText).includes(sk));
  // No requirement section? Treat skills in the whole posting as required, minus anything marked preferred.
  if (!requiredLines.length) required = mentioned.filter((sk) => !preferred.includes(sk));

  const lower = text.toLowerCase();
  const gpa = lower.match(/(?:minimum|min\.?|at least)?\s*(?:cumulative\s+)?(?:gpa|grade point average)\s*(?:of|:)?\s*(?:at least\s*)?([2-4]\.\d{1,2})/) ?? lower.match(/([2-4]\.\d{1,2})\s*(?:\/\s*4\.0\s*)?(?:cumulative\s+)?gpa/);

  const years = requiredText.toLowerCase().match(/(\d+)\+?\s*(?:-\s*\d+\s*)?years?(?:'| of)?[^.\n]{0,40}\b(experience|work)/);

  const noSponsorship =
    /(not|unable to|will not|won'?t|cannot|can'?t|does not|do not)\s+(provide|offer|sponsor|support)[^.\n]{0,40}(sponsorship|visa|h-?1b)/i.test(text) ||
    /without (the need for |requiring )?(current or future |now or in the future )?(employer |visa )?sponsorship/i.test(text) ||
    /(no|not eligible for) (visa )?sponsorship/i.test(text);

  const licensesRequired: string[] = [];
  if (/\b(active|current|valid|licensed)\s+cpa\b|\bcpa (license|licensure|certification) (is )?(required|must)|\bmust (hold|have|possess) (a|an|the|your)?\s*cpa\b/i.test(text)) {
    licensesRequired.push("CPA");
  }
  if (/\b(series (7|63|65|66|79))\b[^.\n]{0,60}(required|must)/i.test(text)) licensesRequired.push("FINRA license");

  const degreeFields = FIELDS.filter((f) =>
    new RegExp(`(degree|major|majoring|pursuing|studying|bachelor'?s?|b\\.?s\\.?|b\\.?a\\.?)[^.\\n]{0,80}\\b${f}\\b|\\b${f}\\b[^.\\n]{0,30}(degree|major)`, "i").test(text),
  ).filter((f, _, all) => !(f === "business" && all.includes("business administration")) && !(f === "math" && all.includes("mathematics")));

  // "Power BI or Tableau" is one requirement either skill meets; "reconciliations and journal entries" is two.
  const groupsOf = (source: string[]) =>
    source.flatMap((line) => {
      const skills = extractSkills(line);
      if (!skills.length) return [];
      return /\bor\b|\//i.test(line) ? [skills] : skills.map((sk) => [sk]);
    });
  const preferredGroups = groupsOf(preferredLines);
  const requiredGroups = requiredLines.length ? groupsOf(requiredLines) : required.map((sk) => [sk]);

  return {
    required,
    preferred,
    requiredGroups,
    preferredGroups,
    mentioned,
    degreeFields,
    minGpa: gpa ? Number(gpa[1]) : null,
    gradWindow: parseGradWindow(text),
    yearsExperience: years ? Number(years[1]) : null,
    noSponsorship,
    licensesRequired,
    requiredLines: requiredLines.slice(0, 20),
    preferredLines: preferredLines.slice(0, 12),
  };
}

const MONTH = "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|spring|summer|fall|winter)";
const DATE = `(?:${MONTH}\\.?\\s+)?20\\d{2}`;

/** "graduating between December 2026 and June 2027", "Class of 2027", "expected graduation in 2027". */
export function parseGradWindow(text: string): Requirements["gradWindow"] {
  const between = text.match(new RegExp(`graduat\\w*[^.\\n]{0,40}?(?:between|from)\\s+(${DATE})\\s*(?:and|to|-|–|through)\\s*(${DATE})`, "i"));
  if (between) return { from: toMonth(between[1], "start"), to: toMonth(between[2], "end"), text: between[0] };
  const classOf = text.match(/class of (20\d{2})/i) ?? text.match(new RegExp(`(?:expected|anticipated)?\\s*graduation (?:date )?(?:in|of|by|:)?\\s*(${DATE})`, "i")) ?? text.match(new RegExp(`graduating (?:in )?(${DATE})`, "i"));
  if (classOf) {
    const raw = classOf[1];
    return /^20\d{2}$/.test(raw.trim())
      ? { from: `${raw.trim()}-01`, to: `${raw.trim()}-12`, text: classOf[0] }
      : { from: toMonth(raw, "start"), to: toMonth(raw, "end"), text: classOf[0] };
  }
  return null;
}

function toMonth(raw: string, edge: "start" | "end"): string | null {
  const clean = raw.trim().replace(/\./g, "");
  if (/^20\d{2}$/.test(clean)) return edge === "start" ? `${clean}-01` : `${clean}-12`;
  return normalizeDate(clean.replace(/^(\w{3})\w*/, "$1"));
}
