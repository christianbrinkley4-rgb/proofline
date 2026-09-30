import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { findVoiceIssues } from "@/lib/voice/rules";

// Principle 3 applies to our own site too: no em dashes, no filler words, anywhere users can read.

const ROOT = join(__dirname, "..");
const COPY_DIRS = ["app", "components/marketing", "components/brand", "components/coach", "components/check", "components/app", "components/find", "components/packet/answer-kit.tsx", "lib/packet/kit.ts", "lib/jobs/feed/rank.ts", "components/profile/role-recall.tsx", "components/profile/recall-measure.tsx", "components/facts/fact-recall.tsx", "lib/resume/recall-wording.ts", "lib/resume/recall-xyz.ts", "lib/demo", "lib/guides", "lib/site.ts", "lib/agent/coach.ts", "lib/agent/next-moves.ts", "lib/jobs/widen.ts"];

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
