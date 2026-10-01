import { z } from "zod";
import { logLlmCall } from "@/lib/llm/log";
import { ModelQuotaError, reserveModelCredits } from "@/lib/llm/quota";
import { numbersIn } from "@/lib/resume/verify";

/**
 * The review gate's one model call: a cheap Gemini Flash-Lite class model, keyed
 * by PROOFLINE_REVIEW_KEY (the only model key in the private beta). It runs only
 * after every blocking linter check passes, costs one credit against the
 * per-account daily cap, and never throws: every failure becomes a status the
 * UI can show while the linter results stay on screen.
 */

export const REVIEW_PROMPT_VERSION = "review-gate.v1";
export const DEFAULT_REVIEW_MODEL = "gemini-3.5-flash-lite";

export const REVIEW_SYSTEM_PROMPT = `You are the last reviewer before a student downloads a resume for one specific job.

The bar: it reads like a first-round interview candidate at a top firm: one page, every bullet leads with a quantified result and says how, tailored to this employer, human voice, zero filler.

How to review:
1. Before flagging any claim as invented, search the ENTIRE facts list and quote the closest supporting line. Only flag a claim if zero supporting language exists anywhere in the facts.
2. Prove support, don't hunt guilt. PASS if all bullets have support.
3. You may NOT fail for: contractions, date abbreviations, style preferences between two truthful wordings, anything you cannot quote verbatim from the resume, or corrections that add new claims, numbers, or methods the user never confirmed.
4. You may fail for: a claim with no supporting language in the facts; a bullet that leaves out a number or method the facts already contain; filler or wording that reads as machine-written; a line that ignores what this employer asks for when the facts would allow a truthful, closer match.
5. Every issue must copy the offending resume text exactly, character for character, into "quote"; name the rule it breaks in "rule_broken"; and give a "fix" that uses only the confirmed facts.

Return strict JSON and nothing else: {"verdict":"PASS"|"FAIL","issues":[{"quote":"...","rule_broken":"...","fix":"..."}]}. PASS means "issues" is an empty array. No prose outside the JSON.`;

export type ModelIssue = { quote: string; rule_broken: string; fix: string };
export type ModelReviewStatus = "pass" | "fail" | "unavailable" | "limit" | "error" | "skipped";
export type ModelReview = { status: ModelReviewStatus; issues: ModelIssue[]; model: string | null; message: string };

export const Output = z.object({
  verdict: z.enum(["PASS", "FAIL"]),
  issues: z.array(z.object({ quote: z.string(), rule_broken: z.string(), fix: z.string() })).max(20),
});

/** Gemini's response schema, so the model returns the JSON shape and nothing else. */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: ["PASS", "FAIL"] },
    issues: {
      type: "ARRAY",
      items: { type: "OBJECT", properties: { quote: { type: "STRING" }, rule_broken: { type: "STRING" }, fix: { type: "STRING" } }, required: ["quote", "rule_broken", "fix"] },
    },
  },
  required: ["verdict", "issues"],
};

export function reviewConfigured(): boolean {
  return Boolean(process.env.PROOFLINE_REVIEW_KEY?.trim());
}

/** Keeps the whole prompt near 4k tokens: about 4 characters a token, system prompt included. */
const BUDGET = { requirements: 2400, resume: 4600, facts: 6000 };
const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max).trimEnd()}\n[cut to fit the review budget]`);

export function buildReviewInput(input: { requirements: string; resumeText: string; facts: string[] }): string {
  const facts: string[] = [];
  let used = 0;
  for (const [i, fact] of input.facts.entries()) {
    const line = `${i + 1}. ${fact}`;
    if (used + line.length > BUDGET.facts) break;
    facts.push(line);
    used += line.length + 1;
  }
  return [
    "JOB REQUIREMENTS (from the posting):",
    clip(input.requirements.trim() || "(The posting has no separate requirements section.)", BUDGET.requirements),
    "",
    "RESUME (bold is marked **like this**; bullets start with \"- \"):",
    clip(input.resumeText, BUDGET.resume),
    "",
    "CONFIRMED FACTS (the only allowed source of claims):",
    facts.join("\n"),
  ].join("\n");
}

/**
 * Enforces the prompt's rules in code too: an issue whose quote isn't verbatim
 * resume text is dropped, and so is one whose fix adds a number the facts don't
 * have. A FAIL with nothing left becomes a PASS.
 */
export function settleVerdict(output: z.infer<typeof Output>, resumeText: string, facts: string[]): { status: "pass" | "fail"; issues: ModelIssue[] } {
  const factNumbers = new Set(facts.flatMap((f) => numbersIn(f)));
  const resumeNumbers = new Set(numbersIn(resumeText));
  const issues = output.issues.filter((issue) => {
    const quote = issue.quote.trim();
    if (!quote || !resumeText.includes(quote)) return false;
    return numbersIn(issue.fix).every((n) => factNumbers.has(n) || resumeNumbers.has(n));
  });
  return output.verdict === "FAIL" && issues.length ? { status: "fail", issues } : { status: "pass", issues: [] };
}

export type ReviewCall = { purpose: string; promptVersion: string; system: string; input: string };
export type ReviewOutcome =
  | { ok: true; model: string; parsed: z.infer<typeof Output> }
  | { ok: false; status: "unavailable" | "limit" | "error"; model: string | null; message: string };

/**
 * One reviewer's call to the review model: reserves a credit, sends the prompt,
 * and returns the model's verdict or a status the page can show. Resumes and
 * letters both go through here, with their own system prompt, so a failure
 * reads the same everywhere. Never throws.
 */
export async function callReviewModel(userId: string, call: ReviewCall, opts: { chargeAccount?: boolean } = {}): Promise<ReviewOutcome> {
  const key = process.env.PROOFLINE_REVIEW_KEY?.trim();
  const model = process.env.PROOFLINE_REVIEW_MODEL?.trim() || DEFAULT_REVIEW_MODEL;
  if (!key) return { ok: false, status: "unavailable", model: null, message: "The final read-through is temporarily unavailable. Your other checks still ran." };

  try {
    if (opts.chargeAccount !== false) await reserveModelCredits(userId, call.purpose);
  } catch (error) {
    if (error instanceof ModelQuotaError) return { ok: false, status: "limit", model, message: `${error.message} Your other checks still ran.` };
    return { ok: false, status: "error", model, message: "The final read-through couldn't start. Try again in a minute." };
  }

  const base = (process.env.PROOFLINE_REVIEW_BASE_URL?.trim() || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
  const started = Date.now();
  try {
    const response = await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: call.system }] },
        contents: [{ role: "user", parts: [{ text: call.input }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 1200, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error(`Review model ${model} returned ${response.status}: ${(await response.text().catch(() => "")).slice(0, 300)}`);
    const body = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const parsed = Output.parse(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")));
    await logLlmCall({ purpose: call.purpose, promptVersion: call.promptVersion, model, ms: Date.now() - started, input: call.input, output: parsed });
    return { ok: true, model, parsed };
  } catch (error) {
    // Visible in the host's function logs; the file log below is off in production. Never includes the key.
    console.error(`[${call.purpose}] failed:`, error instanceof Error ? error.message : String(error));
    await logLlmCall({ purpose: call.purpose, promptVersion: call.promptVersion, model, ms: Date.now() - started, input: call.input, error: error instanceof Error ? error.message : String(error) });
    return { ok: false, status: "error", model, message: "The final read-through didn't finish. Check it again in a minute. Your other checks still count." };
  }
}

export async function modelReview(
  userId: string,
  input: { requirements: string; resumeText: string; facts: string[] },
  /** The owner's health check sends made-up data and is not charged to any account. */
  opts: { chargeAccount?: boolean } = {},
): Promise<ModelReview> {
  const out = await callReviewModel(userId, { purpose: "review.gate", promptVersion: REVIEW_PROMPT_VERSION, system: REVIEW_SYSTEM_PROMPT, input: buildReviewInput(input) }, opts);
  if (!out.ok) return { status: out.status, issues: [], model: out.model, message: out.message };
  const settled = settleVerdict(out.parsed, input.resumeText, input.facts);
  return {
    ...settled,
    model: out.model,
    message: settled.status === "pass" ? "An AI read every line against what you confirmed and found nothing to fix." : `An AI read every line against what you confirmed and found ${settled.issues.length} ${settled.issues.length === 1 ? "line" : "lines"} to fix.`,
  };
}
