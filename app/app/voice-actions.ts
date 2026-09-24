"use server";

import { requireSession } from "@/lib/auth";
import { cleanDictation, DictationSchema } from "@/lib/voice/clean";

/** Dictation to clean typed text. Only removes filler; never adds anything that wasn't said. */
export async function cleanDictationAction(segments: string[]): Promise<{ text: string; method: "rules" | "model" }> {
  await requireSession();
  return cleanDictation(DictationSchema.parse(segments));
}
