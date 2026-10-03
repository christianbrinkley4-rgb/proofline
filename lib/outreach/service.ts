import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { atlas, atlasConfigured } from "@/lib/interviews/mongo";
import { recordGatePrediction } from "@/lib/interviews/service";
import { getApplication } from "@/lib/tracker/service";
import { followUpDue } from "@/lib/tracker/model";
import { getPacket, loadPacketContext, saveWhy } from "@/lib/packet/service";
import { reviewByConsensus } from "@/lib/review/consensus";
import { LETTER_FRAMINGS } from "@/lib/review/framings";
import { changesSince, threeReviewersPassed } from "@/lib/review/receipt";
import { discoverContact } from "./contact";
import { deliverMessage } from "./email";
import { messageChecks, messageDraft, messageFingerprint, type MessageKind, type RelationshipLane, type Touch } from "./model";

type LaneDoc = RelationshipLane & { _id: string; userId: string; attemptId?: string; attemptKind?: MessageKind };
const key = (userId: string, applicationId: string) => `${userId}:${applicationId}`;
function view(row: LaneDoc): RelationshipLane {
  return { applicationId: row.applicationId, contact: row.contact, emptyReason: row.emptyReason, why: row.why, fact: row.fact, name: row.name, draft: row.draft, followUp: row.followUp, gate: row.gate, followUpGate: row.followUpGate, touches: row.touches, sendState: row.sendState };
}
export async function loadRelationshipLanes(userId: string): Promise<Record<string, RelationshipLane>> {
  if (!atlasConfigured()) return {};
  const database = await atlas();
  const rows = await database.collection<LaneDoc>("relationship_lane").find({ userId }).toArray();
  return Object.fromEntries(rows.map((row) => [row.applicationId, view(row)]));
}
async function context(userId: string, applicationId: string) {
  const app = await getApplication(userId, applicationId);
  if (!app?.jobId) throw new Error("Attach an employer posting before preparing outreach.");
  const [ctx, packet, user] = await Promise.all([loadPacketContext(userId, app.jobId), getPacket(userId, app.jobId), db.query.user.findFirst({ where: eq(schema.user.id, userId) })]);
  if (!ctx || !user) throw new Error("Application not found.");
  const facts = [...ctx.factText.values()];
  const evidence = ctx.evidence.find((e) => e.factIds.some((id) => ctx.factText.has(id)));
  const fact = evidence?.factIds.map((id) => ctx.factText.get(id)).find((s): s is string => Boolean(s)) ?? "";
  return { app, ctx, user, facts, fact, why: packet?.why?.trim() ?? "" };
}

/** A saved PASS and probability are produced only after three independent reviews and an acknowledged Atlas write. */
export async function prepareRelationship(userId: string, applicationId: string, kind: MessageKind = "outreach", reason?: string) {
  const loaded = await context(userId, applicationId);
  if (reason !== undefined) { await saveWhy(userId, loaded.app.jobId!, reason); loaded.why = reason.trim(); }
  if (kind === "follow_up" && !loaded.app.appliedAt) throw new Error("Submit the application before preparing its follow-up.");
  const database = await atlas();
  const collection = database.collection<LaneDoc>("relationship_lane");
  const existing = await collection.findOne({ userId, applicationId });
  if (existing?.sendState) throw new Error("A previous send is awaiting confirmation. The saved draft is preserved.");
  if (existing?.touches.some((touch) => touch.kind === kind)) throw new Error("This message was already sent. Its receipt is preserved.");
  const { contact, reason: emptyReason } = await discoverContact(loaded.ctx.job);
  const draft = contact ? messageDraft({ kind, company: loaded.app.company, title: loaded.app.title, contact, why: loaded.why, fact: loaded.fact, name: loaded.user.name }) : null;
  let gate: RelationshipLane["gate"] = null;
  if (draft && contact) {
    const inputs = { contact, why: loaded.why, fact: loaded.fact, facts: loaded.facts, name: loaded.user.name, company: loaded.app.company, title: loaded.app.title, posting: loaded.ctx.job.description ?? "" };
    const checks = messageChecks(draft, inputs);
    const text = draft.subject + "\n\n" + draft.body;
    const model = checks.every((check) => check.ok) ? await reviewByConsensus(userId, {
      purpose: `review.${kind}`, noun: kind === "outreach" ? "outreach" : "follow-up",
      framings: LETTER_FRAMINGS.map((framing) => ({ ...framing, promptVersion: `${kind}.${framing.id}.v1`, system: `${framing.system}\nThis is a short ${kind === "outreach" ? "outreach email" : "follow-up email"}, not a cover letter. Review its truthfulness, human voice, formatting, and language for this employer. A short greeting, one real example, the student's own reason, and a brief request are enough. Do not require a cover letter's length or school introduction.` })),
      text, facts: loaded.facts, known: [contact.name, loaded.app.company, loaded.app.title, loaded.user.name],
      input: JSON.stringify({ document: text, confirmedFacts: loaded.facts, personalReason: loaded.why, profile: { name: loaded.user.name }, posting: inputs.posting, verifiedContact: contact, submittedAt: loaded.app.appliedAt?.toISOString() ?? null }),
    }) : { status: "skipped" as const, issues: [], model: null, message: "Fix the marked checks before the reviewers read this message." };
    gate = { fingerprint: messageFingerprint(draft, inputs), checks, model, passed: checks.every((c) => c.ok) && threeReviewersPassed(model), at: new Date().toISOString() };
    gate.documentLines = [{ key: "subject", text: draft.subject }, ...draft.body.split("\n").map((text, i) => ({ key: `body:${i}`, text }))];
    gate.changes = changesSince((kind === "outreach" ? existing?.gate : existing?.followUpGate) ?? null, gate.documentLines);
    if (gate.passed) gate.prediction = await recordGatePrediction(userId, loaded.app.jobId!, kind, gate.fingerprint);
  }
  const common = { contact, emptyReason, why: loaded.why, fact: loaded.fact, name: loaded.user.name };
  const patch = kind === "outreach" ? { ...common, draft, gate } : { ...common, followUp: draft, followUpGate: gate };
  if (existing) {
    const result = await collection.updateOne({ _id: existing._id, userId, sendState: null, touches: { $not: { $elemMatch: { kind } } } }, { $set: patch });
    if (result.matchedCount !== 1) throw new Error("This message changed during preparation. Reload its saved receipt.");
  } else {
    await collection.insertOne({ _id: key(userId, applicationId), userId, applicationId, ...common, draft: null, followUp: null, gate: null, followUpGate: null, touches: [], sendState: null, ...patch });
  }
  return (await loadRelationshipLanes(userId))[applicationId];
}

/** User-confirmed send only. The recipient and message come from the immutable gated draft. */
export async function sendRelationship(userId: string, applicationId: string, kind: MessageKind, fingerprint: string) {
  const loaded = await context(userId, applicationId);
  if (kind === "follow_up" && (loaded.app.stage !== "applied" || !loaded.app.appliedAt || followUpDue(loaded.app.appliedAt) > new Date() || loaded.app.followUpSentAt)) throw new Error("This follow-up is not due or the application is no longer waiting for a reply.");
  const database = await atlas();
  const collection = database.collection<LaneDoc>("relationship_lane");
  const row = await collection.findOne({ userId, applicationId });
  if (kind === "follow_up" && await database.collection("application_outcomes").findOne({ userId, applicationId, outcome: "withdrawn" })) throw new Error("This application was withdrawn. No follow-up can be sent.");
  const draft = kind === "outreach" ? row?.draft : row?.followUp;
  const gate = kind === "outreach" ? row?.gate : row?.followUpGate;
  if (!row?.contact || !draft || !gate?.passed || gate.fingerprint !== fingerprint || !threeReviewersPassed(gate.model)) throw new Error("Prepare and review a passing draft before sending.");
  if (row.touches.some((t) => t.kind === kind)) throw new Error("This message has already been sent.");
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.EMAIL_FROM?.trim()) throw new Error("Email sending is not configured. No email was sent.");
  const verified = await discoverContact(loaded.ctx.job);
  if (!verified.contact || verified.contact.email !== row.contact.email || verified.contact.name !== row.contact.name || verified.contact.quote !== row.contact.quote) throw new Error("The contact source changed or could not be verified. Prepare a new draft.");
  const inputs = { contact: verified.contact, facts: loaded.facts, why: loaded.why, posting: loaded.ctx.job.description ?? "", name: loaded.user.name };
  if (messageFingerprint(draft, inputs) !== fingerprint) throw new Error("Your facts, reason, or posting changed. Prepare and review a new draft.");
  const attemptId = randomUUID();
  const reserved = await collection.findOneAndUpdate({ userId, applicationId, sendState: null, touches: { $not: { $elemMatch: { kind } } }, [kind === "outreach" ? "gate.fingerprint" : "followUpGate.fingerprint"]: fingerprint }, { $set: { sendState: "sending", attemptId, attemptKind: kind } }, { returnDocument: "after" });
  if (!reserved) throw new Error("A send is already in progress or awaiting confirmation. No duplicate was sent.");
  const delivery = await deliverMessage({ ...draft, to: row.contact.email, replyTo: loaded.user.email, id: attemptId });
  if (delivery.status !== "accepted") {
    await collection.updateOne({ userId, applicationId, attemptId }, { $set: { sendState: delivery.status === "unconfirmed" ? "unconfirmed" : null } });
    throw new Error(delivery.status === "unconfirmed" ? "The provider did not confirm the send. It is locked to prevent a duplicate; no sent claim was recorded." : "The provider rejected the email. No sent receipt was recorded.");
  }
  const touch: Touch = { ...draft, id: attemptId, kind, to: row.contact.email, at: new Date().toISOString(), providerId: delivery.providerId };
  await collection.updateOne({ userId, applicationId, attemptId }, { $push: { touches: touch }, $set: { sendState: null } });
  if (kind === "follow_up") await db.update(schema.application).set({ followUpSentAt: new Date(touch.at), nextFollowUpAt: null }).where(and(eq(schema.application.userId, userId), eq(schema.application.id, applicationId)));
  return touch;
}

export async function prepareSubmittedFollowUp(userId: string, applicationId: string) {
  if (!atlasConfigured()) return;
  try { await prepareRelationship(userId, applicationId, "follow_up"); }
  catch { /* Submission is real even if preparation fails. The tracker shows the missing gate and offers preparation again. */ }
}
