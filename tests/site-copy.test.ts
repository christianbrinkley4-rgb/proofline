import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { EM_DASH, findVoiceIssues } from "@/lib/voice/rules";

// Principle 3 applies to our own site too: no em dashes, no filler words, anywhere users can read.

const ROOT = join(__dirname, "..");
const COPY_DIRS = ["app", "components/marketing", "components/brand", "components/coach", "components/check", "components/app", "components/find", "components/packet/answer-kit.tsx", "extension/kit-fill.js", "extension/popup.js", "lib/packet/kit.ts", "lib/jobs/feed/rank.ts", "components/profile/role-recall.tsx", "components/facts", "components/jobs", "components/onboarding", "components/tracker", "components/packet", "components/settings", "lib/resume/draft-bullets.ts", "lib/review/gate.ts", "lib/review/model.ts", "lib/resume/recall-wording.ts", "lib/resume/recall-xyz.ts", "lib/demo", "lib/guides", "lib/site.ts", "lib/agent/coach.ts", "lib/agent/next-moves.ts", "lib/jobs/widen.ts"];

function sourceFiles(path: string): string[] {
  const full = join(ROOT, path);
  if (statSync(full).isFile()) return [full];
  return readdirSync(full).flatMap((name) => {
    const child = join(path, name);
    if (statSync(join(ROOT, child)).isDirectory()) return sourceFiles(child);
    return /\.(tsx?|css)$/.test(name) && !name.endsWith(".test.ts") ? [join(ROOT, child)] : [];
  });
}

describe("site copy", () => {
  const files = COPY_DIRS.flatMap(sourceFiles);

  it("finds the files it is meant to check", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((f) => [relative(ROOT, f).replaceAll("\\", "/"), f]))("%s follows the voice rules", (_name, file) => {
    const issues = findVoiceIssues(readFileSync(file, "utf8")).map((i) => `${i.rule}: "${i.match}"`);
    expect(issues).toEqual([]);
  });
});

// No em dashes anywhere in the source, comments included. Tests may hold one as a sample to catch.
describe("no em dashes in source", () => {
  const files = ["app", "components", "lib", "extension", "scripts"].flatMap(sourceFiles).filter((f) => !/\.test\.tsx?$/.test(f));

  it.each(files.map((f) => [relative(ROOT, f).replaceAll("\\", "/"), f]))("%s has none", (_name, file) => {
    expect(readFileSync(file, "utf8").includes(EM_DASH)).toBe(false);
  });
});
