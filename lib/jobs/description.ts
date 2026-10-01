/** A targeted draft needs enough posting text to guide evidence selection. */
export function hasUsableJobDescription(description: string | null | undefined): boolean {
  const text = description?.trim() ?? "";
  return text.length >= 40 && text.split(/\s+/).length >= 6 && !/^(?:no description|description unavailable|see (?:job )?posting|apply (?:online|here))\b/i.test(text);
}

export const JOB_DESCRIPTION_REQUIRED = "This job needs its description before Proofline can make a resume or draft an application. Paste the full posting, then try again.";
