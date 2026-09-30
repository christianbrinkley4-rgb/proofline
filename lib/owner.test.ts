import { afterEach, describe, expect, it } from "vitest";
import { isOwner } from "./owner";

describe("owner access", () => {
  afterEach(() => {
    delete process.env.OWNER_EMAILS;
  });

  it("matches listed emails only, ignoring case and spaces", () => {
    process.env.OWNER_EMAILS = " Owner@Example.com , second@example.com";
    expect(isOwner("owner@example.com")).toBe(true);
    expect(isOwner("SECOND@example.com ")).toBe(true);
    expect(isOwner("someone@example.com")).toBe(false);
  });

  it("gives nobody access when the setting is missing or empty", () => {
    expect(isOwner("owner@example.com")).toBe(false);
    process.env.OWNER_EMAILS = " , ";
    expect(isOwner("")).toBe(false);
    expect(isOwner(null)).toBe(false);
  });
});
