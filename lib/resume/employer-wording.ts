import { extractSkills, SKILLS } from "@/lib/fit/skills";
import { normalizePhrase } from "@/lib/jobs/keywords";

/** The posting's own wording for a skill the person confirmed, when it names the very same thing. */
export function employerWording(item: string, jobDescription: string): string | null {
  const canonical = extractSkills(item);
  if (canonical.length !== 1) return null;
  const def = SKILLS.find((s) => s.name === canonical[0]);
  if (!def) return null;
  // Same words, different case, plural, or hyphenation: use the posting's form.
  const words = item.trim().split(/[\s-]+/).map((w) => `${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:e?s)?`);
  const same = jobDescription.match(new RegExp(`(?<![a-z0-9])${words.join("[\\s-]+")}(?![a-z0-9])`, "i"))?.[0];
  if (same && normalizePhrase(same).replace(/-/g, " ") === normalizePhrase(item).replace(/-/g, " ")) {
    // Their plural or hyphenation, in the person's capitalization, so the list reads as one style.
    const mine = item.trim().split(/[\s-]+/);
    let index = 0;
    const theirs = same.replace(/[^\s-]+/g, (word) => {
      const cased = mine[index++] ?? word;
      if (/^[A-Z0-9/&]+$/.test(word) && word.length > 1) return word;
      // Same word, maybe plural: keep the person's exact capitals ("QuickBooks", not "Quickbooks").
      if (word.toLowerCase().startsWith(cased.toLowerCase())) return cased + word.slice(cased.length).toLowerCase();
      return cased[0] === cased[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase();
    });
    return theirs !== item.trim() ? theirs : null;
  }
  // The posting's acronym for the same skill: keep the full name, add theirs.
  for (const pattern of def.patterns) {
    const found = jobDescription.match(pattern)?.[0]?.trim();
    if (found && /^[A-Z/&]{2,5}$/.test(found) && !item.includes(found)) return `${item} (${found})`;
  }
  return null;
}
