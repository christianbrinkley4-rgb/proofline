import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Debug log of every model call, with contact details redacted. Written to
 * .data/llm/<date>.jsonl in development only; production logging goes through
 * the platform's logger once we deploy.
 */

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
const URL_WITH_HANDLE = /(linkedin\.com\/in\/|github\.com\/)[\w-]+/gi;

export function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(EMAIL, "[email]").replace(PHONE, "[phone]").replace(URL_WITH_HANDLE, "$1[handle]");
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, k === "data" && typeof v === "string" && v.length > 200 ? "[binary]" : redact(v)]),
    );
  }
  return value;
}

export type LlmLogEntry = {
  purpose: string;
  promptVersion: string;
  model: string;
  ms: number;
  input: unknown;
  output?: unknown;
  usage?: unknown;
  error?: string;
};

export async function logLlmCall(entry: LlmLogEntry): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  try {
    const dir = path.join(process.cwd(), ".data", "llm");
    await mkdir(dir, { recursive: true });
    const line = JSON.stringify({ at: new Date().toISOString(), ...(redact(entry) as object) });
    await appendFile(path.join(dir, `${new Date().toISOString().slice(0, 10)}.jsonl`), `${line}\n`);
  } catch {
    // Logging must never break a request.
  }
}
