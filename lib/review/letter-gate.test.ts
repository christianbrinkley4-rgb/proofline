import { afterEach, describe, expect, it, vi } from "vitest";
import type { CoverLetter, LetterContext } from "@/lib/packet/cover-letter";
import { LETTER_FRAMINGS } from "./framings";
import { buildLetterReviewInput, evaluateLetter, letterFailureReason, letterFingerprint, letterGateChecks, letterReviewText, LETTER_SYSTEM_PROMPT, type LetterGateInput } from "./letter-gate";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const FACT = "Reconciled 40 vendor accounts each month in Excel, catching 3 duplicate payments";
const ctx: LetterContext = { name: "Sam Lee", school: "UNC Greensboro", degree: "BS", major: "Accounting", gradDate: "2026-12", company: "LoopCo", title: "Staff Accountant", evidence: [] };

const letter = (over: Partial<CoverLetter> = {}, texts: Partial<Record<string, string>> = {}): CoverLetter => ({
  greeting: "Dear Hiring Team,",
  paragraphs: [
    { purpose: "opening", sourceIds: [], text: texts.opening ?? "I'm applying for the Staff Accountant role at LoopCo. I'm an Accounting student at UNC Greensboro, graduating in December 2026." },
    { purpose: "evidence", sourceIds: ["b1"], text: texts.evidence ?? "At Tax Office, I reconciled 40 vendor accounts each month in Excel, catching 3 duplicate payments. I also kept the month-end checklist current for the whole team and flagged anything that did not tie out before the review meeting." },
    { purpose: "fit", sourceIds: ["b1"], text: texts.fit ?? "That work gave me hands-on practice with Excel and account reconciliation, which your posting asks for." },
    { purpose: "motivation", sourceIds: [], text: texts.motivation ?? "I read how LoopCo closes its books every week and I want to learn that close process from the team that built it." },
    { purpose: "closing", sourceIds: [], text: "I'd welcome the chance to talk about how I could contribute to LoopCo. Thank you for your time and consideration." },
  ],
  signoff: "Sincerely,",
  generator: "offline",
  promptVersion: null,
  ...over,
});

const input = (l: CoverLetter): LetterGateInput => ({
  letter: l,
  letterContext: ctx,
  requirements: "- Excel\n- Reconciliations",
  jobDescription: "Staff Accountant at LoopCo. Excel and reconciliations.",
  facts: [FACT],
  factTextById: new Map([["f1", FACT]]),
  evidenceById: new Map([["b1", { factIds: ["f1"], org: "Tax Office" }]]),
});

const modelSays = (verdict: "PASS" | "FAIL", issues: Array<{ quote: string; rule_broken: string; fix: string }> = []) => {
  vi.stubEnv("PROOFLINE_REVIEW_KEY", "test-key");
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ verdict, issues }) }] } }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

describe("the cover letter's rules checks", () => {
  it("passes a finished letter that names the employer and rests on a confirmed example", () => {
    const checks = letterGateChecks(input(letter()));
    expect(checks.filter((c) => c.blocking && !c.ok).map((c) => c.id)).toEqual([]);
  });

  it("stops a letter that still has the bracketed prompt for the person's reason", () => {
    const l = letter({}, { motivation: "[Add one or two sentences, in your own words, on why LoopCo and this role. Name something real.]" });
    expect(letterGateChecks(input(l)).find((c) => c.id === "placeholder")).toMatchObject({ ok: false, blocking: true });
  });

  it("holds the letter to the voice rules and a readable length, which are only advice in the editor", () => {
    const filler = letter({}, { motivation: "I am passionate about LoopCo and its innovative culture." });
    expect(letterGateChecks(input(filler)).find((c) => c.id === "voice")).toMatchObject({ ok: false, blocking: true });
    const thin: CoverLetter = { ...letter(), paragraphs: letter().paragraphs.slice(0, 1) };
    expect(letterGateChecks(input(thin)).find((c) => c.id === "gate-length")).toMatchObject({ ok: false, blocking: true });
  });

  it("requires the letter to name the employer", () => {
    const l = letter({}, { opening: "I'm applying for the Staff Accountant role. I'm an Accounting student at UNC Greensboro.", motivation: "I want to learn the close process from a team that does it every week." });
    const named = letterGateChecks({ ...input(l), letter: { ...l, paragraphs: l.paragraphs.map((p) => ({ ...p, text: p.text.replaceAll("LoopCo", "the company") })) } });
    expect(named.find((c) => c.id === "names-employer")).toMatchObject({ ok: false, blocking: true });
  });

  it("rejects a number the person never confirmed in a drafted example", () => {
    const l = letter({}, { evidence: "At Tax Office, I reconciled 400 vendor accounts each month in Excel, catching 3 duplicate payments, and I also kept the month-end checklist current for the whole team and flagged anything that did not tie out." });
    expect(letterGateChecks(input(l)).find((c) => c.id === "evidence")).toMatchObject({ ok: false, blocking: true });
  });
});

describe("the cover letter's model review", () => {
  it("never calls the model while the person's own reason is missing, and says why", async () => {
    const fetchMock = modelSays("PASS");
    const l = letter({}, { motivation: "[Add one or two sentences, in your own words, on why LoopCo and this role. Name something real.]" });
    const result = await evaluateLetter("u", input(l), { chargeAccount: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ passed: false, model: { status: "skipped" } });
    expect(result.model.message).toMatch(/your reason/);
    expect(letterFailureReason(result)).toBe("Add one or two sentences on why you want this job. That part has to be in your own words.");
  });

  it("passes only when the rules pass and the model says PASS", async () => {
    const fetchMock = modelSays("PASS");
    const result = await evaluateLetter("u", input(letter()), { chargeAccount: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.passed).toBe(true);
    expect(result.model.message).toMatch(/found nothing to fix/);
  });

  it("sends the posting, the letter, the profile, and the confirmed facts, and no signature or contact details", async () => {
    const fetchMock = modelSays("PASS");
    await evaluateLetter("u", input(letter()), { chargeAccount: false });
    const body = JSON.parse(((fetchMock.mock.calls[0] as unknown) as [string, { body: string }])[1].body);
    const sent = body.contents[0].parts[0].text as string;
    expect(sent).toContain("JOB POSTING (Staff Accountant at LoopCo)");
    expect(sent).toContain("I reconciled 40 vendor accounts");
    expect(sent).toContain("School: UNC Greensboro");
    expect(sent).toContain(`1. ${FACT}`);
    expect(sent).not.toContain("Sam Lee");
    // Two independent reviewers with different jobs read the same letter.
    const systems = fetchMock.mock.calls.map((call) => JSON.parse(((call as unknown) as [string, { body: string }])[1].body).systemInstruction.parts[0].text as string);
    expect(systems).toEqual([LETTER_FRAMINGS[0].system, LETTER_FRAMINGS[1].system]);
    expect(new Set(systems).size).toBe(2);
  });

  it("keeps the all-purpose letter prompt as the replacement reviewer", () => {
    expect(LETTER_FRAMINGS[2].system).toBe(LETTER_SYSTEM_PROMPT);
  });

  it("fails on a flagged line it can quote, and drops a flag it cannot quote", async () => {
    const real = letter().paragraphs[2].text;
    modelSays("FAIL", [{ quote: real, rule_broken: "says nothing specific", fix: "Name the posting's own words" }]);
    const failed = await evaluateLetter("u", input(letter()), { chargeAccount: false });
    expect(failed).toMatchObject({ passed: false, model: { status: "fail" } });
    expect(letterFailureReason(failed)).toBe("The final read-through of the cover letter flagged a line to fix.");

    modelSays("FAIL", [{ quote: "a sentence that is not in the letter", rule_broken: "invented", fix: "Remove it" }]);
    expect((await evaluateLetter("u", input(letter()), { chargeAccount: false })).passed).toBe(true);
  });

  it("is not ready when the reviewer is unavailable, and says so", async () => {
    vi.stubEnv("PROOFLINE_REVIEW_KEY", "");
    const result = await evaluateLetter("u", input(letter()), { chargeAccount: false });
    expect(result).toMatchObject({ passed: false, model: { status: "unavailable" } });
    expect(letterFailureReason(result)).toMatch(/temporarily unavailable/);
  });
});

describe("what a review is tied to", () => {
  it("changes the fingerprint when the letter, the facts, or the posting change", () => {
    const base = input(letter());
    const same = letterFingerprint(base);
    expect(letterFingerprint({ ...base })).toBe(same);
    expect(letterFingerprint({ ...base, letter: letter({}, { fit: "That work gave me practice with Excel." }) })).not.toBe(same);
    expect(letterFingerprint({ ...base, facts: [...base.facts, "Another confirmed fact"] })).not.toBe(same);
    expect(letterFingerprint({ ...base, jobDescription: "A different posting" })).not.toBe(same);
  });

  it("reviews the letter as the employer reads it", () => {
    expect(letterReviewText(letter())).toMatch(/^Dear Hiring Team,\n\nI'm applying/);
    expect(buildLetterReviewInput(input(letter()))).toContain("STUDENT PROFILE (confirmed): School: UNC Greensboro; Degree: BS; Major: Accounting; Graduation: 2026-12");
  });
});
