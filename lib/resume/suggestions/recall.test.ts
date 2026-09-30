import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db, dbReady, schema } from "@/lib/db";
import { saveRole, loadFactBase } from "@/lib/facts/base";
import { listFacts } from "@/lib/kb/facts";
import { listBullets } from "@/lib/resume/bullets/service";
import { onetTasksForTitle, recallCatalogSize } from "@/lib/resume/onet-tasks";
import catalog from "@/lib/resume/onet-catalog.json";
import { sameRecallWork } from "@/lib/resume/recall-discovery";
import { composeRecallXyz } from "@/lib/resume/recall-xyz";
import { answerSuggestion, nextSuggestions, reviewSuggestion, type AnswerInput } from "./service";
import { tailorResume } from "@/lib/resume/tailor";
import { parseRequirements } from "@/lib/fit/requirements";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

beforeAll(async () => { await dbReady; }, 60_000);
async function student() {
  const id = randomUUID();
  await db.insert(schema.user).values({ id, name: "Recall test", email: `${id}@example.invalid` });
  return id;
}
async function role(userId: string, bullets: string[] = []) {
  return saveRole(userId, { kind: "work", org: "City Clinic", title: "Front Desk", startDate: "2024-01", endDate: "2024-06", bullets });
}

async function reviewedAnswer(userId: string, id: string, input: AnswerInput) {
  if (!input.xyz || !input.editedText) return answerSuggestion(userId, id, input);
  const review = await reviewSuggestion(userId, id, { editedText: input.editedText, xyz: input.xyz });
  if (!review.ok) throw new Error(review.error);
  return answerSuggestion(userId, id, { ...input, reviewId: review.reviewId, reviewedText: review.text });
}

describe("common-duty recall", () => {
  it("draws from thousands of distinct common duties, not repeated wording variants", () => {
    const bank = recallCatalogSize();
    expect(bank.occupations).toBeGreaterThanOrEqual(1000);
    expect(bank.tasks).toBe(18838);
    expect(bank.coreTasks).toBe(14071);
    expect(bank.distinctDuties).toBeGreaterThan(3000);
  });

  it("keeps legacy bank cards separate from required XYZ recall cards", async () => {
    const userId = await student();
    const exp = await role(userId);
    const [legacy] = await nextSuggestions(userId, exp.id, 1, "bank");
    const [recall] = await nextSuggestions(userId, exp.id, 1, "recall");
    expect(recall.promptVersion).toBe("role-recall.v3");
    expect(recall.id).not.toBe(legacy.id);
    const legacyCards = await nextSuggestions(userId, exp.id, 10, "bank");
    expect(legacyCards.some((item) => item.id === recall.id)).toBe(false);
  });

  it("cannot accept an unchecked confirmation, missing answers, or an unreviewed line, and leaves the card pending", async () => {
    const userId = await student();
    const exp = await role(userId);
    const [card] = await nextSuggestions(userId, exp.id, 1, "recall");
    const before = (await listFacts(userId)).length;
    await expect(answerSuggestion(userId, card.id, { answer: "yes", editedText: "Scheduled appointments" })).rejects.toThrow(/Confirm/);
    await expect(answerSuggestion(userId, card.id, { answer: "yes", confirmed: true, editedText: "Scheduled appointments" })).rejects.toThrow(/Describe what you did/);
    await expect(answerSuggestion(userId, card.id, { answer: "yes", confirmed: true, editedText: "Scheduled appointments", xyz: { measure: "20 each week", method: "" } })).rejects.toThrow(/Review the finished wording/);
    expect(await reviewSuggestion(userId, card.id, { editedText: " ", xyz: { measure: "", method: "" } }).catch((error: Error) => error.message)).toMatch(/Describe what you did/);
    expect((await listFacts(userId)).length).toBe(before);
    expect((await nextSuggestions(userId, exp.id, 1, "recall"))[0].id).toBe(card.id);
  });

  it("saves a true line with no number or method, exactly as reviewed, without adding either", async () => {
    vi.stubEnv("PROOFLINE_REVIEW_KEY", "");
    const userId = await student();
    const exp = await role(userId);
    const [card] = await nextSuggestions(userId, exp.id, 1, "recall");
    const result = await reviewedAnswer(userId, card.id, { answer: "yes", confirmed: true, editedText: "Scheduled patient appointments", xyz: { measure: "", method: "" } });
    expect(result.status).toBe("accepted");
    const facts = await listFacts(userId, { experienceId: exp.id });
    expect(facts.some((fact) => fact.content === "Scheduled patient appointments")).toBe(true);
    vi.unstubAllEnvs();
  });

  it("uses core occupational duties and clinic context instead of hotel duties or unrated guesses", () => {
    const tasks = onetTasksForTitle("Front Desk", 180, true, "City Clinic");
    expect(tasks.length).toBeGreaterThan(3);
    expect(tasks.every((task) => task.common === true)).toBe(true);
    const hotel = catalog.occupations.find((occupation) => occupation.title === "Hotel, Motel, and Resort Desk Clerks")!;
    expect(tasks.some((task) => task.id.startsWith(`onet:${hotel.code}:`))).toBe(false);
    for (const title of ["Bookkeeping assistant", "Cashier", "Electrician"]) {
      const tasks = onetTasksForTitle(title, 180, true);
      expect(tasks.length).toBeGreaterThan(0);
      for (const task of tasks) {
        const [, code, id] = task.id.split(":");
        expect(catalog.occupations.find((occupation) => occupation.code === code)?.tasks.find((item) => item.id === Number(id))?.core).toBe(true);
      }
    }
    const cashier = onetTasksForTitle("Cashier", 180, true);
    const gaming = new Set(catalog.occupations.filter((occupation) => /gambling|gaming/i.test(occupation.title)).map((occupation) => occupation.code));
    expect(cashier.some((task) => gaming.has(task.id.split(":")[1]))).toBe(false);
    expect(onetTasksForTitle("Assistant", 180, true)).toEqual([]);
  });

  it("turns receptionist duties into short memory cues without institutional wording or invented numbers", () => {
    const tasks = onetTasksForTitle("Receptionist", 180, true);
    expect(tasks.some((task) => task.template === "Answered incoming calls and took messages")).toBe(true);
    expect(tasks.some((task) => task.template === "Scheduled appointments and kept the calendar up to date")).toBe(true);
    expect(tasks.every((task) => task.template.length <= 140 && !/\d|establishment|facsimile|telephone switchboard/i.test(task.template))).toBe(true);
  });

  it("starts with only a role, persists the unanswered card, rejects without facts, and advances", async () => {
    const userId = await student();
    const exp = await role(userId);
    const before = (await listFacts(userId)).length;
    const [first] = await nextSuggestions(userId, exp.id, 1, "recall");
    expect(first.taskId).toMatch(/^onet:/);
    expect((await nextSuggestions(userId, exp.id, 1, "recall"))[0].id).toBe(first.id);
    expect((await listFacts(userId)).length).toBe(before);
    await answerSuggestion(userId, first.id, { answer: "no", reason: "not_true" });
    const [second] = await nextSuggestions(userId, exp.id, 1, "recall");
    expect(second.id).not.toBe(first.id);
    expect((await listFacts(userId)).length).toBe(before);
    expect(await listBullets(userId, [exp.id])).toHaveLength(0);
    await expect(nextSuggestions(await student(), exp.id, 1, "recall")).rejects.toThrow(/not found/i);
  });

  it("keeps edited numbers, stores a usable sourced line, then discovers another task", async () => {
    const userId = await student();
    const exp = await role(userId);
    const [first] = await nextSuggestions(userId, exp.id, 1, "recall");
    const action = "Scheduled patient appointments";
    const xyz = { measure: "25 appointments each week", method: "using the clinic calendar" };
    const line = "Scheduled 25 patient appointments each week using the clinic calendar";
    const result = await reviewedAnswer(userId, first.id, { answer: "yes", confirmed: true, editedText: action, xyz });
    const base = await loadFactBase(userId);
    expect(base.roles[0].bullets.map((fact) => fact.text)).toContain(line);
    expect((await listBullets(userId, [exp.id])).find((bullet) => bullet.id === result.bulletId)?.text).toBe(line);
    const [next] = await nextSuggestions(userId, exp.id, 1, "recall");
    expect(next.taskId).toMatch(/^onet:/);
    expect(next.text).not.toContain(line);
    expect(sameRecallWork(next.text, action)).toBe(false);
    expect(next.xyzDefaults).toBeUndefined();
    expect(next.sourceFactIds).toEqual([]);
    expect((await nextSuggestions(userId, exp.id, 10, "recall")).some((item) => item.id === first.id || item.taskId?.startsWith("fact:"))).toBe(false);
  });

  it("excludes existing imported tasks and old pending follow-ups without deleting the facts", async () => {
    const userId = await student();
    const exp = await role(userId, ["Scheduled appointments for 3 dentists"]);
    const saved = (await listFacts(userId, { experienceId: exp.id })).find((fact) => fact.content.includes("3 dentists"))!;
    const [old] = await db.insert(schema.bulletSuggestion).values({
      userId, experienceId: exp.id, text: saved.content + ", resulting in [what changed?]",
      taskId: `fact:${saved.id}:result`, kind: "reframe", sourceFactIds: [saved.id], slot: "what changed?",
      batch: 1, generator: "offline", promptVersion: "role-recall.v2",
    }).returning();
    const before = (await listFacts(userId)).length;
    const cards = await nextSuggestions(userId, exp.id, 10, "recall");
    expect(cards.length).toBeGreaterThan(2);
    expect(cards.every((card) => card.taskId?.startsWith("onet:") && card.id !== old.id && !sameRecallWork(card.text, saved.content))).toBe(true);
    expect((await listFacts(userId)).length).toBe(before);
    expect(await reviewSuggestion(userId, old.id, { editedText: saved.content, xyz: { measure: "weekly", method: "calendar", result: "fewer errors" } })).toMatchObject({ ok: false, error: expect.stringContaining("out of date") });
    await expect(answerSuggestion(userId, old.id, { answer: "yes", confirmed: true, editedText: saved.content, xyz: { measure: "weekly", method: "calendar", result: "fewer errors" } })).rejects.toThrow(/repeats saved work/);
    expect((await listFacts(userId)).length).toBe(before);
  });

  it("uses confirmed project work to discover related tasks and excludes the saved activity", async () => {
    const userId = await student();
    const exp = await saveRole(userId, { kind: "project", org: "Command Center CRM", title: "", startDate: "", endDate: "", bullets: ["Built a CRM application using Python to track client follow-ups"] });
    const cards = await nextSuggestions(userId, exp.id, 10, "recall");
    expect(cards.length).toBeGreaterThan(2);
    expect(cards.every((card) => card.taskId?.startsWith("onet:") && card.sourceFactIds.length === 0 && !sameRecallWork(card.text, "Built a CRM application using Python to track client follow-ups"))).toBe(true);
  });

  it("stores the fluent preview with raw parts and does not ask again for a supplied result", async () => {
    const userId = await student();
    const exp = await role(userId);
    const [card] = await nextSuggestions(userId, exp.id, 1, "recall");
    const raw = { action: "I reconcile accounts", measure: "daily", method: "Excel", result: "it saved about 3 hours each week" };
    const accepted = await reviewedAnswer(userId, card.id, { answer: "yes", confirmed: true, editedText: raw.action, xyz: raw });
    const text = "Saved about 3 hours each week by reconciling accounts daily using Excel";
    const bullet = (await listBullets(userId, [exp.id])).find((item) => item.id === accepted.bulletId)!;
    expect(bullet.text).toBe(text);
    const fact = (await listFacts(userId)).find((item) => bullet.factIds.includes(item.id))!;
    expect(fact.content).toBe(text);
    expect(fact.data?.recallXyz).toEqual(raw);
    const next = await nextSuggestions(userId, exp.id, 10, "recall");
    expect(next.some((item) => item.taskId === `fact:${fact.id}:result`)).toBe(false);
  });

  it("rejects a stale or mismatched preview before creating a confirmed fact", async () => {
    const userId = await student();
    const exp = await role(userId);
    const [card] = await nextSuggestions(userId, exp.id, 1, "recall");
    const before = (await listFacts(userId)).length;
    const input = { answer: "yes" as const, confirmed: true, editedText: "Scheduled appointments", xyz: { measure: "25 each week", method: "the calendar" } };
    await expect(answerSuggestion(userId, card.id, { ...input, reviewedText: composeRecallXyz(input.editedText, input.xyz) })).rejects.toThrow(/wording review changed/);
    const review = await reviewSuggestion(userId, card.id, input);
    if (!review.ok) throw new Error(review.error);
    for (const reviewedText of [undefined, "Scheduled 50 appointments each week using the calendar"]) await expect(answerSuggestion(userId, card.id, { ...input, reviewId: review.reviewId, reviewedText })).rejects.toThrow(/preview changed/);
    expect((await listFacts(userId)).length).toBe(before);
    expect((await nextSuggestions(userId, exp.id, 1, "recall"))[0].id).toBe(card.id);
  });

  it("reviews without saving evidence, caches unchanged answers, and rejects changed, expired, or cross-account receipts", async () => {
    const userId = await student();
    const exp = await role(userId);
    const [card] = await nextSuggestions(userId, exp.id, 1, "recall");
    const input = { answer: "yes" as const, confirmed: true, editedText: "Scheduled appointments", xyz: { measure: "25 each week", method: "the calendar" } };
    const before = (await listFacts(userId)).length;
    const review = await reviewSuggestion(userId, card.id, input);
    if (!review.ok) throw new Error(review.error);
    expect((await listFacts(userId)).length).toBe(before);
    expect(await listBullets(userId, [exp.id])).toHaveLength(0);
    expect(await reviewSuggestion(userId, card.id, input)).toMatchObject({ ok: true, reviewId: review.reviewId });
    const accepted = { ...input, reviewId: review.reviewId, reviewedText: review.text };
    await expect(answerSuggestion(userId, card.id, { ...accepted, xyz: { ...input.xyz, measure: "35 each week" } })).rejects.toThrow(/wording review changed/);
    await expect(answerSuggestion(userId, card.id, { ...accepted, confirmed: false })).rejects.toThrow(/Confirm/);
    const otherId = await student();
    const otherExp = await role(otherId);
    const [otherCard] = await nextSuggestions(otherId, otherExp.id, 1, "recall");
    await expect(answerSuggestion(otherId, otherCard.id, accepted)).rejects.toThrow(/wording review changed/);
    const secondExp = await role(userId);
    const [secondCard] = await nextSuggestions(userId, secondExp.id, 1, "recall");
    await expect(answerSuggestion(userId, secondCard.id, accepted)).rejects.toThrow(/wording review changed/);
    const { eq } = await import("drizzle-orm");
    await db.update(schema.agentEvent).set({ createdAt: new Date(Date.now() - 31 * 60_000) }).where(eq(schema.agentEvent.id, review.reviewId));
    await expect(answerSuggestion(userId, card.id, accepted)).rejects.toThrow(/wording review changed/);
    expect((await listFacts(userId)).length).toBe(before + (await listFacts(userId, { experienceId: secondExp.id })).length);
  });

  it("preserves the pending card on 402 and saves basic wording only after exact confirmation", async () => {
    const userId = await student();
    const exp = await role(userId);
    const [card] = await nextSuggestions(userId, exp.id, 1, "recall");
    const input = { editedText: "Scheduled appointments", xyz: { measure: "25 each week", method: "the calendar" } };
    const before = (await listFacts(userId)).length;
    vi.stubEnv("PROOFLINE_REVIEW_KEY", "synthetic-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi.fn().mockResolvedValue(new Response("billing unavailable", { status: 402 }));
    vi.stubGlobal("fetch", fetch);
    expect(await reviewSuggestion(userId, card.id, input)).toMatchObject({ ok: false, fallbackAvailable: true });
    expect((await listFacts(userId)).length).toBe(before);
    expect(await listBullets(userId, [exp.id])).toHaveLength(0);
    expect((await nextSuggestions(userId, exp.id, 1, "recall"))[0].id).toBe(card.id);
    const review = await reviewSuggestion(userId, card.id, { ...input, mode: "rules" });
    if (!review.ok) throw new Error(review.error);
    expect(review.method).toBe("rules");
    expect((await listFacts(userId)).length).toBe(before);
    expect(fetch).toHaveBeenCalledTimes(1);
    const accepted = { ...input, answer: "yes" as const, reviewId: review.reviewId, reviewedText: review.text };
    await expect(answerSuggestion(userId, card.id, { ...accepted, confirmed: false })).rejects.toThrow(/Confirm/);
    await expect(answerSuggestion(userId, card.id, { ...accepted, confirmed: true, reviewedText: "Different text" })).rejects.toThrow(/preview changed/);
    const result = await answerSuggestion(userId, card.id, { ...accepted, confirmed: true });
    expect((await listBullets(userId, [exp.id])).find((line) => line.id === result.bulletId)?.text).toBe(review.text);
  });

  it("does not reuse a cached basic check as a successful AI review", async () => {
    const userId = await student();
    const exp = await role(userId);
    const [card] = await nextSuggestions(userId, exp.id, 1, "recall");
    const input = { editedText: "Scheduled appointments", xyz: { measure: "25 each week", method: "the calendar" } };
    vi.stubEnv("PROOFLINE_REVIEW_KEY", "synthetic-key");
    const basic = await reviewSuggestion(userId, card.id, { ...input, mode: "rules" });
    if (!basic.ok) throw new Error(basic.error);
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ text: basic.text, clarification: "" }) }] } }] })));
    vi.stubGlobal("fetch", fetch);
    const model = await reviewSuggestion(userId, card.id, input);
    expect(model).toMatchObject({ ok: true, method: "model" });
    expect(model.ok && model.reviewId).not.toBe(basic.reviewId);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await reviewSuggestion(userId, card.id, { ...input, mode: "rules" })).toMatchObject({ reviewId: basic.reviewId, method: "rules" });
  });

  it("keeps a bank over 100 lines and selects a late-added relevant line for the job", async () => {
    const userId = await student();
    const exp = await role(userId);
    const texts = Array.from({ length: 120 }, (_, index) => `Filed ${index + 1} customer forms in the office records`);
    texts.push("Built SQL queries and Excel reports to analyze appointment data");
    const facts = await db.insert(schema.fact).values(texts.map((content) => ({ userId, experienceId: exp.id, category: "experience" as const, content, source: "user_stated" as const, verificationState: "confirmed" as const, confirmedAt: new Date() }))).returning();
    await db.insert(schema.bullet).values(facts.map((fact, index) => ({ userId, experienceId: exp.id, text: fact.content, factIds: [fact.id], status: "active" as const, score: index === 120 ? 50 : 95, generator: "user" })));
    expect((await loadFactBase(userId)).roles[0].bullets).toHaveLength(121);
    expect(await listBullets(userId, [exp.id])).toHaveLength(121);
    const description = "Data analyst internship. Required: SQL, Excel, data analysis, and reporting. Build SQL queries and Excel reports from appointment data.";
    const [job] = await db.insert(schema.job).values({ source: "link", sourceId: randomUUID(), company: "Test Analytics", companySlug: "test-analytics", title: "Data analyst intern", url: "https://example.invalid/job", description, dedupeKey: randomUUID(), requirements: parseRequirements(description) as unknown as Record<string, unknown> }).returning();
    await db.insert(schema.jobMatch).values({ userId, jobId: job.id });
    const resume = await tailorResume(userId, { jobId: job.id, email: "test@example.invalid" });
    const chosen = resume.document.sections.flatMap((section) => section.kind === "entries" ? section.entries.flatMap((entry) => entry.bullets.map((bullet) => bullet.text)) : []);
    expect(chosen.join("\n")).toContain("SQL");
    expect(chosen.length).toBeLessThan(121);
    expect((await listBullets(userId, [exp.id])).length).toBe(121);
  });
});
