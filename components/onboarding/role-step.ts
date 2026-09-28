const PROJECT_HINT = "Class projects, personal builds, research, or club work. Add what you remember. You can save first and answer questions about the work next.";
const TYPED_ROLE_HINT = "A job, internship, club, or volunteer role. Add what you remember, or just save your title and dates. We will ask about possible tasks next.";
const IMPORTED_ONE_LINE_HINT = "This role came from your resume with one line. You can save that line on its own.";

export function isProjectKind(kind: string) {
  return kind === "project" || kind === "research";
}

/** Lines long enough to count. Shorter text is treated as blank. */
export function countableRoleLines(bullets: string[]): string[] {
  return bullets.map((b) => b.trim()).filter((b) => b.length >= 3);
}

/** A job, internship, club, or volunteer role read from a resume that already had one line. */
export function importedRoleHasOneLine(kind: string, bullets: string[]): boolean {
  return !isProjectKind(kind) && countableRoleLines(bullets).length === 1;
}

/** Line boxes for the form. An imported one-line role does not get a blank second box. */
export function linesForRoleForm(bullets: string[], project: boolean, importedOneLine: boolean): string[] {
  const min = project || importedOneLine ? 1 : 2;
  return [...bullets, "", ""].slice(0, Math.max(bullets.length, min));
}

export function roleStepHint(project: boolean, importedOneLine: boolean): string {
  if (project) return PROJECT_HINT;
  if (importedOneLine) return IMPORTED_ONE_LINE_HINT;
  return TYPED_ROLE_HINT;
}
