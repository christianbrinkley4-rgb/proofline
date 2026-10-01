import { afterEach, describe, expect, it, vi } from "vitest";
import { reviewByConsensus, type ConsensusSpec } from "./consensus";
import { RESUME_FRAMINGS } from "./framings";
import type { ModelIssue } from "./model";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const FACTS = ["Reconciled 40+ vendor accounts each month in QuickBooks Online, catching $3,200 in duplicate payments", "Helped the office manager build a cash report that pulls bank and QuickBooks data into one sheet"];
const RESUME = [
  "- Reconciled 40+ vendor accounts each month in QuickBooks Online, catching $3,200 in duplicate payments",
  "- Led the office manager build a cash report that pulls bank and QuickBooks data into one sheet",
].join("\n");

const spec: ConsensusSpec = { purpose: "review.gate", framings: RESUME_FRAMINGS, input: "the document", text: RESUME, facts: FACTS, noun: "resume" };

type Answer = { verdict: "PASS" | "FAIL"; issues?: ModelIssue[] } | { status: number };
const issue = (quote: string, category: ModelIssue["category"], rule = "rule", fix = "Say it with what the facts hold"): ModelIssue => ({ quote, category, rule_broken: rule, fix });

/** Answers each reviewer by its framing, so a test says what each independent reviewer thinks. */
function reviewers(answers: Partial<Record<"facts" | "reader" | "complete", Answer>>) {
  vi.stubEnv("PROOFLINE_REVIEW_KEY", "test-key");
  const calls: string[] = [];
  const fetchMock = vi.fn(async (_url: string, init: { body: string }) => {
    const system = JSON.parse(init.body).systemInstruction.parts[0].text as string;
    const framing = RESUME_FRAMINGS.find((f) => f.system === system)!;
    calls.push(framing.id);
    const answer = answers[framing.id] ?? { verdict: "PASS" as const };
    if ("status" in answer) return new Response("server error", { status: answer.status });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ verdict: answer.verdict, issues: answer.issues ?? [] }) }] } }] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const run = () => reviewByConsensus("u", spec, { chargeAccount: false });

describe("review by consensus", () => {
  it("passes when two independent reviewers pass, and does not call a third", async () => {
    const calls = reviewers({});
    const out = await run();
    expect(out.status).toBe("pass");
    expect(out.message).toBe("2 independent reviewers read the resume against what you confirmed and found nothing to fix.");
    expect(calls.sort()).toEqual(["facts", "reader"]);
    expect(out.reviewers?.map((r) => [r.reviewer, r.status])).toEqual([["facts", "pass"], ["reader", "pass"]]);
  });

  it("fails when either reviewer finds a real problem, with only the lines that reviewer quoted", async () => {
    const calls = reviewers({ reader: { verdict: "FAIL", issues: [issue("- Reconciled 40+ vendor accounts each month in QuickBooks Online, catching $3,200 in duplicate payments", "filler", "reads machine-made")] } });
    const out = await run();
    expect(out.status).toBe("fail");
    expect(out.issues).toHaveLength(1);
    expect(out.issues[0].rule_broken).toBe("reads machine-made");
    expect(calls).toHaveLength(2);
  });

  it("counts a line both reviewers flag once", async () => {
    const quote = "- Led the office manager build a cash report that pulls bank and QuickBooks data into one sheet";
    reviewers({ facts: { verdict: "FAIL", issues: [issue(quote, "unsupported_claim", "facts say helped")] }, reader: { verdict: "FAIL", issues: [issue(quote, "other")] } });
    const out = await run();
    expect(out.status).toBe("fail");
    expect(out.issues).toHaveLength(1);
  });

  it("sets aside a reviewer that calls a line unsupported when a confirmed fact says it word for word, and uses the third reviewer", async () => {
    const supported = "- Reconciled 40+ vendor accounts each month in QuickBooks Online, catching $3,200 in duplicate payments";
    const calls = reviewers({ facts: { verdict: "FAIL", issues: [issue(supported, "unsupported_claim", "no support for the duplicate payments")] } });
    const out = await run();
    expect(out.status).toBe("pass");
    expect(calls.sort()).toEqual(["complete", "facts", "reader"]);
    const facts = out.reviewers!.find((r) => r.reviewer === "facts")!;
    expect(facts.disqualified).toBe(`Flagged "${supported}" as unsupported, but your confirmed facts say "${FACTS[0]}".`);
    expect(out.message).toContain("2 independent reviewers");
    expect(out.message).toContain("One reviewer's flag was set aside because your confirmed facts support that line.");
  });

  it("does not loop the person against a reviewer that was set aside, but a genuine problem from the replacement still counts", async () => {
    const supported = "- Reconciled 40+ vendor accounts each month in QuickBooks Online, catching $3,200 in duplicate payments";
    const real = "- Led the office manager build a cash report that pulls bank and QuickBooks data into one sheet";
    reviewers({
      facts: { verdict: "FAIL", issues: [issue(supported, "unsupported_claim")] },
      complete: { verdict: "FAIL", issues: [issue(real, "unsupported_claim", "the facts say helped, not led")] },
    });
    const out = await run();
    expect(out.status).toBe("fail");
    expect(out.issues.map((i) => i.quote)).toEqual([real]);
  });

  it("keeps a reviewer that flags a line the facts do not hold, even though other reviewers pass", async () => {
    const calls = reviewers({ facts: { verdict: "FAIL", issues: [issue("- Led the office manager build a cash report that pulls bank and QuickBooks data into one sheet", "unsupported_claim", "the facts say helped")] } });
    const out = await run();
    expect(out.status).toBe("fail");
    expect(out.reviewers!.find((r) => r.reviewer === "facts")!.disqualified).toBeNull();
    expect(calls).toHaveLength(2);
  });

  it("keeps a reviewer's genuine flag when it was also wrong about another line", async () => {
    const supported = "- Reconciled 40+ vendor accounts each month in QuickBooks Online, catching $3,200 in duplicate payments";
    const real = "- Led the office manager build a cash report that pulls bank and QuickBooks data into one sheet";
    reviewers({ facts: { verdict: "FAIL", issues: [issue(supported, "unsupported_claim"), issue(real, "unsupported_claim", "the facts say helped")] } });
    const out = await run();
    expect(out.status).toBe("fail");
    expect(out.issues.map((i) => i.quote)).toEqual([real]);
    expect(out.reviewers!.find((r) => r.reviewer === "facts")!.disqualified).toBeNull();
  });

  it("never passes on the word of one reviewer", async () => {
    const supported = "- Reconciled 40+ vendor accounts each month in QuickBooks Online, catching $3,200 in duplicate payments";
    reviewers({
      facts: { verdict: "FAIL", issues: [issue(supported, "unsupported_claim")] },
      reader: { verdict: "FAIL", issues: [issue(supported, "unsupported_claim")] },
    });
    const out = await run();
    expect(out.status).toBe("error");
    expect(out.message).toBe("The reviewers couldn't agree on this resume, so it wasn't passed. Check it again in a minute. One reviewer's flag was set aside because your confirmed facts support that line.");
  });

  it("is not a pass when a reviewer cannot be reached, and does not spend a third call to cover for it", async () => {
    const calls = reviewers({ reader: { status: 500 } });
    const out = await run();
    expect(out.status).toBe("error");
    expect(out.message).toMatch(/didn't finish/);
    expect(calls).toHaveLength(2);
  });

  it("is a failure, not an error, when one reviewer fails the resume and the other cannot be reached", async () => {
    reviewers({ facts: { verdict: "FAIL", issues: [issue("- Led the office manager build a cash report that pulls bank and QuickBooks data into one sheet", "unsupported_claim")] }, reader: { status: 500 } });
    expect((await run()).status).toBe("fail");
  });

  it("says unavailable without a key, and never calls out", async () => {
    vi.stubEnv("PROOFLINE_REVIEW_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await run();
    expect(out.status).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores a flag whose quote is not on the page", async () => {
    reviewers({ reader: { verdict: "FAIL", issues: [issue("a line that is not on the resume", "filler")] } });
    expect((await run()).status).toBe("pass");
  });
});
