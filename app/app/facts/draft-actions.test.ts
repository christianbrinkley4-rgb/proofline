import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireSession: vi.fn(async () => ({ user: { id: "user-1" } })) }));
vi.mock("@/lib/facts/base", () => ({
  addBulletFact: vi.fn(async (_userId: string, _exp: unknown, text: string) => ({ fact: { id: "fact-1", content: text } })),
  deleteFact: vi.fn(),
}));
vi.mock("@/lib/kb/experiences", () => ({
  getExperience: vi.fn(async () => ({ id: "11111111-1111-4111-8111-111111111111", kind: "work", archivedAt: null })),
  updateExperience: vi.fn(),
}));

import { addBulletFact } from "@/lib/facts/base";
import { keepLineAction } from "./draft-actions";

const ROLE = "11111111-1111-4111-8111-111111111111";
const DESCRIPTION = "I worked the register, about 50 customers a shift.";

beforeEach(() => vi.mocked(addBulletFact).mockClear());

describe("keepLineAction", () => {
  it("saves a kept draft whose numbers all came from the description", async () => {
    const result = await keepLineAction({ experienceId: ROLE, text: "Operated the cash register for about 50 customers a shift", origin: "draft", sources: [DESCRIPTION], confirmed: true });
    expect(result).toEqual({ ok: true, factId: "fact-1", text: "Operated the cash register for about 50 customers a shift" });
    expect(addBulletFact).toHaveBeenCalledTimes(1);
  });

  it("refuses a kept draft with a number the person never typed", async () => {
    const result = await keepLineAction({ experienceId: ROLE, text: "Operated the cash register for about 80 customers a shift", origin: "draft", sources: [DESCRIPTION], confirmed: true });
    expect(result.ok).toBe(false);
    expect(addBulletFact).not.toHaveBeenCalled();
  });

  it("accepts a number from their answer to the follow-up question", async () => {
    const result = await keepLineAction({ experienceId: ROLE, text: "Answered about 40 phone calls a shift", origin: "draft", sources: ["Answered phone calls", "about 40 a shift"], confirmed: true });
    expect(result.ok).toBe(true);
  });

  it("lets an edited line carry their own numbers, and turns dashes into commas", async () => {
    const result = await keepLineAction({ experienceId: ROLE, text: `Trained 3 new hires ${String.fromCharCode(0x2014)} on returns`, origin: "edited", sources: [], confirmed: true });
    expect(result).toEqual({ ok: true, factId: "fact-1", text: "Trained 3 new hires, on returns" });
  });

  it("saves nothing without the confirmation that Keep or Save sends", async () => {
    const result = await keepLineAction({ experienceId: ROLE, text: "Restocked shelves", origin: "draft", sources: ["Restocked shelves"], confirmed: false as unknown as true });
    expect(result.ok).toBe(false);
    expect(addBulletFact).not.toHaveBeenCalled();
  });
});
