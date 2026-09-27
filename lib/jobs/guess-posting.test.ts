import { describe, expect, it } from "vitest";
import { guessPosting, isLink } from "./guess-posting";

describe("guessPosting", () => {
  it("prefers the opening title and company over later hiring prose", () => {
    expect(guessPosting("Staff Accountant\nOakridge Manufacturing Co.\nOakridge is hiring a Staff Accountant to support month-end close and financial reporting.")).toMatchObject({
      title: "Staff Accountant", company: "Oakridge Manufacturing Co.",
    });
  });
  it("reads LinkedIn's copy order: company, title, place", () => {
    const text = "Acme Health\nStaff Accountant Intern\nRaleigh, NC · Hybrid · 2 weeks ago · 48 applicants\nAbout the job\nWe are looking for...";
    expect(guessPosting(text)).toEqual({ title: "Staff Accountant Intern", company: "Acme Health", location: "Raleigh, NC" });
  });

  it("reads 'Title at Company'", () => {
    expect(guessPosting("Business Analyst Intern at Carrow Partners\nRemote\n\nResponsibilities\n...")).toMatchObject({
      title: "Business Analyst Intern",
      company: "Carrow Partners",
      location: "Remote",
    });
  });

  it("reads 'Company is hiring a Title'", () => {
    expect(guessPosting("Brightline Health is hiring a Marketing Coordinator.\nAbout us")).toMatchObject({ company: "Brightline Health", title: "Marketing Coordinator" });
  });

  it("reads a board layout with the company under the title", () => {
    expect(guessPosting("Summer 2027 Operations Intern\nOakridge Credit Union - Cary, NC\n\nWhat you'll do")).toMatchObject({
      title: "Summer 2027 Operations Intern",
      company: "Oakridge Credit Union",
    });
  });

  it("keeps a parenthesized role title instead of picking a responsibility line", () => {
    const text = [
      "Bookkeeper (Part-Time)",
      "Westfield Services",
      "Remote",
      "Responsibilities",
      "Prepare simple monthly reports and reconcile accounts.",
      "Help with payroll records and filing.",
    ].join("\n");
    expect(guessPosting(text)).toMatchObject({
      title: "Bookkeeper (Part-Time)",
      company: "Westfield Services",
      location: "Remote",
    });
  });
  it("leaves blanks rather than guessing wildly", () => {
    expect(guessPosting("We make great software.\nJoin us.")).toEqual({ title: "", company: "", location: "" });
  });
});

describe("isLink", () => {
  it("tells a link from pasted text", () => {
    expect(isLink(" https://www.linkedin.com/jobs/view/123 ")).toBe(true);
    expect(isLink("Business Intern at Acme\nhttps://acme.com")).toBe(false);
  });
});
