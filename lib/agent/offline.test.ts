import { describe, expect, it } from "vitest";
import { classify, pickJob, watchQuery } from "./offline";

describe("offline agent routing", () => {
  it.each([
    ["hi", "help"],
    ["what can you do?", "help"],
    ["help me prep for Robinhood", "prep"],
    ["I have an interview with Deloitte on Friday", "prep"],
    ["cover letter for Robinhood", "letter"],
    ["can you write a cover letter for the Coinbase job", "letter"],
    ["follow up with Coinbase", "follow_up"],
    ["What should I do next?", "next"],
    ["catch me up", "next"],
    ["where do my applications stand?", "status"],
    ["find accounting internships in Raleigh for summer 2027", "search"],
    ["accounting internships near Charlotte", "search"],
    ["any remote data analyst jobs?", "search"],
    ["Last summer I tutored three students in algebra twice a week", "story"],
    ["I organized a food drive that collected 120 boxes for families", "story"],
    ["tell me a joke", "unknown"],
    ["keep an eye on accounting internships in Raleigh for me", "watch"],
    ["let me know when new tax internships open up", "watch"],
  ])("%s -> %s", (message, intent) => {
    expect(classify(message)).toBe(intent);
  });

  it.each([
    ["keep an eye on accounting internships in Raleigh for me", "accounting internships in Raleigh"],
    ["Can you watch for remote data analyst jobs?", "remote data analyst jobs"],
    ["let me know when new tax internships open up", "tax internships"],
  ])("pulls the search out of %s", (message, query) => {
    expect(watchQuery(message)).toBe(query);
  });

  it("finds the named company, preferring tracked applications and longer names", () => {
    const jobs = [
      { company: "Coin", title: "Intern", jobId: "1" },
      { company: "Coinbase", title: "Accounting Intern", jobId: "2" },
      { company: "Coinbase", title: "Accounting Intern", jobId: "2", applicationId: "a" },
    ];
    expect(pickJob("cover letter for coinbase", jobs)).toMatchObject({ jobId: "2", applicationId: "a" });
    expect(pickJob("cover letter for Deloitte", jobs)).toBeNull();
  });
});
