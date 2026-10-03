import { beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  app: { id: "app", userId: "owner", jobId: "job", company: "Meridian", title: "Analyst", stage: "saved", appliedAt: null, followUpSentAt: null } as Record<string, unknown>,
  why: "I want to work on the reporting described in this role.",
  facts: ["Built an Excel report for 40 accounts each month."],
  contact: { name: "Avery Morgan", role: "Recruiter", email: "avery@meridian.test", quote: "Recruiter: Avery Morgan, avery@meridian.test", sourceUrl: "https://meridian.test/jobs/1", verifiedAt: "2026-10-02T00:00:00.000Z" } as Record<string, string> | null,
  documents: [] as Array<Record<string, unknown>>,
  delivery: vi.fn(), review: vi.fn(), prediction: vi.fn(),
}));
vi.mock("@/lib/tracker/service", () => ({ getApplication: async (userId: string, id: string) => userId === "owner" && id === "app" ? { ...fixture.app } : null }));
vi.mock("@/lib/db", async () => ({ schema: await import("@/lib/db/schema"), db: { query: { user: { findFirst: async () => ({ id: "owner", name: "Sam Tester", email: "sam@candidate.test" }) } }, update: () => ({ set: (patch: Record<string, unknown>) => ({ where: async () => Object.assign(fixture.app, patch) }) }) } }));
vi.mock("@/lib/packet/service", () => ({ getPacket: async () => ({ why: fixture.why }), saveWhy: async (_u: string, _j: string, why: string) => { fixture.why = why; }, loadPacketContext: async () => ({ job: { description: "Excel reporting role at Meridian", source: "link", sourceId: "posting", url: "https://meridian.test/jobs/1" }, factText: new Map(fixture.facts.map((s, i) => [String(i), s])), evidence: [{ factIds: ["0"] }] }) }));
vi.mock("./contact", () => ({ discoverContact: async () => ({ contact: fixture.contact, reason: fixture.contact ? null : "No verified contact. No identity was guessed." }) }));
vi.mock("./email", () => ({ deliverMessage: fixture.delivery }));
vi.mock("@/lib/review/consensus", () => ({ reviewByConsensus: fixture.review }));
vi.mock("@/lib/interviews/service", () => ({ recordGatePrediction: fixture.prediction }));
vi.mock("@/lib/interviews/mongo", () => {
  const field = (doc: Record<string, unknown>, key: string) => key.split(".").reduce<unknown>((v, k) => (v as Record<string, unknown>)?.[k], doc);
  const matches = (doc: Record<string, unknown>, filter: Record<string, unknown>): boolean => Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === "object" && "$not" in value) return !(field(doc, key) as Array<Record<string, unknown>>).some((item) => matches(item, ((value as { $not: { $elemMatch: Record<string, unknown> } }).$not.$elemMatch)));
    return value === null ? field(doc, key) == null : field(doc, key) === value;
  });
  const change = (row: Record<string, unknown>, update: { $set?: Record<string, unknown>; $push?: Record<string, unknown> }) => { Object.assign(row, update.$set); for (const [k, v] of Object.entries(update.$push ?? {})) (row[k] as unknown[]).push(v); };
  const collection = {
    find: (filter: Record<string, unknown>) => ({ toArray: async () => structuredClone(fixture.documents.filter((row) => matches(row, filter))) }),
    findOne: async (filter: Record<string, unknown>) => structuredClone(fixture.documents.find((row) => matches(row, filter)) ?? null),
    insertOne: async (row: Record<string, unknown>) => { fixture.documents.push(structuredClone(row)); return { acknowledged: true }; },
    updateOne: async (filter: Record<string, unknown>, update: Record<string, unknown>) => { const row = fixture.documents.find((r) => matches(r, filter)); if (row) change(row, update); return { matchedCount: row ? 1 : 0 }; },
    findOneAndUpdate: async (filter: Record<string, unknown>, update: Record<string, unknown>) => { const row = fixture.documents.find((r) => matches(r, filter)); if (!row) return null; change(row, update); return structuredClone(row); },
  };
  return { atlasConfigured: () => true, atlas: async () => ({ collection: () => collection }) };
});
import { loadRelationshipLanes, prepareRelationship, prepareSubmittedFollowUp, sendRelationship } from "./service";
beforeEach(() => {
  fixture.documents.length = 0; fixture.why = "I want to work on the reporting described in this role."; fixture.facts = ["Built an Excel report for 40 accounts each month."];
  fixture.contact = { name: "Avery Morgan", role: "Recruiter", email: "avery@meridian.test", quote: "Recruiter: Avery Morgan, avery@meridian.test", sourceUrl: "https://meridian.test/jobs/1", verifiedAt: "2026-10-02T00:00:00.000Z" };
  Object.assign(fixture.app, { stage: "saved", appliedAt: null, followUpSentAt: null });
  fixture.delivery.mockReset().mockResolvedValue({ status: "accepted", providerId: "synthetic-provider-receipt" });
  fixture.review.mockReset().mockResolvedValue({ status: "pass", issues: [], model: "synthetic-review", message: "Three completed reviews", reviewers: ["facts", "reader", "complete"].map((reviewer) => ({ reviewer, label: reviewer, status: "pass", issues: [], disqualified: null, model: "synthetic-review" })) });
  fixture.prediction.mockReset().mockResolvedValue({ id: "prediction", applicationId: "app", probability: 32, reasoning: "For: confirmed example; against: competition unknown.", version: "test", gate: "outreach", fingerprint: "test", at: new Date().toISOString() });
  vi.stubEnv("RESEND_API_KEY", "synthetic-test-key"); vi.stubEnv("EMAIL_FROM", "mail@proofline.test");
});
describe("review and send boundary", () => {
  it("saves a three-reviewer draft with prediction and no email side effect", async () => { const lane = await prepareRelationship("owner", "app"); expect(lane.gate?.passed).toBe(true); expect(lane.gate?.model.reviewers).toHaveLength(3); expect(fixture.prediction).toHaveBeenCalledOnce(); expect(fixture.delivery).not.toHaveBeenCalled(); expect((await loadRelationshipLanes("other"))).toEqual({}); });
  it("keeps no-contact and unfinished reason honest without running reviewers or sending", async () => { fixture.contact = null; expect((await prepareRelationship("owner", "app")).contact).toBeNull(); expect(fixture.review).not.toHaveBeenCalled(); fixture.contact = { name: "Avery Morgan", role: "Recruiter", email: "avery@meridian.test", quote: "source", sourceUrl: "https://meridian.test", verifiedAt: "now" }; fixture.why = ""; expect((await prepareRelationship("owner", "app")).gate?.passed).toBe(false); expect(fixture.delivery).not.toHaveBeenCalled(); });
  it("rejects cross-account access and a forged gate receipt", async () => { const lane = await prepareRelationship("owner", "app"); await expect(sendRelationship("other", "app", "outreach", lane.gate!.fingerprint)).rejects.toThrow("posting"); await expect(sendRelationship("owner", "app", "outreach", "forged")).rejects.toThrow("passing draft"); expect(fixture.delivery).not.toHaveBeenCalled(); });
  it("rejects changed confirmed facts and changed source identity", async () => { const lane = await prepareRelationship("owner", "app"); fixture.facts.push("A newly confirmed fact."); await expect(sendRelationship("owner", "app", "outreach", lane.gate!.fingerprint)).rejects.toThrow("changed"); fixture.facts.pop(); fixture.contact!.email = "another@meridian.test"; await expect(sendRelationship("owner", "app", "outreach", lane.gate!.fingerprint)).rejects.toThrow("contact source changed"); expect(fixture.delivery).not.toHaveBeenCalled(); });
  it("allows one concurrent send, retains exact provider receipt, and rejects repeat sends", async () => { const lane = await prepareRelationship("owner", "app"); const results = await Promise.allSettled([sendRelationship("owner", "app", "outreach", lane.gate!.fingerprint), sendRelationship("owner", "app", "outreach", lane.gate!.fingerprint)]); expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1); expect(fixture.delivery).toHaveBeenCalledOnce(); const saved = (await loadRelationshipLanes("owner")).app; expect(saved.touches[0]).toMatchObject({ to: fixture.contact!.email, body: lane.draft!.body, providerId: "synthetic-provider-receipt" }); await expect(sendRelationship("owner", "app", "outreach", lane.gate!.fingerprint)).rejects.toThrow("already"); });
  it("records no touch on rejection and locks ambiguous sends against duplicate attempts", async () => { const lane = await prepareRelationship("owner", "app"); fixture.delivery.mockResolvedValueOnce({ status: "rejected" }); await expect(sendRelationship("owner", "app", "outreach", lane.gate!.fingerprint)).rejects.toThrow("rejected"); expect((await loadRelationshipLanes("owner")).app.touches).toEqual([]); fixture.delivery.mockResolvedValueOnce({ status: "unconfirmed" }); await expect(sendRelationship("owner", "app", "outreach", lane.gate!.fingerprint)).rejects.toThrow("did not confirm"); await expect(sendRelationship("owner", "app", "outreach", lane.gate!.fingerprint)).rejects.toThrow("awaiting confirmation"); expect(fixture.delivery).toHaveBeenCalledTimes(2); });
  it("prepares a gated follow-up at submission, blocks early send, and sends at day 14", async () => { Object.assign(fixture.app, { appliedAt: new Date(), stage: "applied" }); await prepareSubmittedFollowUp("owner", "app"); let lane = (await loadRelationshipLanes("owner")).app; expect(lane.followUpGate?.passed).toBe(true); await expect(sendRelationship("owner", "app", "follow_up", lane.followUpGate!.fingerprint)).rejects.toThrow("not due"); fixture.app.appliedAt = new Date(Date.now() - 14 * 864e5 - 1); const touch = await sendRelationship("owner", "app", "follow_up", lane.followUpGate!.fingerprint); lane = (await loadRelationshipLanes("owner")).app; expect(lane.touches[0].id).toBe(touch.id); expect(fixture.app.followUpSentAt).toBeInstanceOf(Date); });
  it("requires three standing reviewers even if a stored passed boolean is forged", async () => { fixture.review.mockResolvedValue({ status: "pass", issues: [], reviewers: [{ status: "pass" }, { status: "pass" }] }); const lane = await prepareRelationship("owner", "app"); await expect(sendRelationship("owner", "app", "outreach", lane.gate!.fingerprint)).rejects.toThrow("passing draft"); expect(fixture.delivery).not.toHaveBeenCalled(); });
});
