// Imported ONLY by the isolated local acceptance harness, never by the app.
// Capture simulated provider acceptance without making an outbound email request.
import { appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
if (process.env.MONGODB_DB !== "proofline_moat_verification_20261002" || process.env.RESEND_API_KEY !== "synthetic-local-no-delivery") throw new Error("Synthetic provider requires the isolated acceptance environment.");
const realFetch = globalThis.fetch;
globalThis.fetch = async (resource, options) => {
  const url = typeof resource === "string" ? resource : resource instanceof URL ? resource.href : resource.url;
  if (new URL(url).hostname === "api.resend.com") {
    const id = `synthetic-local-${randomUUID()}`;
    appendFileSync("docs/evidence/moat-2026-10-02/synthetic-email-receipts.jsonl", JSON.stringify({ at: new Date().toISOString(), provider: "synthetic-local-no-delivery", id, request: JSON.parse(options.body), idempotencyKey: options.headers["Idempotency-Key"] }) + "\n");
    return new Response(JSON.stringify({ id }), { status: 200, headers: { "content-type": "application/json" } });
  }
  return realFetch(resource, options);
};
const days = Number(process.env.MOAT_VERIFICATION_ADVANCE_DAYS ?? 0);
if (!Number.isInteger(days) || days < 0 || days > 15) throw new Error("Acceptance clock advance must be 0 to 15 days.");
if (days) {
  const OriginalDate = Date;
  globalThis.Date = class extends OriginalDate {
    constructor(...args) { if (args.length) super(...args); else super(OriginalDate.now() + days * 864e5); }
    static now() { return OriginalDate.now() + days * 864e5; }
    static parse(value) { return OriginalDate.parse(value); }
    static UTC(...args) { return OriginalDate.UTC(...args); }
  };
}
