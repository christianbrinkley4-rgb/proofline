import { describe, expect, it } from "vitest";
import { storyParts } from "./interview";
import { practiceFeedback } from "./practice";

const FACTS = ["Reconciled 40+ vendor accounts each month in QuickBooks Online, catching $3,200 in duplicate payments", "Oakwood Family Dental"];
const storyText = FACTS[0];
const behavioral = { id: "problem", category: "behavioral" as const, story: { evidenceId: "e1", org: "Oakwood Family Dental", text: storyText, parts: storyParts(storyText) } };

const STRONG =
  "At Oakwood Family Dental I was the only bookkeeping help, and the office manager was worried about vendor bills. " +
  "When I reconciled the vendor accounts each month in QuickBooks, I noticed some invoices had been paid twice. " +
  "I built a simple checklist, matched every payment against the invoice, and flagged the duplicates to the manager. " +
  "In the end I caught $3,200 in duplicate payments, and the office got most of it refunded within the quarter. " +
  "Since then I check new vendors the same way before anything goes out. " +
  "The part I was proudest of was the checklist itself. I wrote it so the front desk could use it on the days I wasn't in, " +
  "and I walked two of them through it so they understood why each step was there. " +
  "It taught me that the boring reconciliation work is where a small office finds real money, and it's the kind of careful work I want to keep doing in this role.";

describe("practice feedback", () => {
  it("praises a full story with a confirmed number", () => {
    const fb = practiceFeedback(STRONG, behavioral, FACTS);
    expect(fb.notes.every((n) => n.tone === "good")).toBe(true);
    expect(fb.notes.map((n) => n.text)).toEqual(
      expect.arrayContaining(["It has the situation, what you did, and how it turned out.", "Every number you said matches your confirmed facts.", "You used your Oakwood Family Dental example."]),
    );
    expect(fb.seconds).toBeGreaterThan(30);
  });

  it("flags a number the person never confirmed", () => {
    const fb = practiceFeedback(STRONG.replace("$3,200", "$9,000"), behavioral, FACTS);
    expect(fb.notes[0]).toEqual({ tone: "fix", text: expect.stringContaining('"$9,000", which isn\'t in your confirmed facts') });
  });

  it("asks whose work it was when it's all \"we\"", () => {
    const fb = practiceFeedback(
      "When the team had a deadline at the dental office we split up the vendor accounts and we worked late and we got it all reconciled before the audit started, so we finished on time and everyone was happy with how it went.",
      behavioral,
      FACTS,
    );
    expect(fb.notes.some((n) => n.text.startsWith('You said "we" 4 times'))).toBe(true);
  });

  it("points to the stronger story and flags cliches", () => {
    const fb = practiceFeedback(
      "When I worked at the campus library I am a team player and very hard-working, so I helped shelve books every week and made sure everything was done correctly for the librarians and the students who came in.",
      behavioral,
      FACTS,
    );
    const text = fb.notes.map((n) => n.text).join("\n");
    expect(text).toContain("Your strongest example for this is from Oakwood Family Dental");
    expect(text).toContain('"team player", "hard-working"');
  });

  it("wants an honest plan for a gap question", () => {
    const gap = { id: "gap-sql", category: "gap" as const, story: null };
    const vague = practiceFeedback("I am a fast learner and I know I can pick up anything quickly because I love learning new tools and I always figure it out on the job no matter what it is.", gap, FACTS);
    expect(vague.notes.some((n) => n.tone === "good" && n.text.startsWith("Honest"))).toBe(true);
    const dodge = practiceFeedback("I am a quick study and I know I can pick up anything quickly because I love new tools and I always figure it out on the job no matter what it is they need.", gap, FACTS);
    expect(dodge.notes.some((n) => n.tone === "fix" && n.text.startsWith("Say plainly"))).toBe(true);
  });

  it("asks for more before judging a short answer", () => {
    expect(practiceFeedback("I like accounting.", behavioral, FACTS).notes).toEqual([{ tone: "fix", text: expect.stringContaining("Say a bit more") }]);
  });

  it("wants the company named in why-company", () => {
    const fb = practiceFeedback(
      "I want this job because the role matches what I have done in bookkeeping, and I would like to keep growing in accounting at a place with a strong training program for interns like me this summer.",
      { id: "why-company", category: "motivation", story: null },
      FACTS,
      "Acme Health",
    );
    expect(fb.notes.some((n) => n.text.startsWith("Say Acme Health by name"))).toBe(true);
  });
});
