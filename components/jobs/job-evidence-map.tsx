import Link from "next/link";
import { ArrowRight, Check, CircleHelp, FileText, ListChecks } from "lucide-react";
import type { RequirementEvidence } from "@/lib/resume/screening";
import { cn } from "@/lib/utils";

const STATUS = {
  example: { label: "Shown with an example", action: null },
  listed: { label: "Listed as a skill", action: "/app/profile" },
  profile: { label: "In your profile, not on this page", action: "/app/profile" },
  missing: { label: "No confirmed example yet", action: "#strengthen" },
} as const;

/** The posting's parsed skill requirements mapped to specific resume or profile evidence. */
export function JobEvidenceMap({
  items,
  inferred,
  profileFit,
}: {
  items: RequirementEvidence[];
  inferred: boolean;
  profileFit: number;
}) {
  if (!items.length) return null;
  const exampleCount = items.filter((item) => item.status === "example").length;
  const listedCount = items.filter((item) => item.status === "listed").length;
  const profileCount = items.filter((item) => item.status === "profile").length;
  const missingCount = items.filter((item) => item.status === "missing").length;
  const next = items.find((item) => item.status === "profile" || item.status === "missing" || item.status === "listed");

  return (
    <section aria-labelledby="evidence-map-heading" className="mt-8 rounded-2xl border bg-background p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[12px] font-medium text-brand-ink">
            <ListChecks className="size-4" />
            Job evidence map
          </p>
          <h2 id="evidence-map-heading" className="mt-1 font-display text-[21px] font-semibold">
            What this posting can see
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted-foreground">
            {inferred
              ? "The posting did not separate required skills, so these are skills it mentions. Each match points to a real line, not a predicted screening result."
              : "These are the skill requirements Proofline read from the posting. A match is a visible line, not a prediction of an employer's decision."}
          </p>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">Your {profileFit}/100 fit uses your full profile and eligibility details. This map checks only what this resume actually shows.</p>
        </div>
        <div className="rounded-lg bg-muted/60 px-3 py-2 text-[12px] leading-5">
          <span className="block font-medium">{exampleCount} proven in examples</span>
          <span className="block text-muted-foreground">{listedCount} listed · {profileCount} only in profile · {missingCount} to confirm</span>
        </div>
      </div>
      {next && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-brand/20 bg-brand-soft/40 px-3 py-2 text-[13px]">
          <span className="font-medium">Best next move:</span>
          <span>
            {next.status === "profile" ? `Show your ${next.label} work in a resume bullet.`
              : next.status === "listed" ? `Add an example of how you used ${next.label}.`
                : `Tell Proofline if you've done ${next.label}.`}
          </span>
          <Link href={STATUS[next.status].action ?? "#strengthen"} className="inline-flex items-center gap-1 font-medium text-brand-ink underline underline-offset-2">
            {next.status === "missing" ? "Answer the question" : "Add evidence"} <ArrowRight className="size-3" />
          </Link>
        </div>
      )}
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const status = STATUS[item.status];
          return (
            <li key={item.label} className="rounded-lg border p-3">
              <div className="flex items-start gap-2">
                {item.status === "example" ? <Check className="mt-0.5 size-4 shrink-0 text-brand-ink" /> :
                  item.status === "listed" ? <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> :
                    <CircleHelp className="mt-0.5 size-4 shrink-0 text-pending-ink" />}
                <div className="min-w-0">
                  <p className="text-[13px] font-medium">{item.label}</p>
                  <p className={cn("mt-0.5 text-[11.5px]", item.status === "example" ? "text-brand-ink" : "text-muted-foreground")}>{status.label}</p>
                  {item.evidence && <p className="mt-1.5 line-clamp-2 text-[12px] leading-5 text-muted-foreground">“{item.evidence}”</p>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11.5px] text-muted-foreground">Review the posting too. Rule-based parsing can miss context or classify a preference as a requirement.</p>
    </section>
  );
}
