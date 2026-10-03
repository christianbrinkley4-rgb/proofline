import { createHash } from "node:crypto";
import { findLetterFiller, findVoiceIssues } from "@/lib/voice/rules";
import type { ModelReview } from "@/lib/review/model";
import type { Prediction } from "@/lib/interviews/model";
import type { DocumentLine, GateChange } from "@/lib/review/receipt";

export type VerifiedContact = { name: string; role: string; email: string; sourceUrl: string; quote: string; verifiedAt: string };
export type MessageKind = "outreach" | "follow_up";
export type MessageDraft = { subject: string; body: string };
export type MessageGate = { fingerprint: string; checks: Array<{ label: string; ok: boolean; detail: string }>; model: ModelReview; passed: boolean; at: string; prediction?: Prediction; documentLines?: DocumentLine[]; changes?: GateChange[] };
export type Touch = MessageDraft & { id: string; kind: MessageKind; to: string; at: string; providerId: string };
export type RelationshipLane = { applicationId: string; contact: VerifiedContact | null; emptyReason: string | null; why: string; fact: string; name: string; draft: MessageDraft | null; followUp: MessageDraft | null; gate: MessageGate | null; followUpGate: MessageGate | null; touches: Touch[]; sendState?: "sending" | "unconfirmed" | null };

/** Only an explicit named hiring contact and an address in the same source passage count. */
export function contactFromPosting(text: string, sourceUrl: string, now = new Date()): VerifiedContact | null {
  const lines = text.split(/\n|(?<=\.)\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);
  // Job boards also publish explicit contact-name/contact-email fields. Keep the
  // whole bounded passage as evidence, without inferring a person's job title.
  for (let i = 0; i < lines.length; i++) {
    const nameLine = /^Contact name:\s*$/i.test(lines[i]) ? `${lines[i]} ${lines[i + 1] ?? ""}` : lines[i];
    const name = nameLine.match(/^Contact name:\s*([\p{L}][\p{L}'-]+(?:\s+[\p{L}][\p{L}'-]+){1,3})$/iu)?.[1];
    const passage = lines.slice(i, i + 6).join(" ");
    const email = passage.match(/Contact email:\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/i)?.[1];
    if (name && email && !/(?:example\.(?:com|org)|\.invalid|noreply|no-reply|privacy@|accommodations@)/i.test(email) && !/\b(?:contact|team|recruiting|hiring|please|email)\b/i.test(name)) {
      return { name, role: "Posting contact", email, sourceUrl, quote: passage, verifiedAt: now.toISOString() };
    }
  }
  for (let i = 0; i < lines.length; i++) {
    const passage = lines.slice(i, i + 2).join(" ");
    const hit = passage.match(/\b(recruiter|hiring manager|talent acquisition(?: manager| specialist)?)\s*[:\-]\s*([\p{L}][\p{L}'-]+(?:\s+[\p{L}][\p{L}'-]+){1,3})\s*[,;(<]|\b([\p{L}][\p{L}'-]+(?:\s+[\p{L}][\p{L}'-]+){1,3})\s*[,(-]\s*(recruiter|hiring manager|talent acquisition(?: manager| specialist)?)\b/iu);
    const email = passage.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
    const name = hit?.[2] ?? hit?.[3]; const role = hit?.[1] ?? hit?.[4];
    if (!name || !role || !email || /(?:example\.(?:com|org)|\.invalid|noreply|no-reply|privacy@|accommodations@)/i.test(email) || /\b(?:contact|team|recruiting|hiring|please|email)\b/i.test(name)) continue;
    return { name: name.trim(), role, email, sourceUrl, quote: passage, verifiedAt: now.toISOString() };
  }
  return null;
}

export function messageDraft(input: { kind: MessageKind; company: string; title: string; contact: VerifiedContact; why: string; fact: string; name: string }): MessageDraft {
  return { subject: input.kind === "outreach" ? `${input.title} at ${input.company}` : `Following up: ${input.title} at ${input.company}`,
    body: [`Hi ${input.contact.name},`, "", input.kind === "outreach" ? `I'm interested in the ${input.title} role at ${input.company}.` : `I'm following up on my application for the ${input.title} role at ${input.company}.`, input.why.trim(), "", input.fact.trim(), "", "Would you be open to a brief conversation about the role?", "", "Thank you,", input.name.trim()].join("\n") };
}
export function messageFingerprint(draft: MessageDraft, context: { contact: VerifiedContact; facts: string[]; why: string; posting: string; name: string }) {
  return createHash("sha256").update(JSON.stringify({ draft, email: context.contact.email, contactName: context.contact.name, quote: context.contact.quote, facts: [...context.facts].sort(), why: context.why, posting: context.posting, name: context.name })).digest("hex");
}
export function messageChecks(draft: MessageDraft, context: { why: string; fact: string; facts: string[]; name: string; company: string; title: string; contact: VerifiedContact }) {
  const text = draft.subject + "\n" + draft.body;
  const words = draft.body.split(/\s+/).filter(Boolean).length;
  return [
    { label: "Confirmed evidence", ok: context.facts.includes(context.fact) && draft.body.includes(context.fact), detail: "The tailored example must be copied from a confirmed fact." },
    { label: "Your reason", ok: context.why.trim().length >= 10 && draft.body.includes(context.why.trim()), detail: "Your own reason for wanting this role is required." },
    { label: "Human voice", ok: !findVoiceIssues(text).length && !findLetterFiller(text).length, detail: "No em dashes, filler, or machine-written phrases." },
    { label: "Formatting", ok: words >= 30 && words <= 180 && !/[\r\n]/.test(draft.subject) && !/\[[^\]]+\]/.test(text) && Boolean(context.name.trim()), detail: `${words} words; requires a finished greeting, subject, and signature.` },
    { label: "Employer and recipient", ok: draft.body.includes(context.company) && draft.body.includes(context.title) && draft.body.startsWith(`Hi ${context.contact.name},`), detail: "Names this employer, role, and sourced contact." },
  ];
}
