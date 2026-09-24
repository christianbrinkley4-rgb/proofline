import { describe, expect, it } from "vitest";
import { findVoiceIssues } from "./rules";
import { cleanTranscript, guessDetails, introducesNumbers } from "./transcript";

describe("cleanTranscript", () => {
  it("drops filler and punctuates each pause as a sentence", () => {
    expect(cleanTranscript(["um so I worked at the front desk", "uh I checked in like 40 patients a day you know"])).toBe(
      "So I worked at the front desk. I checked in like 40 patients a day.",
    );
  });

  it("applies spoken number corrections", () => {
    expect(cleanTranscript("we had 30, I mean 40 volunteers")).toBe("We had 40 volunteers.");
    expect(cleanTranscript("it saved about 3 no wait 4 hours a week")).toBe("It saved about 4 hours a week.");
  });

  it("removes a sentence the speaker scratched", () => {
    expect(cleanTranscript(["I was the president", "scratch that", "I was the treasurer"])).toBe("I was the treasurer.");
  });

  it("removes stutters and fixes a lowercase i", () => {
    expect(cleanTranscript("i i reconciled the the vendor accounts and i'm proud of it")).toBe("I reconciled the vendor accounts and I'm proud of it.");
  });

  it("breaks paragraphs and lines where the speaker asked", () => {
    expect(cleanTranscript("first thing new paragraph second thing new line third")).toBe("First thing.\n\nSecond thing.\nThird.");
  });

  it("keeps meaningful 'like' and never adds numbers", () => {
    const out = cleanTranscript("I'd like to work in audit");
    expect(out).toBe("I'd like to work in audit.");
    expect(introducesNumbers("I trained new hires", "I trained 5 new hires")).toEqual(["5"]);
    expect(introducesNumbers("about 3,200 dollars", "About $3,200.")).toEqual([]);
  });

  it("produces text that passes the voice rules", () => {
    expect(findVoiceIssues(cleanTranscript("um so basically I built a tracker, you know, for 300 items"))).toEqual([]);
  });
});

describe("guessDetails", () => {
  it("reads the place, role, and kind from how people talk", () => {
    expect(guessDetails("Last summer I worked at Oakwood Family Dental as a bookkeeping assistant")).toEqual({
      org: "Oakwood Family Dental",
      title: "Bookkeeping Assistant",
      kind: "work",
    });
    expect(guessDetails("I volunteered with Habitat for Humanity on weekends").kind).toBe("volunteer");
    expect(guessDetails("As treasurer of the Accounting Club I ran the budget").kind).toBe("leadership");
  });
});
