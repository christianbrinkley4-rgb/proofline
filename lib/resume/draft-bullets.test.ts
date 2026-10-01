import { describe, expect, it } from "vitest";
import { findVoiceIssues } from "@/lib/voice/rules";
import { draftBullets, draftWithAnswer, splitDuties, unsupportedNumbers } from "./draft-bullets";
import { hasNumber } from "./polish";

const SAMPLES = [
  { kind: "work", ended: true, description: "I worked the register, about 50 customers a shift. I also restocked shelves and trained 2 new hires. Helped customers find what they needed." },
  { kind: "work", ended: true, description: "Greeted guests, answered phones, and booked appointments for 3 stylists" },
  { kind: "internship", ended: true, description: "I was responsible for updating the client spreadsheet every week. Reorganized the shared drive, which cut search time in half. Sat in on client calls and took notes." },
  { kind: "leadership", ended: false, description: "I run the club's Instagram and plan our monthly events. We grew from 20 to 45 members this year." },
  { kind: "volunteer", ended: true, description: "- tutored 4th graders in math twice a week\n- set up and cleaned up after the food drive\n- made flyers" },
  { kind: "work", ended: true, description: "Customer service, cash handling, opening and closing the store." },
  { kind: "project", ended: true, description: "Built a budget tracker in Google Sheets for my club so 12 members could log dues" },
];

describe("draftBullets", () => {
  it.each(SAMPLES)("drafts honest lines from: $description", (sample) => {
    const lines = draftBullets(sample);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines.length).toBeLessThanOrEqual(4);
    for (const line of lines) {
      // Nothing the person didn't say: every number is theirs.
      expect(unsupportedNumbers(line.text, [sample.description])).toEqual([]);
      expect(findVoiceIssues(line.text)).toEqual([]);
      expect(line.text).not.toMatch(/^I\b|\bI was\b|responsible for/i);
      expect(line.text[0]).toBe(line.text[0].toUpperCase());
      // One question, only when there's no number yet.
      expect(Boolean(line.question)).toBe(!hasNumber(line.text) && !/\b(every|each|twice|once|weekly|monthly|daily|nightly)\b/i.test(line.text));
    }
  });

  it("splits a list of duties but keeps a pair of verbs on one object together", () => {
    expect(splitDuties("Greeted guests, answered phones, and booked appointments")).toEqual(["Greeted guests", "answered phones", "booked appointments"]);
    expect(splitDuties("Cleaned and restocked shelves")).toEqual(["Cleaned and restocked shelves"]);
  });

  it("writes plain past-tense lines for a role that ended", () => {
    const texts = draftBullets(SAMPLES[0]).map((l) => l.text);
    expect(texts).toContain("Operated the cash register for about 50 customers a shift");
    expect(texts).toContain("Restocked shelves");
    expect(texts).toContain("Trained 2 new hires");
  });

  it("drops the wrapper words and keeps what they did", () => {
    const texts = draftBullets(SAMPLES[2]).map((l) => l.text);
    expect(texts).toContain("Updated the client spreadsheet every week");
  });

  it("leads with a result they named", () => {
    const texts = draftBullets(SAMPLES[2]).map((l) => l.text);
    expect(texts.some((t) => /^Cut search time in half by reorganizing the shared drive$/.test(t))).toBe(true);
  });

  it("keeps present tense for a role they still have", () => {
    const texts = draftBullets(SAMPLES[3]).map((l) => l.text);
    expect(texts[0]).toMatch(/^Run /);
  });

  it("never pads a thin description with made-up work", () => {
    expect(draftBullets({ kind: "work", ended: true, description: "Cashier" })).toEqual([]);
    expect(draftBullets({ kind: "work", ended: true, description: "Answered phones" })).toHaveLength(1);
  });

  it("caps at four lines and prefers the ones with numbers", () => {
    const lines = draftBullets({
      kind: "work",
      ended: true,
      description: "Answered phones. Filed paperwork. Greeted visitors. Sorted the mail. Scheduled 40 appointments a week. Ordered supplies.",
    });
    expect(lines).toHaveLength(4);
    expect(lines.some((l) => l.text.includes("40"))).toBe(true);
  });

  it("adds a number only from their answer", () => {
    const [line] = draftBullets({ kind: "work", ended: true, description: "Answered phone calls" });
    expect(line.question).toMatch(/how many phone calls/i);
    const text = draftWithAnswer(line, "about 40 a shift", true);
    expect(text).toBe("Answered about 40 phone calls a shift");
    expect(unsupportedNumbers(text, ["Answered phone calls", "about 40 a shift"])).toEqual([]);
    expect(() => draftWithAnswer(line, "a lot", true)).toThrow(/number/);
  });

  it("flags a number that came from nowhere", () => {
    expect(unsupportedNumbers("Served 60 customers a shift", ["Served about 50 customers a shift"])).toEqual(["60"]);
  });
});
