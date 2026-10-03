import { describe, expect, it } from "vitest";
import { bucketIndex, calibration, interviewPrior, submissionPrediction, type Prediction } from "./model";

describe("interview calibration", () => {
  it.each([[0, 0], [20, 0], [21, 1], [40, 1], [41, 2], [60, 2], [61, 3], [80, 3], [81, 4], [100, 4]])("buckets %s without gaps", (p, bucket) => expect(bucketIndex(p)).toBe(bucket));
  it.each([-1, 101, NaN, Infinity, 20.5])("rejects invalid probability %s", (p) => expect(() => bucketIndex(p)).toThrow());
  it("uses every valid integer exactly once", () => {
    const counts = Array(5).fill(0);
    for (let p = 0; p <= 100; p++) counts[bucketIndex(p)]++;
    expect(counts).toEqual([21, 20, 20, 20, 20]);
  });
  it("compares the same resolved cohort and excludes pending and withdrawn", () => {
    const bucket = calibration([{ applicationId: "a", probability: 25, outcome: "interview" }, { applicationId: "b", probability: 35, outcome: "rejection" }, { applicationId: "c", probability: 40, outcome: null }, { applicationId: "d", probability: 30, outcome: "withdrawn" }])[1];
    expect(bucket).toEqual({ label: "21-40%", count: 4, resolved: 2, pending: 1, withdrawn: 1, interviews: 1, predicted: 30, actual: 50 });
  });
  it("counts explicit no response as a non-interview and does not double count applications", () => {
    const bucket = calibration([{ applicationId: "a", probability: 50, outcome: "rejection" }, { applicationId: "a", probability: 50, outcome: "interview" }, { applicationId: "b", probability: 60, outcome: "no_response" }])[2];
    expect(bucket.count).toBe(2); expect(bucket.actual).toBe(50); expect(bucket.predicted).toBe(55);
  });
  it("shows no rate for an empty or unresolved bucket", () => {
    expect(calibration([]).every((b) => b.actual === null && b.predicted === null)).toBe(true);
    expect(calibration([{ applicationId: "a", probability: 90, outcome: null }])[4].actual).toBeNull();
  });
  it("freezes a pre-submission prediction and ignores follow-ups and later edits", () => {
    const prediction = (id: string, at: string, gate = "resume"): Prediction => ({ id, applicationId: "a", at, gate, fingerprint: id, probability: 30, reasoning: "For: facts; against: competition.", version: "v1" });
    const rows = [prediction("old", "2026-10-01T10:00:00Z"), prediction("submitted", "2026-10-01T11:00:00Z", "outreach"), prediction("late", "2026-10-02T10:00:00Z"), prediction("follow", "2026-10-01T11:30:00Z", "follow_up")];
    expect(submissionPrediction(rows, "a", "2026-10-01T12:00:00Z")?.id).toBe("submitted");
    expect(submissionPrediction(rows, "other", "2026-10-01T12:00:00Z")).toBeNull();
  });
  it("labels the estimate version and keeps uncertainty in its reasoning", () => {
    const prior = interviewPrior({ score: 100, strengths: [], gaps: [], gates: [] });
    expect(prior.probability).toBe(60); expect(prior.reasoning).toContain("unknown"); expect(prior.version).toBe("interview-fit-prior.v1");
  });
});
