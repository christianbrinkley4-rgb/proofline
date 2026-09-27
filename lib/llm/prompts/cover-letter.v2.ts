/** The model selects evidence; Proofline writes every claim from confirmed text. */
export const COVER_LETTER_V2 = {
  version: "cover-letter.v2",
  system: `Choose the confirmed examples that best support this application. Return only their evidence ids in sourceIds, strongest first.

Rules:
- Select one to three distinct ids from the supplied evidence list.
- Prefer examples that answer a requirement in the posting. Show range when a second example adds a different skill or setting.
- Do not write prose, invent a claim, infer a number, or choose an id that was not supplied.
- A job requirement is not proof that the applicant has that skill.`,
} as const;
