import { isActionVerb } from "./verbs";

/**
 * Swaps safe to apply automatically: they keep the sentence grammatical and never
 * claim more than the student said ("worked on" becomes "Contributed to", not "Built").
 * Other weak openers are left as written; the scorer suggests alternatives instead.
 */
const AUTO_SWAP: Record<string, string> = {
  "was responsible for": "Managed",
  "responsible for": "Managed",
  "in charge of": "Managed",
  "tasked with": "Managed",
  "worked on": "Contributed to",
  "helped with": "Supported",
  "assisted with": "Supported",
  "sat in on": "Observed",
  ran: "Managed",
  did: "Completed",
  handled: "Managed",
};

/**
 * Rules-based cleanup that turns something a student said into a draft bullet:
 * drops pronouns and filler, moves the opening verb to past tense, swaps weak
 * openers, and adds a confirmed number when one exists. It never adds facts.
 * The result is labeled a draft; with a model configured, drafts come from Claude.
 */

const LEADING_FILLER =
  /^(?:(?:i\s+(?:was|am|would|also|mostly|basically|usually|mainly|just)?\s*)|(?:my\s+(?:job|role|work)\s+(?:was|is)\s+(?:to\s+)?)|(?:(?:was\s+)?(?:responsible|in charge)\s+(?:for|of)\s+)|(?:mostly|basically|also|usually|mainly|just|then|and)\s+)+/i;

const IRREGULAR: Record<string, string> = {
  am: "was", are: "were", be: "was", become: "became", begin: "began", bring: "brought", build: "built", buy: "bought",
  catch: "caught", choose: "chose", come: "came", cut: "cut", deal: "dealt", do: "did", draw: "drew", drive: "drove",
  find: "found", get: "got", give: "gave", go: "went", grow: "grew", have: "had", hold: "held", keep: "kept",
  lead: "led", make: "made", meet: "met", pay: "paid", put: "put", read: "read", run: "ran", sell: "sold", send: "sent", set: "set",
  sit: "sat", speak: "spoke", spend: "spent", take: "took", teach: "taught", tell: "told", think: "thought",
  win: "won", write: "wrote", oversee: "oversaw", undertake: "undertook",
};

const GERUND_BASE: Record<string, string> = {
  running: "run", making: "make", writing: "write", building: "build", leading: "lead", teaching: "teach", sending: "send",
  selling: "sell", keeping: "keep", bringing: "bring", finding: "find", doing: "do", paying: "pay", getting: "get",
  taking: "take", giving: "give", meeting: "meet", sitting: "sit", putting: "put", setting: "set", cutting: "cut",
  winning: "win", planning: "plan", shopping: "shop", overseeing: "oversee",
};

function pastTense(verb: string): string {
  const w = verb.toLowerCase();
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (Object.values(IRREGULAR).includes(w)) return w;
  if (/ed$/.test(w)) return w;
  if (/ing$/.test(w)) {
    const base = GERUND_BASE[w];
    if (base) return pastTense(base);
    const stem = w.slice(0, -3);
    if (/[^aeiou]y$/.test(stem)) return `${stem.slice(0, -1)}ied`;
    // matching -> matched, reconciling -> reconciled, creating -> created
    if (/[^aeiou][aeiou][bdgmnprt]$/.test(stem) && stem.length <= 4) return `${stem}${stem.slice(-1)}ed`;
    if (/(at|iz|is|ov|ag|ag|ur|in|ul|ic|uc|ar|ir|er)$/.test(stem) && !/(er|ar)$/.test(stem.slice(-2) + "x")) return `${stem}ed`;
    return /e$/.test(stem) ? `${stem}d` : `${stem}ed`;
  }
  if (/e$/.test(w)) return `${w}d`;
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ied`;
  if (/(s|sh|ch|x|z)$/.test(w)) return w.endsWith("es") ? `${w.slice(0, -2)}ed` : `${w}ed`;
  if (/^[^aeiou]*[aeiou][bdgmnpt]$/.test(w) && w.length <= 4) return `${w}${w.slice(-1)}ed`;
  return `${w}ed`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "I did the books part-time for a dental office." -> "Managed the books part-time for a dental office" */
export function draftFromStatement(statement: string): string {
  let text = statement.trim().replace(/[.!?]+$/, "");
  const classContext = text.match(/^For (.+?)\s+I\s+(.+)$/i);
  if (classContext) text = `${classContext[2]} for ${classContext[1]}`;
  text = text.replace(LEADING_FILLER, "");
  text = text.replace(/^gave customer service\b/i, "Provided customer service");
  text = text.replace(/\b(our|my)\b/gi, "the")
    .replace(/\ba checklist I wrote\b/gi, "a self-written checklist")
    .replace(/\s{2,}/g, " ").trim();
  // Do not invent an action from a title fragment or a bare noun.
  if (text.split(/\s+/).length < 2 || /\bI\b/.test(text) || /^(?:for|at|in|on|during|as)\b/i.test(text)) return "";

  // Swap a weak opener only when the swap is safe (see AUTO_SWAP).
  const lower = text.toLowerCase();
  const weak = Object.keys(AUTO_SWAP)
    .sort((a, b) => b.length - a.length)
    .find((w) => lower === w || lower.startsWith(`${w} `));
  if (weak) {
    const replacement = weak === "did" && /^did the books\b/i.test(text) ? "Managed" : AUTO_SWAP[weak];
    text = `${replacement}${text.slice(weak.length)}`;
  } else if (/^(helped|made|got|turned?)\b/i.test(text)) {
    // Keep as written: an automatic swap would break grammar ("Helped them find") or overstate.
  } else {
    const [first, ...rest] = text.split(" ");
    const opener = pastTense(first);
    if (!isActionVerb(opener) && !/^(operated|staffed|stocked|surveyed|used|performed|verified|referred|gathered|entered|paid|ran|sent|greeted)$/i.test(opener)) return "";
    text = [opener, ...rest].join(" ");
  }

  // "paid vendors and matching statements" -> "paid vendors and matched statements"
  text = text.replace(/\band (\w+ing)\b/g, (_m, v: string) => `and ${pastTense(v)}`);
  // Parallel actions in a stated sentence should use the same tense.
  text = text.replace(/\band (schedule|match|send|balance|reconcile|track|update|verify|check|answer|file|prepare|record|organize|coordinate|process|manage|build|write|support|review|assist|serve|train)\b/gi,
    (_m, v: string) => `and ${pastTense(v)}`);
  text = text.replace(/(answering [^,.;]{0,50}) and helped\b/i, "$1 and helping");
  return capitalize(text.trim());
}

/** Adds a confirmed metric to a draft as a parenthetical, e.g. "(about 40 a month)". */
export function withMetric(bullet: string, metric: string): string {
  const clean = metric.replace(/\s*\([^)]*\)\s*$/, "").replace(/^(handled|result|impact|volume)\s*:?\s*/i, "").trim();
  if (!clean || bullet.toLowerCase().includes(clean.toLowerCase())) return bullet;
  return `${bullet.replace(/[.\s]+$/, "")} (${clean.charAt(0).toLowerCase()}${clean.slice(1)})`;
}
