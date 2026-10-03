import { MongoClient, type Db } from "mongodb";

type Connection = { uri: string; name: string; ready: Promise<Db> };
const state = globalThis as unknown as { prooflineMoatMongo?: Connection };
export function atlasConfigured() { return Boolean(process.env.MONGODB_URI?.trim() && process.env.MONGODB_DB?.trim()); }
export async function atlas(): Promise<Db> {
  const uri = process.env.MONGODB_URI?.trim();
  const name = process.env.MONGODB_DB?.trim();
  if (!uri || !name) throw new Error("Interview tracking needs the existing Atlas connection. Configure MONGODB_URI and MONGODB_DB.");
  if (!state.prooflineMoatMongo || state.prooflineMoatMongo.uri !== uri || state.prooflineMoatMongo.name !== name) {
    const client = new MongoClient(uri, { maxPoolSize: 5, serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
    const ready = client.connect().then(async () => {
      const database = client.db(name);
      await Promise.all([database.collection("interview_predictions").createIndex({ userId: 1, applicationId: 1, at: -1 }), database.collection("application_outcomes").createIndex({ userId: 1, applicationId: 1 }, { unique: true })]);
      return database;
    }).catch(async (error) => { if (state.prooflineMoatMongo?.ready === ready) state.prooflineMoatMongo = undefined; await client.close(); throw error; });
    state.prooflineMoatMongo = { uri, name, ready };
  }
  return state.prooflineMoatMongo.ready;
}
