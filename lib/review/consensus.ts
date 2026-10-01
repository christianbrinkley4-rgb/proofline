import type { Framing } from "./framings";
import { callReviewModel, settleVerdict, type ModelIssue, type ModelReview, type ReviewerVerdict } from "./model";
import { supportingFact } from "./support";

/**
 * A review that does not rest on one model's say-so. Two reviewers with different
 * jobs read the document independently and it passes only if both pass. A reviewer
 * whose complaint the confirmed facts contradict is set aside for this run (its
 * flags are dropped, not argued with) and a third reviewer takes its place, so a
 * model's mistake never makes the person rewrite a true line, and a pass is never
 * given on the word of fewer than two reviewers.
 *
 * Nothing here can add a claim: reviewers only read, and every flag must quote the
 * document verbatim.
 */

export type ConsensusSpec = {
  /** Used for credits and logs: "review.gate" or "review.letter". */
  purpose: string;
  /** The first two run together; the third replaces one that is set aside. */
  framings: Framing[];
  /** The user message each reviewer receives. */
  input: string;
  /** The document's exact text, for checking that a flag quotes it. */
  text: string;
  facts: string[];
  /** Names a line may use that facts do not hold, such as an employer or school. */
  known?: string[];
  noun: "resume" | "letter";
};

type Round = { framing: Framing; outcome: Awaited<ReturnType<typeof callReviewModel>> };

function settle(round: Round, spec: ConsensusSpec): ReviewerVerdict {
  const { framing, outcome } = round;
  const base = { reviewer: framing.id, label: framing.label, issues: [] as ModelIssue[], disqualified: null as string | null };
  if (!outcome.ok) return { ...base, status: outcome.status, model: outcome.model };
  const settled = settleVerdict(outcome.parsed, spec.text, spec.facts);
  if (settled.status === "pass") return { ...base, status: "pass", model: outcome.model };
  // A reviewer that calls a line unsupported when one confirmed fact already says it is wrong, not the line.
  let wrong: string | null = null;
  const genuine = settled.issues.filter((issue) => {
    if (issue.category !== "unsupported_claim") return true;
    const fact = supportingFact(issue.quote, spec.facts, spec.known);
    if (fact) wrong ??= `Flagged "${issue.quote}" as unsupported, but your confirmed facts say "${fact}".`;
    return !fact;
  });
  // Set aside only when nothing it said stands. A reviewer that was wrong about one line and right about another keeps the line it was right about.
  if (wrong && !genuine.length) return { ...base, status: "fail", issues: settled.issues, disqualified: wrong, model: outcome.model };
  return { ...base, status: "fail", issues: genuine, model: outcome.model };
}

async function ask(userId: string, framing: Framing, spec: ConsensusSpec, opts: { chargeAccount?: boolean }): Promise<ReviewerVerdict> {
  const outcome = await callReviewModel(userId, { purpose: `${spec.purpose}.${framing.id}`, promptVersion: framing.promptVersion, system: framing.system, input: spec.input }, opts);
  return settle({ framing, outcome }, spec);
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export async function reviewByConsensus(userId: string, spec: ConsensusSpec, opts: { chargeAccount?: boolean } = {}): Promise<ModelReview> {
  const [first, second, spare] = spec.framings;
  const verdicts = await Promise.all([ask(userId, first, spec, opts), ask(userId, second, spec, opts)]);

  const counted = () => verdicts.filter((v) => (v.status === "pass" || v.status === "fail") && !v.disqualified);
  const trouble = () => verdicts.find((v) => v.status === "unavailable" || v.status === "limit" || v.status === "error");
  const modelName = () => verdicts.find((v) => v.model)?.model ?? null;

  // A reviewer was set aside and nobody has failed the document: the third reviewer takes its place.
  if (spare && !counted().some((v) => v.status === "fail") && !trouble() && counted().length < 2) verdicts.push(await ask(userId, spare, spec, opts));

  const standing = counted();
  const fails = standing.filter((v) => v.status === "fail");
  const setAside = verdicts.some((v) => v.disqualified);
  const note = setAside ? " One reviewer's flag was set aside because your confirmed facts support that line." : "";

  if (fails.length) {
    const seen = new Set<string>();
    const issues = fails.flatMap((v) => v.issues).filter((issue) => !seen.has(issue.quote) && seen.add(issue.quote));
    return { status: "fail", issues, model: modelName(), reviewers: verdicts, message: `Independent reviewers read the ${spec.noun} against what you confirmed and found ${plural(issues.length, "line", "lines")} to fix.${note}` };
  }
  const problem = trouble();
  if (problem) {
    const message =
      problem.status === "unavailable"
        ? "The final read-through is temporarily unavailable. Your other checks still ran."
        : problem.status === "limit"
          ? "Today's AI usage limit has been reached. Try again tomorrow. Your other checks still ran."
          : "The final read-through didn't finish. Check it again in a minute. Your other checks still count.";
    return { status: problem.status, issues: [], model: problem.model ?? modelName(), reviewers: verdicts, message };
  }
  if (standing.length >= 2) {
    return { status: "pass", issues: [], model: modelName(), reviewers: verdicts, message: `${standing.length} independent reviewers read the ${spec.noun} against what you confirmed and found nothing to fix.${note}` };
  }
  return { status: "error", issues: [], model: modelName(), reviewers: verdicts, message: `The reviewers couldn't agree on this ${spec.noun}, so it wasn't passed. Check it again in a minute.${note}` };
}
