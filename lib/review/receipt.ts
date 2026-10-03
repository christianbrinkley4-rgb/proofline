import type { ModelReview } from "./model";
export type DocumentLine = { key: string; text: string };
export type GateChange = { before: string; after: string | null; rule: string };
export type GateHistory = { documentLines?: DocumentLine[]; changes?: GateChange[]; model: ModelReview; linter?: Array<{ passed: boolean; evidence_quote: string; detail: string }> };
/** Reports only observed changes to a previously quoted problem, never a suggested fix as work done. */
export function changesSince(previous: GateHistory | null, current: DocumentLine[]): GateChange[] {
  if (!previous?.documentLines) return [];
  const byKey = new Map(current.map((line) => [line.key, line.text]));
  const changes = [...(previous.changes ?? [])];
  const issues = [...previous.model.issues, ...(previous.linter ?? []).filter((c) => !c.passed && c.evidence_quote).map((c) => ({ quote: c.evidence_quote, rule_broken: c.detail }))];
  for (const issue of issues) {
    const old = previous.documentLines.find((line) => line.text.includes(issue.quote));
    if (!old) continue;
    const after = byKey.get(old.key) ?? null;
    if (after !== old.text && !changes.some((change) => change.before === old.text && change.after === after)) changes.push({ before: old.text, after, rule: issue.rule_broken });
  }
  return changes.slice(-12);
}
export function reviewerScope(reviewer: string) {
  return ({ facts: "Truthfulness against confirmed facts", reader: "Human voice and this employer's language", complete: "Complete read, clarity, and formatting", replacement: "Independent complete read replacing a contradicted review" } as Record<string, string>)[reviewer] ?? "Independent document review";
}
export function threeReviewersPassed(model: ModelReview) {
  const standing = model.reviewers?.filter((r) => !r.disqualified) ?? [];
  return model.status === "pass" && model.issues.length === 0 && standing.length === 3 && new Set(standing.map((r) => r.reviewer)).size === 3 && standing.every((r) => r.status === "pass");
}
