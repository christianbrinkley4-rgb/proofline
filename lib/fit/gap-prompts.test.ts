import { describe, expect, it } from "vitest";
import { promptsForGaps } from "./gap-prompts";
import type { Gap } from "./gaps";

const gap: Gap = { id: "account-reconciliation", skill: "Account reconciliation", kind: "required", question: "Where have you used account reconciliation?", why: "Required" };
const experience = { id: "bookkeeping", org: "Oakwood Dental", title: "Bookkeeping assistant", kind: "work" };

describe("posting-aware experience prompts", () => {
  it("asks about plausible, missing work at a specific past experience", () => {
    const [result] = promptsForGaps([gap], [experience], [], [], "Reconcile monthly vendor accounts and review account balances");
    expect(result.suggestion).toMatchObject({ experienceId: "bookkeeping", org: "Oakwood Dental", taskId: "books.reconcile" });
    expect(result.question).toBe(gap.question);
  });

  it("does not re-ask work already stated or rejected as untrue", () => {
    const facts = [{ experienceId: "bookkeeping", content: "Reconciled 27 account balances each month" }];
    const [alreadyKnown] = promptsForGaps([gap], [experience], facts, [], "Reconcile monthly accounts");
    expect(alreadyKnown.suggestion?.taskId).not.toBe("books.reconcile");
    const rejected = [{ experienceId: "bookkeeping", taskId: "books.reconcile", reason: "not_true" }];
    const [noAgain] = promptsForGaps([gap], [experience], [], rejected, "Reconcile monthly accounts");
    expect(noAgain.suggestion?.taskId).not.toBe("books.reconcile");
    expect(noAgain.suggestion?.taskId).not.toBe("books.payables");
    expect(noAgain.suggestion).toBeUndefined();
  });

  it("does not suggest an unrelated insurance sales task for a receptionist", () => {
    const insurance: Gap = { id: "insurance-verification", skill: "Insurance verification", kind: "preferred", question: "Have you verified insurance?", why: "Preferred" };
    const [result] = promptsForGaps([insurance], [{ id: "front-desk", org: "Willow Clinic", title: "Receptionist", kind: "work" }], [], [], "Verify patient insurance coverage before appointments");
    expect(result.suggestion).toBeUndefined();
  });
  it("keeps the general gap question when no past role suggests the task", () => {
    const [result] = promptsForGaps([gap], [{ id: "art", org: "Studio", title: "Graphic designer", kind: "work" }], [], [], "Reconcile monthly accounts");
    expect(result.suggestion).toBeUndefined();
  });
});
