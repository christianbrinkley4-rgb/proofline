import { findVoiceIssues, findWeakOpener } from "@/lib/voice/rules";
import { repeatedOpeners } from "./bullet-score";
import { documentBullets, type ResumeDocument } from "./document";
import type { LayoutResult } from "./layout";
import { verifyBullet } from "./verify";

/**
 * The export quality gate. Factual failures block export; style issues warn.
 * The same checks run on the live preview and right before a file is built.
 */
export type QualityCheck = {
  id: "facts" | "one-page" | "em-dash" | "openers" | "repeats" | "filler" | "pronouns";
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
      detail: weak.length ? `Weak openers: ${[...new Set(weak)].join(", ")}.` : "Every bullet opens with an action verb.",
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
