/**
 * Shared shape for resume quality checks and cover-letter checks when an export
 * is blocked. Resume uses `status`; cover letters use `ok`.
 */
export type ExportGateCheck = {
  id: string;
  label: string;
  detail: string;
  blocking: boolean;
  status?: "pass" | "warn" | "fail";
  ok?: boolean;
};

export type ExportBlockedBody = { blocked: true; checks: ExportGateCheck[] };

export function isBlockingFail(check: ExportGateCheck): boolean {
  if (check.status !== undefined) return check.blocking && check.status === "fail";
  return check.blocking && check.ok === false;
}

/** Detail text for every check that actually blocks export (ignores warns). */
export function blockingExportMessage(checks: ExportGateCheck[]): string {
  const blockers = checks.filter(isBlockingFail);
  if (!blockers.length) return "This file can't be exported yet.";
  return blockers.map((c) => c.detail).join(" ");
}

export function blockedExportResponse(checks: ExportGateCheck[]): Response {
  const body: ExportBlockedBody = { blocked: true, checks };
  return Response.json(body, { status: 409 });
}
