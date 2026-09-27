import { findVoiceIssues, findWeakOpener } from "@/lib/voice/rules";
import { repeatedOpeners } from "./bullet-score";
import type { Requirements } from "@/lib/fit/requirements";
import { documentBullets, type ResumeDocument } from "./document";
import { hasNumber, presentTenseOpener, proofread, repeatedSkills, roleEnded, skillName } from "./polish";
import { screeningReport } from "./screening";
import type { LayoutResult } from "./layout";
import { verifyBullet } from "./verify";

/**
 * The export quality gate. Factual failures block export; style issues warn.
 * The same checks run on the live preview and right before a file is built.
 */
export type QualityCheck = {
  id: "facts" | "substance" | "depth" | "one-page" | "em-dash" | "openers" | "repeats" | "filler" | "pronouns" | "contact" | "numbers" | "tense" | "proofread" | "requirements";
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  blocking: boolean;
};

const PRONOUNS = /\b(i|me|my|we|our|us)\b/i;

export function runQualityGate(
  doc: ResumeDocument,
  layout: LayoutResult,
  facts: Map<string, string>,
  activeBulletIds: Set<string>,
  /** The posting's requirements, for a resume tailored to a job. */
  requirements?: Requirements | null,
): QualityCheck[] {
  const bullets = documentBullets(doc);
  const allText = [doc.header.name, ...bullets.map((b) => b.text)].join("\n");

  const unverified = bullets.filter((b) => {
    if (!activeBulletIds.has(b.id) || !b.factIds.length || b.factIds.some((id) => !facts.has(id))) return true;
    const cited = b.factIds.map((id) => facts.get(id)).filter((t): t is string => Boolean(t));
    return !verifyBullet(b.text, cited).ok;
  });
  const missingSources = (doc.sourceFactIds ?? []).filter((id) => !facts.has(id));
  const weak = bullets.map((b) => findWeakOpener(b.text)).filter(Boolean);
  const repeats = repeatedOpeners(bullets.map((b) => b.text));
  const voice = findVoiceIssues(allText);
  const dashes = voice.filter((v) => v.rule === "em-dash").length;
  const filler = [...new Set(voice.filter((v) => v.rule === "banned-phrase").map((v) => v.match.toLowerCase()))];
  const pronouns = bullets.filter((b) => PRONOUNS.test(b.text));

  // Career-center top mistakes: missing contact details, duties without results, mixed tense, typos.
  const contactItems = doc.header.contact;
  const hasPhone = contactItems.some((item) => {
    if (/@|https?:\/\/|www\./i.test(item) || !/^[+()\d\s.-]+$/.test(item.trim())) return false;
    const digits = item.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  });
  const missingContact = [
    ...(contactItems.some((item) => /@/.test(item)) ? [] : ["email"]),
    ...(hasPhone ? [] : ["phone"]),
  ];
  const measured = bullets.filter((b) => hasNumber(b.text)).length;
  const wrongTense = doc.sections.flatMap((s) =>
    s.kind === "entries" ? s.entries.filter((e) => roleEnded(e.dates)).flatMap((e) => e.bullets.map((b) => presentTenseOpener(b.text)).filter((w): w is string => Boolean(w))) : [],
  );
  const skillItems = doc.sections.flatMap((s) => (s.kind === "skills" ? s.lines.flatMap((l) => l.items) : []));
  const twice = repeatedSkills(skillItems, skillName);
  const typos = [...new Set([...bullets.flatMap((b) => proofread(b.text)), ...twice.map((s) => `${s.replace(/\s*\(.*$/, "")} listed twice in Skills`)])];
  const screen = requirements ? screeningReport(doc, requirements) : null;

  return [
    {
      id: "facts",
      label: "Source facts are confirmed",
      status: unverified.length || missingSources.length ? "fail" : "pass",
      detail: missingSources.length
        ? "A skill, award, certification, or course no longer has a confirmed source. Create a new version from your current profile."
        : unverified.length
        ? `${unverified.length} ${unverified.length === 1 ? "line has" : "lines have"} a claim you haven't confirmed. Confirm or remove it to export.`
        : `All ${bullets.length} bullets trace back to facts you confirmed.`,
      blocking: true,
    },
    {
      id: "substance",
      label: "Shows at least one confirmed work or project example",
      status: bullets.length ? "pass" : "fail",
      detail: bullets.length
        ? `${bullets.length} confirmed ${bullets.length === 1 ? "example" : "examples"} on this resume.`
        : "Add one real task from work, school, volunteering, or a project to your profile before exporting.",
      blocking: true,
    },
    {
      id: "depth",
      label: "Enough evidence to tell your story",
      status: bullets.length < 3 ? "warn" : "pass",
      detail: bullets.length < 3
        ? `This version has ${bullets.length} ${bullets.length === 1 ? "bullet" : "bullets"} and leaves most of the page empty. Add a real project, responsibility, or result to your profile, then make a new version.`
        : `${bullets.length} confirmed examples give the reader more to assess.`,
      blocking: false,
    },
    {
      id: "one-page",
      label: "Fits on one page",
      status: layout.overflow ? "fail" : "pass",
      detail: layout.overflow ? "Runs past one page." : `About ${Math.max(0, layout.remaining / 72).toFixed(1)} in of room left at the bottom.`,
      blocking: true,
    },
    {
      id: "openers",
      label: "Strong opening verbs",
      status: weak.length ? "warn" : "pass",
      detail: weak.length ? `Rewrite bullets that start with ${[...new Set(weak)].join(", ")}. Name the specific action and a result you can verify.` : "Every bullet opens with an action verb.",
      blocking: false,
    },
    {
      id: "repeats",
      label: "Varied verbs",
      status: repeats.length ? "warn" : "pass",
      detail: repeats.length ? `Used more than twice: ${repeats.join(", ")}.` : "No verb opens more than two bullets.",
      blocking: false,
    },
    {
      id: "em-dash",
      label: "No em dashes",
      status: dashes ? "warn" : "pass",
      detail: dashes ? `Found ${dashes}.` : "Checked every line.",
      blocking: false,
    },
    {
      id: "filler",
      label: "Plain language",
      status: filler.length ? "warn" : "pass",
      detail: filler.length ? `Filler words: ${filler.join(", ")}.` : "No filler words or buzzwords.",
      blocking: false,
    },
    {
      id: "contact",
      label: "Email and phone at the top",
      status: missingContact.length ? "warn" : "pass",
      detail: missingContact.length
        ? `Missing ${missingContact.join(", ")}. Add ${missingContact.length === 1 ? "it" : "them"} under About you on your profile.`
        : "Recruiters have your email and phone.",
      blocking: false,
    },
    {
      id: "numbers",
      label: "Results you can count",
      status: bullets.length && measured / bullets.length < 0.5 ? "warn" : "pass",
      detail: bullets.length
        ? `${measured} of ${bullets.length} bullets include a number.${measured / bullets.length < 0.5 ? " Answer the number questions on your profile to strengthen the rest." : ""}`
        : "No bullets yet.",
      blocking: false,
    },
    {
      id: "tense",
      label: "Consistent tense",
      status: wrongTense.length ? "warn" : "pass",
      detail: wrongTense.length ? `Past roles should use past tense: ${[...new Set(wrongTense)].join(", ")}.` : "Past roles in past tense throughout.",
      blocking: false,
    },
    {
      id: "proofread",
      label: "Proofread",
      status: typos.length ? "warn" : "pass",
      detail: typos.length ? `Found ${typos.join("; ")}.` : "No doubled words, stray spaces, or lowercase starts.",
      blocking: false,
    },
    ...(screen && screen.totalRequired
      ? [
          {
            id: "requirements" as const,
            label: "Shows what the posting requires",
            status: (screen.notShown.length ? "warn" : "pass") as QualityCheck["status"],
            detail: screen.notShown.length
              ? `${screen.coveredRequired} of ${screen.totalRequired} requirements are on the page. Not shown: ${screen.notShown.slice(0, 3).join(", ")}. Close the gaps on the job page if you've done them.`
              : `All ${screen.totalRequired} requirements are on the page.`,
            blocking: false,
          },
        ]
      : []),
    {
      id: "pronouns",
      label: "No pronouns",
      status: pronouns.length ? "warn" : "pass",
      detail: pronouns.length ? `${pronouns.length} ${pronouns.length === 1 ? "bullet uses" : "bullets use"} I, my, or we.` : "No I, my, or we.",
      blocking: false,
    },
  ];
}

export function exportBlocked(checks: QualityCheck[]): boolean {
  return checks.some((c) => c.blocking && c.status === "fail");
}
