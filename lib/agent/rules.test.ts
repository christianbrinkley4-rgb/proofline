import { beforeAll, describe, expect, it } from "vitest";
import { db, dbReady, schema } from "@/lib/db";
import { dealBreakerMatches } from "./learn";
import { addRule, companyRule, describeRule, listRules, MAX_RULES, removeRule, titleWordRule } from "./rules";

describe("standing rules", () => {
  const userId = "rules-test-user";

  beforeAll(async () => {
    await dbReady;
    await db.insert(schema.user).values({ id: userId, name: "Rules", email: "rules@example.com" }).onConflictDoNothing();
  }, 60_000);

  it("writes an employer rule that the dealbreaker matcher honors, ignoring case", () => {
    const rule = companyRule("  Coinbase ");
    expect(rule).toBe("company:coinbase");
    expect(dealBreakerMatches([rule], { company: "Coinbase", title: "Tax Intern" })).toBe(true);
    expect(dealBreakerMatches([rule], { company: "Coinbase Labs", title: "Tax Intern" })).toBe(false);
  });

  it("accepts plain title words and refuses anything else", () => {
    expect(titleWordRule("  Senior ")).toBe("senior");
    expect(titleWordRule("sales  development")).toBe("sales development");
    expect(titleWordRule("a")).toBeNull();
    expect(titleWordRule("(.*)")).toBeNull();
    expect(titleWordRule("x".repeat(60))).toBeNull();
    expect(dealBreakerMatches(["senior"], { company: "Acme", title: "Senior Accountant" })).toBe(true);
    expect(dealBreakerMatches(["senior"], { company: "Acme", title: "Seniority Review Intern" })).toBe(false);
  });

  it("labels each kind of rule in plain words", () => {
    expect(describeRule("company:coinbase").label).toBe("Jobs at Coinbase");
    expect(describeRule("senior")).toMatchObject({ kind: "title", label: 'Titles with "senior"' });
    expect(describeRule("unpaid")).toMatchObject({ kind: "other", label: 'Postings that say "unpaid"' });
  });

  it("adds a rule once, lists it, and removes it", async () => {
    expect(await addRule(userId, companyRule("Coinbase"))).toEqual({ added: true });
    expect(await addRule(userId, "company:Coinbase")).toEqual({ added: false });
    expect((await listRules(userId)).map((r) => r.label)).toEqual(["Jobs at Coinbase"]);
    await removeRule(userId, "company:coinbase");
    expect(await listRules(userId)).toEqual([]);
    const events = await db.query.agentEvent.findMany({ where: (e, { eq }) => eq(e.userId, userId) });
    expect(events.map((e) => e.type).sort()).toEqual(["rule_added", "rule_removed"]);
  });

  it("stops at the cap instead of growing without limit", async () => {
    for (let i = 0; i < MAX_RULES; i++) await addRule(userId, `word${i}x`);
    await expect(addRule(userId, "one more")).rejects.toThrow(/most standing rules/);
  });
});
