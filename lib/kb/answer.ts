/** A short "no" to an optional impact question is an answer, not a resume fact. */
export function isNonAnswer(value: string): boolean {
  return /^(?:no(?: improvement| measurable impact| change)?|none|n\/?a|not applicable|not sure|unknown|i don'?t know|skip)\.?$/i.test(value.trim());
}
