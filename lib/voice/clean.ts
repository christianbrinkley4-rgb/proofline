import { z } from "zod";
import { TRANSCRIPT_V1 } from "@/lib/llm/prompts/transcript.v1";
import { getLlm } from "@/lib/llm/provider";
import { findVoiceIssues } from "./rules";
import { cleanTranscript, introducesNumbers } from "./transcript";

export const DictationSchema = z.array(z.string().max(4000)).min(1).max(200);

/**
 * Dictation to typed text. The rules pass always runs; with a model configured,
 * Claude does a smoother cleanup that's kept only if it adds no numbers, doesn't
 * balloon, and passes the voice rules.
 */
export async function cleanDictation(segments: string[], userId?: string): Promise<{ text: string; method: "rules" | "model" }> {
  const parts = DictationSchema.parse(segments);
  const rules = cleanTranscript(parts);
  const raw = parts.join(" ");
  const llm = getLlm();
  if (!llm || raw.split(/\s+/).length < 8) return { text: rules, method: "rules" };
  try {
    const out = await llm.generateObject({
      purpose: "voice.clean",
      userId,
      promptVersion: TRANSCRIPT_V1.version,
      system: TRANSCRIPT_V1.system,
      schema: z.object({ text: z.string() }),
      effort: "low",
      input: parts.join("\n"),
    });
    const text = out.text.trim();
    const grew = text.split(/\s+/).length > raw.split(/\s+/).length * 1.15 + 5;
    if (!text || grew || introducesNumbers(raw, text).length || findVoiceIssues(text).length) return { text: rules, method: "rules" };
    return { text, method: "model" };
  } catch {
    return { text: rules, method: "rules" };
  }
}
