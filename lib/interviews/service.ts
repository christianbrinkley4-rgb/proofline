import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { loadCandidate } from "@/lib/fit/candidate";
import { scoreFit } from "@/lib/fit/engine";
import { keywordsOf, requirementsOf } from "@/lib/jobs/store";
import { getApplication, listApplications, trackJob } from "@/lib/tracker/service";
import { atlas, atlasConfigured } from "./mongo";
import { calibration, interviewPrior, OutcomeSchema, ProbabilitySchema, submissionPrediction, type ApplicationOutcome, type Outcome, type Prediction } from "./model";

type PredictionDoc = Omit<Prediction, "id"> & { _id: string; userId: string };
type OutcomeDoc = ApplicationOutcome & { _id: string; userId: string };

/** A successful gate is not returned until Atlas acknowledges its prediction. */
export async function recordGatePrediction(userId: string, jobId: string, gate: string, fingerprint: string, resumeId?: string): Promise<Prediction> {
  const database = await atlas();
  const [candidate, job] = await Promise.all([loadCandidate(userId), db.query.job.findFirst({ where: eq(schema.job.id, jobId) })]);
  if (!job) throw new Error("Posting not found.");
  const app = await trackJob(userId, jobId, resumeId ? { resumeId } : {});
  const fit = scoreFit({ ...job, requirements: requirementsOf(job), keywords: keywordsOf(job) }, candidate);
  const estimate = interviewPrior(fit);
  const prediction: Prediction = { id: randomUUID(), applicationId: app.id, gate, fingerprint, ...estimate, at: new Date().toISOString() };
  ProbabilitySchema.parse(prediction.probability);
  const { id, ...rest } = prediction;
  await database.collection<PredictionDoc>("interview_predictions").insertOne({ _id: id, userId, ...rest });
  return prediction;
}

export async function loadInterviewData(userId: string) {
  if (!atlasConfigured()) return { available: false as const, predictions: [] as Prediction[], outcomes: [] as ApplicationOutcome[] };
  const database = await atlas();
  const [predictions, outcomes] = await Promise.all([
    database.collection<PredictionDoc>("interview_predictions").find({ userId }).sort({ at: -1 }).toArray(),
    database.collection<OutcomeDoc>("application_outcomes").find({ userId }).toArray(),
  ]);
  return { available: true as const,
    predictions: predictions.map((p): Prediction => ({ id: p._id, applicationId: p.applicationId, gate: p.gate, fingerprint: p.fingerprint, probability: p.probability, reasoning: p.reasoning, version: p.version, at: p.at })),
    outcomes: outcomes.map((o): ApplicationOutcome => ({ applicationId: o.applicationId, outcome: o.outcome, predictionId: o.predictionId, probability: o.probability, submittedAt: o.submittedAt, at: o.at })),
  };
}

export async function saveOutcome(userId: string, applicationId: string, input: Outcome) {
  const outcome = OutcomeSchema.parse(input);
  const app = await getApplication(userId, applicationId);
  if (!app?.appliedAt) throw new Error("Submit the application before recording an outcome.");
  const data = await loadInterviewData(userId);
  if (!data.available) throw new Error("Interview tracking is not configured.");
  const submittedAt = app.appliedAt.toISOString();
  const prediction = submissionPrediction(data.predictions, applicationId, submittedAt);
  const record: ApplicationOutcome = { applicationId, outcome, predictionId: prediction?.id ?? null, probability: prediction?.probability ?? null, submittedAt, at: new Date().toISOString() };
  const database = await atlas();
  await database.collection<OutcomeDoc>("application_outcomes").updateOne({ userId, applicationId }, { $set: record, $setOnInsert: { _id: `${userId}:${applicationId}`, userId } }, { upsert: true });
  // Atlas is authoritative. This activity is for the existing application timeline.
  await db.insert(schema.agentEvent).values({ userId, type: "interview_outcome_recorded", data: { applicationId, outcome, probability: record.probability } });
  if (outcome === "interview" || outcome === "rejection") {
    await db.update(schema.application).set({ stage: outcome === "interview" ? "interview" : "rejected", nextFollowUpAt: null, updatedAt: new Date() }).where(and(eq(schema.application.userId, userId), eq(schema.application.id, applicationId)));
  } else if (outcome === "withdrawn") {
    await db.update(schema.application).set({ nextFollowUpAt: null, updatedAt: new Date() }).where(and(eq(schema.application.userId, userId), eq(schema.application.id, applicationId)));
  }
  return record;
}

export async function calibrationForUser(userId: string) {
  const [apps, data] = await Promise.all([listApplications(userId), loadInterviewData(userId)]);
  const outcomes = new Map(data.outcomes.map((row) => [row.applicationId, row]));
  const submitted = apps.filter((app) => app.appliedAt);
  const rows = submitted.flatMap((app) => {
    const frozen = submissionPrediction(data.predictions, app.id, app.appliedAt!.toISOString());
    return frozen ? [{ applicationId: app.id, probability: frozen.probability, outcome: outcomes.get(app.id)?.outcome ?? null }] : [];
  });
  return { available: data.available, buckets: calibration(rows), unpredicted: submitted.length - rows.length };
}

export async function deleteInterviewData(userId: string, applicationId?: string) {
  if (!atlasConfigured()) return;
  const database = await atlas();
  const filter = applicationId ? { userId, applicationId } : { userId };
  await Promise.all([database.collection("interview_predictions").deleteMany(filter), database.collection("application_outcomes").deleteMany(filter), database.collection("relationship_lane").deleteMany(filter)]);
}
