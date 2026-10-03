import { GateReceipt } from "@/components/review/gate-receipt";
import type { GateResult } from "@/lib/review/gate";
import type { LetterGateResult } from "@/lib/review/letter-gate";
export type ApplicationGatesView = { resume: GateResult | null; resumeStale: boolean; letter: LetterGateResult | null; letterStale: boolean };
export function ApplicationGates({ gates }: { gates?: ApplicationGatesView }) {
  return <section className="space-y-3"><h3 className="text-sm font-semibold">Application quality gates</h3><div><p className="mb-2 text-xs font-medium">Resume</p><GateReceipt model={gates?.resume?.model ?? null} passed={Boolean(gates?.resume?.passed)} stale={gates?.resumeStale} changes={gates?.resume?.changes} checks={gates?.resume?.linter.filter((c) => c.severity === "BLOCKING").map((c) => ({ label: c.label, ok: c.passed, detail: c.detail, quote: c.evidence_quote }))} /></div>{gates?.letter && <div><p className="mb-2 text-xs font-medium">Cover letter</p><GateReceipt model={gates.letter.model} passed={gates.letter.passed} stale={gates.letterStale} changes={gates.letter.changes} checks={gates.letter.checks.filter((c) => c.blocking).map((c) => ({ label: c.label, ok: c.ok, detail: c.detail }))} /></div>}</section>;
}
