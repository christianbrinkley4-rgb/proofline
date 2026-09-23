import { describe, expect, it } from "vitest";
import { FIT_COMPONENTS } from "@/lib/fit/rubric";
import { findVoiceIssues, findWeakOpener } from "@/lib/voice/rules";
import { DEMO_EXPERIENCE, DEMO_JOBS, DEMO_LEADERSHIP, FOLLOW_UP_DRAFT, cashReportText, jobFit } from "./sample-data";

// The landing page demo is the first thing people judge us by, so it must follow the product's own rules.

const bullets = [...DEMO_EXPERIENCE, DEMO_LEADERSHIP].flatMap((role) => role.bullets);

describe("demo resume bullets", () => {
  it.each(bullets.map((b) => [b.id, b.text]))("%s opens with a strong verb", (_id, text) => {
    expect(findWeakOpener(text)).toBeNull();
  });

  it.each(bullets.map((b) => [b.id, b.text]))("%s has no em dashes or filler", (_id, text) => {
    expect(findVoiceIssues(text)).toEqual([]);
  });

  it.each(bullets.map((b) => [b.id, b.text]))("%s carries a real number", (_id, text) => {
    expect(text).toMatch(/\d/);
  });

  it("keeps the cash report bullet valid for any confirmed hour count", () => {
    for (const hours of [1, 3, 12]) {
      expect(findWeakOpener(cashReportText(hours))).toBeNull();
      expect(findVoiceIssues(cashReportText(hours))).toEqual([]);
    }
  });

  it("explains every bullet for every job worth tailoring", () => {
    const tailorable = DEMO_JOBS.filter((job) => jobFit(job).cappedBy === null);
    for (const bullet of bullets) {
      for (const job of tailorable) {
        expect(bullet.addresses[job.id], `${bullet.id} for ${job.id}`).toBeTruthy();
      }
    }
  });
});

describe("demo jobs", () => {
  it("covers every rubric component for every job", () => {
    const keys = FIT_COMPONENTS.map((c) => c.key).sort();
    for (const job of DEMO_JOBS) {
      expect(Object.keys(job.points).sort()).toEqual(keys);
      expect(Object.keys(job.details).sort()).toEqual(keys);
    }
  });

  it("lists results best fit first", () => {
    const scores = DEMO_JOBS.map((job) => jobFit(job).score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("shows the gated job capped, with the gate's reason", () => {
    const pellham = DEMO_JOBS.find((j) => j.id === "pellham");
    expect(pellham && jobFit(pellham)).toMatchObject({ score: 40, cappedBy: { cap: 40 } });
  });
});

describe("demo follow-up draft", () => {
  it("reads like a person wrote it", () => {
    expect(findVoiceIssues(FOLLOW_UP_DRAFT.body.join("\n"))).toEqual([]);
  });
});
