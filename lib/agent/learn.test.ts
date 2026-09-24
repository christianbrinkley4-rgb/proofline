import { describe, expect, it } from "vitest";
import { dealBreakerMatches, suggestPreferences, type Dismissal } from "./learn";

const d = (overrides: Partial<Dismissal>): Dismissal => ({ reason: null, company: "Acme", title: "Accounting Intern", mode: "hybrid", location: "Raleigh, NC", payMax: null, payPeriod: null, ...overrides });
const profile = { workModes: [] as Array<"remote" | "hybrid" | "onsite">, payFloor: null, dealBreakers: [] as string[], targetRoles: ["Accounting intern"] };

describe("suggestPreferences", () => {
  it("notices a run of on-site dismissals", () => {
    const [s] = suggestPreferences([d({ mode: "onsite" }), d({ mode: "onsite" }), d({ mode: "onsite" }), d({ mode: "remote" })], profile, new Set());
    expect(s).toMatchObject({ key: "mode:no-onsite", patch: { workModes: ["remote", "hybrid"] } });
    expect(s.because).toContain("3 on-site");
  });

  it("doesn't ask when the pattern is weak or already set", () => {
    expect(suggestPreferences([d({ mode: "onsite" }), d({ mode: "onsite" })], profile, new Set())).toEqual([]);
    const remoteOnly = { ...profile, workModes: ["remote" as const] };
    expect(suggestPreferences([d({ mode: "onsite" }), d({ mode: "onsite" }), d({ mode: "onsite" })], remoteOnly, new Set())).toEqual([]);
  });

  it("never asks the same thing twice", () => {
    const three = [d({ mode: "onsite" }), d({ mode: "onsite" }), d({ mode: "onsite" })];
    expect(suggestPreferences(three, profile, new Set(["mode:no-onsite"]))).toEqual([]);
  });

  it("suggests a pay floor just above what was turned down", () => {
    const [s] = suggestPreferences([d({ reason: "Pay too low", payMax: 17, payPeriod: "hour" }), d({ reason: "Pay too low", payMax: 18.5, payPeriod: "hour" })], profile, new Set());
    expect(s).toMatchObject({ key: "pay:20", patch: { payFloor: 20 } });
  });

  it("offers to hide a company and a kind of role", () => {
    const out = suggestPreferences(
      [
        d({ reason: "Not interested in this company", company: "Walmart" }),
        d({ reason: "Wrong kind of role", title: "Sales Development Intern" }),
        d({ reason: "Wrong kind of role", title: "Inside Sales Intern" }),
      ],
      profile,
      new Set(),
    );
    expect(out.map((s) => s.key)).toEqual(["company:walmart", "title:sales"]);
    expect(out[0].patch.dealBreakers).toEqual(["company:Walmart"]);
  });
});

describe("dealBreakerMatches", () => {
  const job = { company: "Walmart", title: "Finance Intern", description: "This is an unpaid internship. Must be willing to relocate." };
  it("matches companies, onboarding choices in the posting, and title words", () => {
    expect(dealBreakerMatches(["company:walmart"], job)).toBe(true);
    expect(dealBreakerMatches(["Unpaid"], job)).toBe(true);
    expect(dealBreakerMatches(["Relocation"], job)).toBe(true);
    expect(dealBreakerMatches(["sales"], { company: "Acme", title: "Sales Intern" })).toBe(true);
  });
  it("leaves other jobs alone", () => {
    expect(dealBreakerMatches(["company:walmart", "Unpaid", "sales"], { company: "Acme", title: "Tax Intern", description: "Paid, $25/hr." })).toBe(false);
    expect(dealBreakerMatches(["Commission only"], { company: "Acme", title: "Intern", description: "No commission." })).toBe(false);
  });
});
