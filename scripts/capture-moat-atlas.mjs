// Read only the isolated acceptance database. Never print the connection URI.
import env from "@next/env";
import { MongoClient } from "mongodb";
import { writeFileSync } from "node:fs";
env.loadEnvConfig(process.cwd());
const name = "proofline_moat_verification_20261002";
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
try {
  await client.connect();
  const db = client.db(name);
  const predictions = await db.collection("interview_predictions").find({ gate: { $in: ["resume", "letter", "outreach", "follow_up"] } }).toArray();
  const appIds = [...new Set(predictions.map((p) => p.applicationId))];
  const outcomes = await db.collection("application_outcomes").find({ applicationId: { $in: appIds } }).toArray();
  const lanes = await db.collection("relationship_lane").find({ applicationId: { $in: appIds } }).toArray();
  const evidence = { capturedAt: new Date().toISOString(), database: name, predictions, outcomes, lanes };
  writeFileSync("docs/evidence/moat-2026-10-02/atlas-loop.json", JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ database: name, predictions: predictions.map((p) => ({ id: p._id, applicationId: p.applicationId, gate: p.gate, probability: p.probability, reasoning: p.reasoning })), outcomes: outcomes.map((o) => ({ applicationId: o.applicationId, outcome: o.outcome, probability: o.probability })), lanes: lanes.map((l) => ({ applicationId: l.applicationId, contact: l.contact?.name ?? null, outreachPassed: l.gate?.passed ?? false, followUpPassed: l.followUpGate?.passed ?? false, touches: l.touches?.length ?? 0 })) }, null, 2));
} catch (error) { console.error(JSON.stringify({ ok: false, name: error.name, code: error.code ?? null })); process.exitCode = 1; }
finally { await client.close(); }
