// Local acceptance harness: real app and Atlas, explicitly synthetic reviewers.
// No production routes, credential changes, or outbound email are introduced.
import env from "@next/env";
import { randomBytes } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
env.loadEnvConfig(process.cwd());
mkdirSync(".data", { recursive: true });
const secretFile = ".data/moat-verification-secret";
if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(48).toString("hex"));
const reviewLog = "docs/evidence/moat-2026-10-02/synthetic-review-calls.jsonl";
const server = createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  const prompt = body.systemInstruction?.parts?.[0]?.text ?? "";
  const input = body.contents?.[0]?.parts?.[0]?.text ?? "";
  const parts = input.startsWith("{") ? JSON.parse(input) : null;
  const praise = "I want this role because it is the best job in the world.";
  const output = body.generationConfig?.responseSchema?.properties?.text
    ? { text: [parts?.action, parts?.measure, parts?.method ? `using ${parts.method}` : "", parts?.result].filter(Boolean).join(" "), clarification: "" }
    : parts?.document?.includes(praise)
      ? { verdict: "FAIL", issues: [{ quote: praise, rule_broken: "Use a specific personal reason instead of extravagant praise.", fix: "Give your own reason for the client work described in this role.", category: "filler" }] }
      : { verdict: "PASS", issues: [] };
  appendFileSync(reviewLog, JSON.stringify({ at: new Date().toISOString(), provider: "synthetic-local-reviewer", system: prompt, input, output }) + "\n");
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }] }));
});
server.listen(3101, "127.0.0.1", () => {
  const child = spawn(process.execPath, ["--import", "./scripts/moat-verification-providers.mjs", "node_modules/next/dist/bin/next", "start", "-p", "3100"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "", PGLITE_DIR: ".data/moat-loop-20261002", MONGODB_DB: "proofline_moat_verification_20261002", BETTER_AUTH_SECRET: readFileSync(secretFile, "utf8"), BETTER_AUTH_URL: "http://localhost:3100", NEXT_PUBLIC_SITE_URL: "http://localhost:3100", BETA_EMAILS: "moat-loop-20261002@example.test", PROOFLINE_REVIEW_KEY: "synthetic-local-only", PROOFLINE_REVIEW_MODEL: "synthetic-local-reviewer", PROOFLINE_REVIEW_BASE_URL: "http://127.0.0.1:3101", PROOFLINE_DAILY_MODEL_CREDITS: "100", RESEND_API_KEY: "synthetic-local-no-delivery", EMAIL_FROM: "Proofline test <test@proofline.test>" },
  });
  child.on("exit", (code) => { server.close(); process.exitCode = code ?? 1; });
  process.on("SIGINT", () => child.kill("SIGINT"));
});
