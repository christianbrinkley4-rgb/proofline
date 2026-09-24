/**
 * Voice rules for everything Proofline writes or ships: marketing copy now,
 * generated bullets, cover letters, and emails later. The export quality gate
 * runs these same checks, so there is one definition of "sounds human".
 */

/** Words and phrases that read as corporate filler or AI slop. Matched case-insensitively on word boundaries. */
export const BANNED_PHRASES = [
  "leverage",
  "leverages",
  "leveraged",
  "leveraging",
  "synergy",
  "synergies",
  "passionate self-starter",
  "self-starter",
  "supercharge",
  "supercharged",
  "unlock",
  "unlocks",
  "unlocked",
  "unlocking",
  "elevate",
  "elevates",
  "elevated",
  "elevating",
  "delve",
  "delves",
  "delving",
  "game-changer",
  "game changer",
  "game-changing",
  "cutting-edge",
  "seamless",
  "seamlessly",
  "revolutionize",
  "revolutionizes",
  "empower",
  "empowers",
  "empowering",
  "harness the power",
  "next-level",
  "world-class",
  "best-in-class",
  "results-driven",
  "in today's fast-paced",
  "tapestry",
  "testament to",
  // Resume buzzwords recruiters name as their top frustration. Show it with a result instead.
  "results-oriented",
  "detail-oriented",
  "team player",
  "think outside the box",
  "outside-the-box",
  "proven track record",
  "hard-working",
  "hardworking",
  "go-getter",
  "go-to person",
  "highly motivated",
] as const;

/** Openers that make a bullet sound passive or vague. A bullet must not start with any of these. */
export const WEAK_OPENERS = [
  "ran",
  "made",
  "turn",
  "turned",
  "sat in",
  "helped",
  "worked on",
  "did",
  "was responsible for",
  "responsible for",
  "tasked with",
  "assisted with",
  "participated in",
  "handled",
  "got",
] as const;

export type VoiceRule = "em-dash" | "banned-phrase";

export type VoiceIssue = {
  rule: VoiceRule;
  match: string;
  index: number;
};

const EM_DASH = "—";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const bannedPattern = new RegExp(
  `(?<![\\w-])(${BANNED_PHRASES.map(escapeRegExp).join("|")})(?![\\w-])`,
  "gi",
);

/** Every em dash and banned phrase in `text`, in order of appearance. */
export function findVoiceIssues(text: string): VoiceIssue[] {
  const issues: VoiceIssue[] = [];

  for (let i = text.indexOf(EM_DASH); i !== -1; i = text.indexOf(EM_DASH, i + 1)) {
    issues.push({ rule: "em-dash", match: EM_DASH, index: i });
  }

  for (const m of text.matchAll(bannedPattern)) {
    issues.push({ rule: "banned-phrase", match: m[0], index: m.index });
  }

  return issues.sort((a, b) => a.index - b.index);
}

/** The weak opener a bullet starts with, or null if it opens with an acceptable verb. */
export function findWeakOpener(bullet: string): string | null {
  const normalized = bullet.trim().toLowerCase();
  for (const opener of WEAK_OPENERS) {
    if (normalized === opener || normalized.startsWith(`${opener} `)) {
      return opener;
    }
  }
  return null;
}
