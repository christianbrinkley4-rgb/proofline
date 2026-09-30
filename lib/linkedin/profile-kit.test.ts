import { describe, expect, it } from "vitest";
import type { FactBase, FactRow, RoleBlock } from "@/lib/facts/base";
import { findVoiceIssues } from "@/lib/voice/rules";
import { ABOUT_PROMPT, buildLinkedInKit, isProfileLine, LINKEDIN_LIMITS } from "./profile-kit";

let n = 0;
const row = (text: string, field: FactRow["field"] = null): FactRow => ({ id: `f${++n}`, text, field, label: "", verifiedAt: null, source: "user_stated" });

function role(org: string, title: string, dates: string, bullets: string[]): RoleBlock {
  return {
    experience: { id: `e-${org}`, org, kind: "work" } as RoleBlock["experience"],
    group: "experience",
    header: [row(title, "title"), row(org, "org"), row(dates, "dates")],
    bullets: bullets.map((b) => row(b, "bullet")),
  };
}

const base: FactBase = {
  education: [row("State University", "school"), row("Bachelor of Science", "degree"), row("Accounting", "major"), row("May 2027", "grad_date")],
  roles: [
    role("Acme Health", "Staff Accountant Intern", "June 2026 to August 2026", ["Recorded 120 journal entries in QuickBooks for 40 vendor accounts", "Top 5 intern in the summer cohort"]),
    role("Campus Bookstore", "Cashier", "2024 to 2026", ["Balanced a $3,000 cash drawer each shift"]),
  ],
  skill: [row("QuickBooks"), row("Excel"), row("excel"), row("Account reconciliation")],
  license: [row("QuickBooks Certified User")],
  number: [],
  other: [],
  total: 12,
};

const today = new Date(2026, 8, 28);

describe("LinkedIn profile kit", () => {
  const kit = buildLinkedInKit(base, { targetRoles: ["Audit intern"], gradDate: "2027-05" }, today);
  const allText = [kit.headline, kit.about, ...kit.roles.map((r) => r.description)].join("\n");

  it("writes a headline from confirmed facts and the stated goal, within LinkedIn's limit", () => {
    expect(kit.headline).toBe("Accounting student at State University | Open to: Audit intern | QuickBooks, Excel, Account reconciliation");
    expect(kit.headline.length).toBeLessThanOrEqual(LINKEDIN_LIMITS.headline);
  });

  it("builds the About only from confirmed facts, leaving the goal for the person to write", () => {
    expect(kit.about).toContain("I'm studying Accounting at State University, graduating May 2027.");
    expect(kit.about).toContain("At Acme Health, I recorded 120 journal entries in QuickBooks for 40 vendor accounts.");
    expect(kit.about).toContain("At Campus Bookstore, I balanced a $3,000 cash drawer each shift.");
    expect(kit.about).not.toContain("Top 5 intern");
    expect(kit.about.endsWith(ABOUT_PROMPT)).toBe(true);
  });

  it("never introduces a number the person didn't confirm", () => {
    const confirmed = new Set([base.education, base.skill, base.license, ...base.roles.flatMap((r) => [r.header, r.bullets])].flat().flatMap((f) => f.text.match(/\d[\d,.$]*/g) ?? []));
    const used = allText.replace(ABOUT_PROMPT, "").match(/\d[\d,.$]*/g) ?? [];
    expect(used.filter((x) => !confirmed.has(x.replace(/[.,]$/, "")))).toEqual([]);
  });

  it("gives each role a pasteable description and dedupes skills", () => {
    expect(kit.roles[0]).toMatchObject({ title: "Staff Accountant Intern", org: "Acme Health", dates: "June 2026 to August 2026", bullets: 2 });
    expect(kit.roles[0].description).toBe("• Recorded 120 journal entries in QuickBooks for 40 vendor accounts.\n• Top 5 intern in the summer cohort.");
    expect(kit.skills).toEqual(["QuickBooks", "Excel", "Account reconciliation"]);
    expect(kit.licenses).toEqual(["QuickBooks Certified User"]);
  });

  it("follows the voice rules", () => {
    expect(findVoiceIssues(allText)).toEqual([]);
  });

  it("merges near-duplicate skills and keeps the more specific of two lines about the same work", () => {
    const messy: FactBase = {
      ...base,
      roles: [role("Oakwood Dental", "Bookkeeper", "2025 to Present", ["Posted vendor payments in QuickBooks", "Posted 150+ vendor payments a month in QuickBooks", "Trained two new hires on billing"])],
      skill: [row("Excel (pivot tables, XLOOKUP)"), row("SQL"), row("Excel (pivot tables, VLOOKUP)"), row("SQL (basic)")],
    };
    const tidy = buildLinkedInKit(messy, {}, today);
    expect(tidy.skills).toEqual(["Excel (pivot tables, XLOOKUP, VLOOKUP)", "SQL (basic)"]);
    expect(tidy.headline).toBe("Bookkeeper at Oakwood Dental | Excel, SQL");
    expect(tidy.roles[0].description).toBe("• Posted 150+ vendor payments a month in QuickBooks.\n• Trained two new hires on billing.");
    expect(tidy.about).toContain("At Oakwood Dental, I posted 150+ vendor payments a month in QuickBooks.");
  });

  it("lists roles most recent first and leads the About with the current job", () => {
    const older = role("Food Bank", "Operations Intern", "Jun 2024 to Aug 2024", ["Built a donations tracker for 1,200 gifts a month"]);
    older.experience = { ...older.experience, kind: "internship", startDate: "2024-06", endDate: "2024-08" };
    const current = role("Oakwood Dental", "Bookkeeper", "May 2025 to Present", ["Reconciled 40 vendor accounts each month"]);
    current.experience = { ...current.experience, startDate: "2025-05", endDate: null };
    const kit = buildLinkedInKit({ ...base, roles: [older, current] }, {}, today);
    expect(kit.roles.map((r) => r.org)).toEqual(["Oakwood Dental", "Food Bank"]);
    expect(kit.about.indexOf("At Oakwood Dental")).toBeLessThan(kit.about.indexOf("At Food Bank"));
  });

  it("adds an article only where a name needs one", () => {
    const kit = buildLinkedInKit({ ...base, roles: [role("NC State VITA Program", "Volunteer", "2026", ["Prepared 60 returns"]), role("Acme Health", "Intern", "2026", ["Recorded 120 entries"])] }, {}, today);
    expect(kit.about).toContain("At the NC State VITA Program, I prepared 60 returns.");
    expect(kit.about).toContain("At Acme Health, I recorded 120 entries.");
  });

  it("uses the latest role once school is over, and trims a long headline", () => {
    const graduated = buildLinkedInKit(base, { targetRoles: ["x".repeat(200)], gradDate: "2025-05" }, today);
    expect(graduated.headline.startsWith("Staff Accountant Intern at Acme Health")).toBe(true);
    expect(graduated.headline.length).toBeLessThanOrEqual(LINKEDIN_LIMITS.headline);
    expect(graduated.about).toContain("I studied Accounting at State University.");
  });
});

describe("lines that aren't for a LinkedIn description", () => {
  const agent = role("Bankers Life", "Insurance Agent", "Apr 2026 to Present", [
    "Was a insurance agent.",
    "Logged my data in a CRM.",
    "Volume: 40 a month (Bankers Life)",
    "Tools used (Bankers Life): Excel,quickbooks",
    "Explained features, advantages, and disadvantages of insurance policies to prospective customers",
  ]);
  const kit = buildLinkedInKit({ ...base, roles: [agent] }, { gradDate: "2027-05" }, today);

  it("leaves out follow-up notes and a restated title, and keeps real lines", () => {
    expect(isProfileLine("Volume: 40 a month (Bankers Life)")).toBe(false);
    expect(isProfileLine("Tools used (Bankers Life): Excel,quickbooks")).toBe(false);
    expect(isProfileLine("Was a insurance agent.")).toBe(false);
    expect(isProfileLine("Logged my data in a CRM.")).toBe(true);
    expect(kit.roles[0].description).not.toMatch(/Volume:|Tools used|Was a insurance/);
    expect(kit.roles[0].bullets).toBe(2);
  });

  it("leads the About with the strongest line, not the first one", () => {
    expect(kit.about).toContain("At Bankers Life, I explained features, advantages, and disadvantages");
  });
});
