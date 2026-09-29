import { nearDuplicate } from "./suggest";

const STOP = new Set("a an and at by each every for from in into of on or per the to with using through my our i we count amount frequency percent percentage day daily week weekly month monthly year yearly annually hour hourly quarter quarterly about approximately roughly more fewer result change".split(" "));
const EQUIVALENTS: Record<string, string> = {
  booked: "scheduled", booking: "scheduling", book: "schedule",
  wrote: "write", written: "write", built: "build", sold: "sell", sent: "send", led: "lead",
  kept: "keep", took: "take", taught: "teach", bought: "buy", grew: "grow",
  telephones: "calls", telephone: "calls", phones: "calls", phone: "calls",
  clients: "customers", client: "customer", guests: "visitors", guest: "visitor",
};

/** Compare the work itself, ignoring tense, quantities, and blank draft cues. */
export function workWords(text: string): string {
  return (text.replace(/\[[^\]]*\]/g, " ").toLowerCase().match(/[a-z]+/g) ?? [])
    .filter((word) => !STOP.has(word))
    .map((word) => Object.hasOwn(EQUIVALENTS, word) ? EQUIVALENTS[word] : word)
    .map((word) => word.replace(/(?:ies|ied)$/, "y").replace(/(?:ing|ed)$/, "").replace(/([^s])s$/, "$1").replace(/([a-z])\1$/, "$1").replace(/e$/, ""))
    .join(" ");
}

export function sameRecallWork(a: string, b: string): boolean {
  const left = workWords(a);
  const right = workWords(b);
  if (nearDuplicate(left, right)) return true;
  // Broad task cues such as "recorded accounting information" can already be
  // covered by a specific saved example. Keep the action and subject together:
  // shared verbs alone must never hide a different activity.
  const abstract = new Set(["information", "softwar", "tool", "method", "detail", "task", "work"]);
  const core = (text: string) => new Set(text.split(" ").filter((word) => word && !abstract.has(word)));
  if (left.split(" ")[0] !== right.split(" ")[0]) return false;
  const l = core(left), r = core(right);
  const shorter = l.size <= r.size ? l : r;
  const longer = l.size <= r.size ? r : l;
  return shorter.size >= 2 && [...shorter].every((word) => longer.has(word));
}

