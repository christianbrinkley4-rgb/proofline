import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  requireSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));
vi.mock("@/lib/facts/base", () => ({
  saveRole: vi.fn(async () => ({ id: "exp-1" })),
  addListFacts: vi.fn(),
  saveEducation: vi.fn(),
  scoringReady: vi.fn(),
}));
vi.mock("@/lib/kb/profile", () => ({ updateProfile: vi.fn() }));

import { saveRole } from "@/lib/facts/base";
import { importedRoleHasOneLine, linesForRoleForm, roleStepHint } from "@/components/onboarding/role-step";
import { saveRoleStepAction } from "./beta-actions";

const LINE = "Greeted patients and checked them in at the front desk";

const oneLine = {
  kind: "work" as const,
  org: "City Clinic",
  title: "Front Desk",
  startDate: "2024-01",
  endDate: "2024-06",
  bullets: [LINE],
  confirmed: true as const,
};

beforeEach(() => {
  vi.mocked(saveRole).mockClear();
});

describe("saveRoleStepAction", () => {
  it("saves an imported role that already has one line, and does not write a second", async () => {
    const result = await saveRoleStepAction({ ...oneLine, importedOneLine: true });

    expect(result).toEqual({ ok: true });
    expect(saveRole).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveRole).mock.calls[0][1].bullets).toEqual([LINE]);
  });

  it("lets a typed role start with one remembered line", async () => {
    const result = await saveRoleStepAction(oneLine);

    expect(result).toEqual({ ok: true });
    expect(vi.mocked(saveRole).mock.calls[0][1].bullets).toEqual([LINE]);
  });

  it("saves a typed role once it has two lines", async () => {
    const second = "Scheduled appointments for 3 dentists";
    const result = await saveRoleStepAction({ ...oneLine, bullets: [LINE, second] });

    expect(result).toEqual({ ok: true });
    expect(vi.mocked(saveRole).mock.calls[0][1].bullets).toEqual([LINE, second]);
  });

  it("allows a role without task lines but still requires explicit confirmation", async () => {
    const empty = await saveRoleStepAction({ ...oneLine, importedOneLine: true, bullets: ["", "ab"] });
    expect(empty).toEqual({ ok: true });
    expect(vi.mocked(saveRole).mock.calls[0][1].bullets).toEqual([]);
    vi.mocked(saveRole).mockClear();

    const unticked = await saveRoleStepAction({ ...oneLine, importedOneLine: true, confirmed: false as unknown as true });
    expect(unticked.ok).toBe(false);
    if (!unticked.ok) expect(unticked.error.toLowerCase()).toContain("confirm");
    expect(saveRole).not.toHaveBeenCalled();
  });

  it("still lets a project stay at one line", async () => {
    const result = await saveRoleStepAction({
      ...oneLine,
      kind: "project",
      title: "",
      startDate: "",
      bullets: ["Built a budget tracker for the club"],
    });

    expect(result).toEqual({ ok: true });
    expect(vi.mocked(saveRole).mock.calls[0][1].bullets).toEqual(["Built a budget tracker for the club"]);
  });
});

describe("imported one-line form", () => {
  it("treats one real resume line as enough, and a typed role as not", () => {
    expect(importedRoleHasOneLine("work", [LINE])).toBe(true);
    expect(importedRoleHasOneLine("leadership", [LINE, "Led weekly meetings"])).toBe(false);
    expect(importedRoleHasOneLine("project", [LINE])).toBe(false);
    expect(importedRoleHasOneLine("work", ["ab"])).toBe(false);
  });

  it("does not add a blank second line for an imported one-line role", () => {
    expect(linesForRoleForm([LINE], false, true)).toEqual([LINE]);
    expect(linesForRoleForm([LINE], false, false)).toEqual([LINE, ""]);
  });

  it("tells an imported one-line role it can stay at one line", () => {
    expect(roleStepHint(false, true)).toBe("This role came from your resume with one line. You can save that line on its own.");
    expect(roleStepHint(false, false)).toContain("possible tasks");
    expect(roleStepHint(false, true)).not.toContain("2 to 4");
  });
});
