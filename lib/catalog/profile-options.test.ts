import { describe, expect, it } from "vitest";
import { searchProfileOptions } from "./profile-options";

describe("profile option search", () => {
  it("finds occupational titles without forcing a fixed role", () => {
    expect(searchProfileOptions("roles", "bookkeep").map((option) => option.value)).toContain("Bookkeeper");
    expect(searchProfileOptions("roles", "clinical data").length).toBeGreaterThan(0);
  });
  it("finds schools by name and location", () => {
    expect(searchProfileOptions("schools", "duke").some((option) => option.value === "Duke University")).toBe(true);
    expect(searchProfileOptions("schools", "Durham, NC").length).toBeGreaterThan(0);
    expect(searchProfileOptions("schools", "d")).toEqual([]);
  });
  it("finds degrees and programs", () => {
    expect(searchProfileOptions("degrees", "applied science").map((option) => option.value)).toContain("Associate in Applied Science");
    expect(searchProfileOptions("fields", "weld").map((option) => option.value)).toContain("Welding");
  });
});
