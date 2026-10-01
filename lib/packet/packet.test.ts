import { describe, expect, it } from "vitest";
import { findVoiceIssues } from "@/lib/voice/rules";
import { checkCoverLetter, draftCoverLetterOffline, inSentence, letterText, roleWithNoun, skillInSentence, WHY_PLACEHOLDER, type CoverLetter } from "./cover-letter";
import { asSentence, lowerFirst, rankEvidence, requirementLabels, selectEvidenceForLetter, type EvidenceInput } from "./evidence";
import { interviewPrep, storyParts } from "./interview";

const item = (id: string, text: string, org: string, experienceId: string, extra: Partial<EvidenceInput> = {}): EvidenceInput => ({
  id, kind: "bullet", text, experienceId, org, title: null, factIds: [`f-${id}`], quality: 0.8, recency: 1, ...extra,
});

const ITEMS: EvidenceInput[] = [
  item("b1", "Reconciled 40+ vendor accounts each month in QuickBooks Online, catching $3,200 in duplicate payments within the first quarter", "Oakwood Family Dental", "e1"),
  item("b2", "Saved the office manager about 3 hours a week by building a cash report that pulls bank and QuickBooks data into one sheet", "Oakwood Family Dental", "e1"),
  item("b3", "Cut month-end inventory counts from 2 days to 6 hours by building an Excel tracker for 300+ SKUs", "NC State Bookstores", "e2", { recency: 0.7 }),
  item("b4", "Led a 5-person team to 2nd place out of 18 at the Beta Alpha Psi regional case competition", "Beta Alpha Psi", "e3", { quality: 0.9 }),
];
const FACTS = new Map(ITEMS.map((i) => [`f-${i.id}`, i.text]));
const BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

const req = {
  required: ["Account reconciliation", "Excel"], preferred: ["QuickBooks"], requiredGroups: [["Account reconciliation"], ["Excel"]],
  preferredGroups: [["QuickBooks"]], mentioned: ["Account reconciliation", "Excel", "QuickBooks", "Month-end close"],
  degreeFields: [], minGpa: null, gradWindow: null, yearsExperience: null, noSponsorship: false, licensesRequired: [], requiredLines: [], preferredLines: [],
};

describe("evidence", () => {
  it("ranks what the posting asks for first", () => {
    const ranked = rankEvidence(ITEMS, requirementLabels(req));
    expect(ranked[0].id).toBe("b1");
    expect(ranked[0].covers).toContain("Account reconciliation");
    expect(ranked.at(-1)!.id).toBe("b4");
  });

  it("turns a resume line into a first-person sentence", () => {
    expect(asSentence("Reconciled 40+ accounts", { org: "Oakwood", lead: "at" })).toBe("At Oakwood, I reconciled 40+ accounts.");
    expect(asSentence("Built a tracker", { lead: "also" })).toBe("I also built a tracker.");
    expect(asSentence("I organized a food drive for 120 families.")).toBe("I organized a food drive for 120 families.");
    // A line that already names the organization is not introduced with it a second time.
    expect(asSentence("Led a 5-person team to 2nd place at the Beta Alpha Psi regional competition", { org: "Beta Alpha Psi", lead: "at" })).toBe("I led a 5-person team to 2nd place at the Beta Alpha Psi regional competition.");
    expect(lowerFirst("QuickBooks reports")).toBe("QuickBooks reports");
    expect(lowerFirst("SQL queries")).toBe("SQL queries");
  });

  it("keeps skill names readable mid-sentence", () => {
    expect(inSentence("Account reconciliation")).toBe("account reconciliation");
    expect(inSentence("Excel")).toBe("Excel");
    expect(inSentence("GAAP")).toBe("GAAP");
    expect(inSentence("Power BI")).toBe("Power BI");
  });
});

describe("cover letter", () => {
  const evidence = rankEvidence(ITEMS, requirementLabels(req));
  const base = {
    name: "Jordan Reyes", school: "North Carolina State University", degree: "Bachelor of Science", major: "Accounting",
    gradDate: "2028-05", company: "Northwind", title: "Audit Intern", evidence, now: new Date("2026-09-23T00:00:00Z"),
  };

  it("blocks a generated letter with no confirmed example", () => {
    const letter = draftCoverLetterOffline({ ...base, evidence: [], why: "I care about this team's work" });
    const check = checkCoverLetter(letter, FACTS, BY_ID).find((item) => item.id === "specific-evidence");
    expect(check).toMatchObject({ ok: false, blocking: true });
  });
  it("uses only confirmed evidence and cites it", () => {
    const letter = draftCoverLetterOffline(base);
    expect(letter.greeting).toBe("Dear Hiring Team,");
    expect(letter.paragraphs[0].text).toBe("I'm applying for the Audit Intern role at Northwind. I'm an Accounting student at North Carolina State University, graduating in May 2028.");
    const evidenceParas = letter.paragraphs.filter((p) => p.purpose === "evidence");
    expect(evidenceParas[0].text).toMatch(/^At Oakwood Family Dental, I reconciled 40\+ vendor accounts/);
    expect(evidenceParas.flatMap((p) => p.sourceIds).length).toBeGreaterThan(1);
    const checks = checkCoverLetter(letter, FACTS, BY_ID);
    expect(checks.find((c) => c.id === "evidence")!.ok).toBe(true);
  });

  it("names a skill the way the posting does when it is the same thing, and the person's own way otherwise", () => {
    expect(skillInSentence("Account reconciliation", "You will own account reconciliations each month.")).toBe("account reconciliations");
    expect(skillInSentence("Accounts payable", "Process A/P for 30 vendors")).toBe("accounts payable (A/P)");
    expect(skillInSentence("QuickBooks", "Experience with Quickbooks required")).toBe("QuickBooks");
    expect(skillInSentence("Excel", "Advanced pivot tables and VLOOKUP")).toBe("Excel");
    expect(skillInSentence("Account reconciliation")).toBe("account reconciliation");
    const letter = draftCoverLetterOffline({ ...base, postingText: "Own the account reconciliations and the month-end close." });
    const fit = letter.paragraphs.find((p) => p.purpose === "fit");
    if (fit) expect(fit.text).not.toMatch(/account reconciliation[^s]/);
  });

  it("uses the right article for a completed associate degree", () => {
    const letter = draftCoverLetterOffline({ ...base, degree: "Associate in Applied Science", major: "Hospitality Management", gradDate: "2025", now: new Date("2026-09-23T00:00:00Z") });
    expect(letter.paragraphs[0].text).toContain("with an Associate in Applied Science");
  });

  it("leads with confirmed work instead of old education for an established worker", () => {
    const letter = draftCoverLetterOffline({ ...base, degree: "Associate in Applied Science", major: "Hospitality Management", gradDate: "2016", now: new Date("2026-09-23T00:00:00Z") });
    expect(letter.paragraphs[0].text).not.toContain("graduated");
    expect(letter.paragraphs.some((paragraph) => paragraph.purpose === "evidence")).toBe(true);
  });

  it("lets a model choose sources without letting it write claims", () => {
    const ranked = rankEvidence(ITEMS, requirementLabels(req));
    const chosen = selectEvidenceForLetter(["b3", "b1"], ranked);
    expect(chosen?.map((item) => item.id)).toEqual(["b3", "b1"]);
    const letter = draftCoverLetterOffline({ ...base, evidence: chosen!, why: "I want to work with this team" });
    expect(letter.paragraphs.filter((paragraph) => paragraph.purpose === "evidence").flatMap((paragraph) => paragraph.sourceIds)).toEqual(["b3", "b1"]);
    expect(checkCoverLetter(letter, FACTS, BY_ID).filter((check) => check.blocking && !check.ok)).toEqual([]);
    expect(selectEvidenceForLetter(["b1", "invented-id"], ranked)).toBeNull();
    expect(selectEvidenceForLetter(["b1", "b1"], ranked)).toBeNull();
  });

  it("never invents a reason for applying", () => {
    const letter = draftCoverLetterOffline(base);
    expect(letter.paragraphs.find((p) => p.purpose === "motivation")!.text).toBe(WHY_PLACEHOLDER("Northwind"));
    expect(checkCoverLetter(letter, FACTS, BY_ID).find((c) => c.id === "placeholder")!.ok).toBe(false);

    const mine = draftCoverLetterOffline({ ...base, why: "I use Northwind's budgeting app every week" });
    expect(mine.paragraphs.find((p) => p.purpose === "motivation")!.text).toBe("I use Northwind's budgeting app every week.");
    expect(checkCoverLetter(mine, FACTS, BY_ID).every((c) => c.ok || !c.blocking)).toBe(true);
  });

  it("greets a known contact by name and passes the voice rules", () => {
    const letter = draftCoverLetterOffline({ ...base, contactName: "Ms. Patel", why: "I met your team at the career fair" });
    expect(letter.greeting).toBe("Dear Ms. Patel,");
    expect(findVoiceIssues(letterText(letter, "Jordan Reyes"))).toEqual([]);
  });

  it("keeps a course number out of evidence-number checks", () => {
    const classEvidence = rankEvidence([item("class", "Surveyed 60 responses in two weeks", "Intro to Business class (BUS 110)", "class-e")], requirementLabels(req));
    const letter = draftCoverLetterOffline({ ...base, evidence: classEvidence, why: "I want to help this team" });
    expect(letter.paragraphs.find((p) => p.purpose === "evidence")?.text).toContain("In Intro to Business class (BUS 110), I surveyed 60 responses");
    const facts = new Map([["f-class", "Surveyed 60 responses in two weeks"]]);
    const byId = new Map(classEvidence.map((e) => [e.id, e]));
    expect(checkCoverLetter(letter, facts, byId).find((c) => c.id === "evidence")?.ok).toBe(true);
    const changed = structuredClone(letter);
    changed.paragraphs[1].text = changed.paragraphs[1].text.replace("60 responses", "90 responses");
    expect(checkCoverLetter(changed, facts, byId).find((c) => c.id === "evidence")?.ok).toBe(false);
  });
  it("flags a number that isn't in the cited facts", () => {
    const letter: CoverLetter = {
      ...draftCoverLetterOffline(base),
      generator: "anthropic",
    };
    letter.paragraphs[1] = { ...letter.paragraphs[1], text: "At Oakwood, I reconciled 90 vendor accounts." };
    const evidence = checkCoverLetter(letter, FACTS, BY_ID).find((c) => c.id === "evidence")!;
    expect(evidence.ok).toBe(false);
    expect(evidence.detail).toContain("90");
  });

  it("flags evidence whose facts are no longer confirmed", () => {
    const letter = draftCoverLetterOffline(base);
    const facts = new Map(FACTS);
    facts.delete("f-b1");
    expect(checkCoverLetter(letter, facts, BY_ID).find((c) => c.id === "evidence")!.ok).toBe(false);
  });

  it("trusts the person's own edits but still checks the voice", () => {
    const letter: CoverLetter = { ...draftCoverLetterOffline({ ...base, why: "I like audit work" }), generator: "user" };
    letter.paragraphs[1] = { ...letter.paragraphs[1], text: "I reconciled 90 accounts — every month." };
    const checks = checkCoverLetter(letter, FACTS, BY_ID);
    expect(checks.find((c) => c.id === "evidence")!.ok).toBe(true);
    expect(checks.find((c) => c.id === "voice")!.ok).toBe(false);
  });
});

describe("interview prep", () => {
  const evidence = rankEvidence(ITEMS, requirementLabels(req));
  const prep = interviewPrep({
    company: "Northwind", title: "Audit Intern", school: "NC State", major: "Accounting", gradDate: "2028-05",
    evidence, matched: ["Account reconciliation", "Excel"], missing: ["Auditing"],
    experiences: [{ org: "Oakwood Family Dental", title: "Bookkeeping Assistant" }, { org: "NC State Bookstores", title: "Inventory Assistant" }],
  });

  it("covers the usual arc of an interview", () => {
    expect(prep[0].question).toBe("Tell me about yourself.");
    expect(prep.map((q) => q.category)).toEqual(expect.arrayContaining(["intro", "motivation", "skill", "behavioral", "gap"]));
    expect(prep.at(-1)!.question).toBe("What questions do you have for us?");
  });

  it("backs skill and behavioral questions with the person's own stories", () => {
    const skill = prep.find((q) => q.id === "skill-account-reconciliation")!;
    expect(skill.story?.evidenceId).toBe("b1");
    const teamwork = prep.find((q) => q.id === "teamwork");
    expect(teamwork?.story?.org).toBe("Beta Alpha Psi");
    expect(prep.find((q) => q.id === "gap-auditing")!.story).toBeNull();
  });

  it("splits a bullet into action and result without inventing a situation", () => {
    expect(storyParts("Cut month-end inventory counts from 2 days to 6 hours by building an Excel tracker")).toEqual({
      situation: null,
      action: "Building an Excel tracker",
      result: "Cut month-end inventory counts from 2 days to 6 hours",
    });
    expect(storyParts("Reconciled 40+ vendor accounts each month, catching $3,200 in duplicate payments")).toEqual({
      situation: null,
      action: "Reconciled 40+ vendor accounts each month",
      result: "Catching $3,200 in duplicate payments",
    });
  });
});

describe("role names in prose", () => {
  it.each([
    ["Accounting Intern (Summer 2027)", "Accounting Intern role"],
    ["Financial Accounting Internship - Summer 2027", "Financial Accounting Internship"],
    ["2027 Summer Intern - Finance Controllership", "Summer Intern, Finance Controllership role"],
    ["Accounting Intern (Term-Time, Part-Time)", "Accounting Intern role"],
    ["Summer 2027 Accounting Internship - Chelsea MA", "Accounting Internship, Chelsea MA role"],
    ["Staff Accountant", "Staff Accountant role"],
  ])("%s", (title, expected) => {
    expect(roleWithNoun(title)).toBe(expected);
  });
});
