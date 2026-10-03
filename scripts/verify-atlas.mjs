import nextEnv from "@next/env";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
nextEnv.loadEnvConfig(process.cwd());
const databaseName = "proofline_moat_verification_20261002";
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
try {
  await client.connect();
  const database = client.db(databaseName);
  const ping = await database.command({ ping: 1 });
  const id = randomUUID();
  const record = { _id: id, userId: "synthetic-connection-verification", applicationId: randomUUID(), probability: 32, reasoning: "For: synthetic connection test; against: no real outcome evidence.", gate: "connection-verification-fixture", at: new Date().toISOString() };
  const insert = await database.collection("interview_predictions").insertOne(record);
  const read = await database.collection("interview_predictions").findOne({ _id: id });
  const evidence = { at: new Date().toISOString(), host: "proofline.hdhkaet.mongodb.net", database: databaseName, synthetic: true, ping: ping.ok === 1, acknowledged: insert.acknowledged, applicationId: record.applicationId, documentId: id, readMatches: read?.applicationId === record.applicationId && read?.probability === 32 && read?.reasoning === record.reasoning };
  await writeFile("docs/evidence/moat-2026-10-02/atlas-connection.json", JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence));
} catch (error) {
  console.error(JSON.stringify({ atlasVerification: "failed", name: error?.name, code: error?.code ?? null }));
  process.exitCode = 1;
} finally { await client.close(); }
