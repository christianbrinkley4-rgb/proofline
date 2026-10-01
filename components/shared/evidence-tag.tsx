import { Check, CircleHelp, FileText, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The four kinds of text Proofline shows, told apart at a glance:
 * - confirmed: a fact the person said is true. Solid, green check.
 * - question: something the agent is asking. Dashed amber; adds nothing until answered.
 * - suggestion: an example to react to. Dashed grey; never a claim on its own.
 * - resume: a finished line that can go on a resume, built only from confirmed facts.
 */
export type EvidenceKind = "confirmed" | "question" | "suggestion" | "resume";

const STYLE: Record<EvidenceKind, { icon: typeof Check; label: string; className: string }> = {
  confirmed: { icon: Check, label: "Confirmed", className: "border-transparent bg-brand-soft text-brand-ink" },
  question: { icon: CircleHelp, label: "Question", className: "border-dashed border-pending/70 text-pending-ink" },
  suggestion: { icon: Lightbulb, label: "Suggestion", className: "border-dashed border-border-strong text-muted-foreground" },
  resume: { icon: FileText, label: "Resume line", className: "border-transparent bg-ink text-ink-foreground" },
};

export function EvidenceTag({ kind, children, className }: { kind: EvidenceKind; children?: React.ReactNode; className?: string }) {
  const { icon: Icon, label, className: tone } = STYLE[kind];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] leading-4 font-medium", tone, className)}>
      <Icon aria-hidden="true" className="size-3" strokeWidth={2.5} />
      {children ?? label}
    </span>
  );
}

/** A one-line key for pages that mix all four. */
export function EvidenceLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground", className)}>
      <span className="flex items-center gap-1.5">
        <EvidenceTag kind="confirmed">Confirmed</EvidenceTag> you said it&apos;s true
      </span>
      <span className="flex items-center gap-1.5">
        <EvidenceTag kind="question" /> adds nothing until you answer
      </span>
      <span className="flex items-center gap-1.5">
        <EvidenceTag kind="suggestion" /> only your yes keeps it
      </span>
      <span className="flex items-center gap-1.5">
        <EvidenceTag kind="resume" /> written from confirmed facts
      </span>
    </div>
  );
}
