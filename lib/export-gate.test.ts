import { describe, expect, it } from "vitest";
import { blockedExportResponse, blockingExportMessage, isBlockingFail, type ExportGateCheck } from "./export-gate";

const resumeFail: ExportGateCheck = {
  id: "facts",
  label: "Source facts are confirmed",
  detail: "2 lines have a claim you haven't confirmed. Confirm or remove it to export.",
  blocking: true,
  status: "fail",
};

const resumeWarn: ExportGateCheck = {
  id: "openers",
  label: "Strong opening verbs",
  detail: "Weak openers: Helped.",
  blocking: false,
  status: "warn",
};

const letterFail: ExportGateCheck = {
  id: "placeholder",
  label: "No unfilled prompts",
  detail: "Replace the bracketed prompt with your own words first.",
  blocking: true,
  ok: false,
};

const letterWarn: ExportGateCheck = {
  id: "voice",
  label: "Sounds like a person",
  detail: "Consider rewording: leverage.",
  blocking: false,
  ok: false,
};

describe("export gate", () => {
  it("treats resume status=fail as blocking and ignores warns", () => {
    expect(isBlockingFail(resumeFail)).toBe(true);
    expect(isBlockingFail(resumeWarn)).toBe(false);
    expect(blockingExportMessage([resumeWarn, resumeFail])).toBe(resumeFail.detail);
  });

  it("treats letter ok=false + blocking as blocking and ignores style warns", () => {
    expect(isBlockingFail(letterFail)).toBe(true);
    expect(isBlockingFail(letterWarn)).toBe(false);
    expect(blockingExportMessage([letterWarn, letterFail])).toBe(letterFail.detail);
  });

  it("returns structured JSON 409 bodies", async () => {
    const res = blockedExportResponse([resumeFail, resumeWarn]);
    expect(res.status).toBe(409);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    await expect(res.json()).resolves.toEqual({ blocked: true, checks: [resumeFail, resumeWarn] });
  });
});
