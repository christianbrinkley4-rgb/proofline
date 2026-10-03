import { describe, expect, it } from "vitest";
import { contactFromPosting, messageChecks, messageDraft, messageFingerprint } from "./model";
const posting = "Meridian needs an analyst for Excel reporting.\nRecruiter: Avery Morgan, avery@meridian.test\nApplications close October 30.";
const contact = contactFromPosting(posting, "https://meridian.test/jobs/1")!;
const input = { kind: "outreach" as const, company: "Meridian", title: "Analyst", contact, why: "I want to work on the reporting described in this role.", fact: "Built an Excel report for 40 accounts each month.", facts: ["Built an Excel report for 40 accounts each month."], name: "Sam Tester" };
describe("sourced outreach", () => {
  it("accepts explicit posting contact fields without inventing a role", () => {
    const text = "Contact name: David Hawthorne-Finch\nPhone number: +443339962882\nContact email: d.hawthorne-finch@h-fts.com\nJob Description";
    const found = contactFromPosting(text, "https://careers.h-fts.com/job/68213/accounts-assistant-semi-senior-accountant/heywood");
    expect(found).toMatchObject({ name: "David Hawthorne-Finch", role: "Posting contact", email: "d.hawthorne-finch@h-fts.com" });
    expect(text.replaceAll("\n", " ")).toContain(found!.quote);
    expect(contactFromPosting(text.replaceAll(": ", ":\n"), "https://careers.h-fts.com/job/68213/accounts-assistant-semi-senior-accountant/heywood")).toMatchObject({ name: "David Hawthorne-Finch", email: "d.hawthorne-finch@h-fts.com" });
    expect(contactFromPosting("Contact name: Recruiting Team\nContact email: careers@meridian.test", "https://meridian.test/jobs/1")).toBeNull();
  });
  it("copies a named hiring contact and retains exact source evidence", () => {
    expect(contact).toMatchObject({ name: "Avery Morgan", role: "Recruiter", email: "avery@meridian.test", sourceUrl: "https://meridian.test/jobs/1" });
    expect(posting.replaceAll("\n", " ")).toContain(contact.quote);
  });
  it.each(["Contact careers@meridian.test for questions.", "Hiring manager: [Name], name@example.com", "Recruiter: Avery Morgan", "Recruiter: Avery Morgan, privacy@meridian.test", "Email jane@meridian.test"]) ("leaves an honest empty state for %s", (source) => expect(contactFromPosting(source, "https://meridian.test/jobs/1")).toBeNull());
  it("includes the person's own reason and an exact confirmed fact without adding a result", () => {
    const draft = messageDraft(input);
    expect(draft.body).toContain(input.why); expect(draft.body).toContain(input.fact);
    expect(messageChecks(draft, input).every((c) => c.ok)).toBe(true);
    expect(draft.body).not.toContain("\u2014");
  });
  it("blocks filler, unconfirmed evidence, unfinished identity and invented motivation", () => {
    const draft = messageDraft({ ...input, name: "", why: "I am passionate about this dynamic company.", fact: "Saved $40000." });
    const checks = messageChecks(draft, { ...input, name: "", why: "", fact: "Saved $40000." });
    expect(checks.filter((c) => !c.ok).map((c) => c.label)).toEqual(["Confirmed evidence", "Your reason", "Human voice", "Formatting"]);
  });
  it("invalidates a gate when recipient, facts, reason, signature, posting, or content changes", () => {
    const draft = messageDraft(input); const ctx = { ...input, posting };
    const fingerprint = messageFingerprint(draft, ctx);
    for (const change of [{ why: "A different reason" }, { facts: [...input.facts, "New fact"] }, { name: "Another person" }, { posting: "Changed posting" }, { contact: { ...contact, email: "changed@meridian.test" } }]) expect(messageFingerprint(draft, { ...ctx, ...change })).not.toBe(fingerprint);
    expect(messageFingerprint({ ...draft, body: draft.body + "Changed" }, ctx)).not.toBe(fingerprint);
  });
});
