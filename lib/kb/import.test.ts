import { beforeAll, describe, expect, it } from "vitest";
import { db, dbReady, schema } from "@/lib/db";
import { listFacts } from "./facts";
import { importParsedResume } from "./import";
import type { ParsedResume } from "@/lib/resume/parse/types";

const userId = "test-user-import-batch";

const sample: ParsedResume = {
  name: "Alex Student",
  email: null,
  phone: null,
  location: null,
  links: [],
  education: [
    {
      school: "State U",
      degree: "BS",
      major: "Accounting",
      minor: null,
      gradDate: "2027-05",
      gpa: 3.6,
      honors: ["Dean's List"],
      coursework: ["Audit", "Tax"],
    },
  ],
  entries: [
    {
      section: "experience",
      org: "Campus Cafe",
      title: "Barista",
      location: "Campus",
      startDate: "2024-09",
      endDate: null,
      bullets: ["Opened the shop three mornings a week", "Trained two new hires"],
    },
  ],
  skills: ["Excel", "QuickBooks"],
  certifications: ["ServSafe"],
};

beforeAll(async () => {
  await dbReady;
  await db.insert(schema.user).values({ id: userId, name: "Import Batch", email: "import-batch@example.com" }).onConflictDoNothing();
}, 60_000);

describe("importParsedResume", () => {
  it("batches fact inserts and skips duplicates on re-import", async () => {
    const first = await importParsedResume(userId, sample, "resume.pdf");
    expect(first.experiences).toBe(1);
    // 2 bullets + honor + coursework + 2 skills + cert
    expect(first.facts).toBe(7);
    expect(first.skipped).toBe(0);

    const facts = await listFacts(userId, { states: ["unconfirmed", "needs_review", "confirmed"] });
    expect(facts.filter((f) => f.source === "resume_parsed")).toHaveLength(7);
    expect(facts.every((f) => f.verificationState === "unconfirmed")).toBe(true);

    const second = await importParsedResume(userId, sample, "resume.pdf");
    expect(second.experiences).toBe(0);
    expect(second.facts).toBe(0);
    expect(second.skipped).toBe(7);
  });
});
