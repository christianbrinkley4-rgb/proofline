"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ABOUT_PROMPT, LINKEDIN_LIMITS, type LinkedInKit } from "@/lib/linkedin/profile-kit";
import { cn } from "@/lib/utils";

/** One LinkedIn field: the text as it will paste, its room left, and a copy button. */
export function CopyField({ label, text, limit, hint, multiline }: { label: string; text: string; limit?: number; hint?: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  const hasPrompt = text.includes(ABOUT_PROMPT);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast(hasPrompt ? "Copied. Replace the bracketed line with your own words before you save it." : "Copied. Paste it into LinkedIn.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.");
    }
  };
  return (
    <div className="rounded-xl border bg-background p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium">{label}</p>
        <div className="flex items-center gap-2">
          {limit && (
            <span className={cn("text-[12px] tabular-nums", text.length > limit ? "text-pending-ink" : "text-subtle-foreground")}>
              {text.length.toLocaleString()} / {limit.toLocaleString()}
            </span>
          )}
          <Button size="xs" variant="outline" onClick={copy} aria-label={`Copy ${label}`}>
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      <div className={cn("mt-2 text-[14.5px] leading-6 break-words", multiline && "whitespace-pre-line")}>
        {hasPrompt ? <Prompted text={text} /> : text}
      </div>
      {hint && <p className="mt-2 text-[12.5px] leading-5 text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Shows the bracketed prompt in the pending color, so it's plain what's left to write. */
function Prompted({ text }: { text: string }) {
  const [before, after] = text.split(ABOUT_PROMPT);
  return (
    <>
      {before}
      <span className="rounded bg-pending-soft px-1 text-pending-ink">{ABOUT_PROMPT}</span>
      {after}
    </>
  );
}

export function LinkedInKitView({ kit }: { kit: LinkedInKit }) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="border-b pb-2 text-[17px] font-semibold tracking-tight">Intro</h2>
        <div className="mt-3 space-y-3">
          <CopyField label="Headline" text={kit.headline} limit={LINKEDIN_LIMITS.headline} hint="Goes under your name. Recruiters see it in every search result." />
          <CopyField
            label="About"
            text={kit.about}
            limit={LINKEDIN_LIMITS.about}
            multiline
            hint="Everything here comes from what you confirmed. The highlighted line is yours to write: what you want to do next."
          />
        </div>
      </section>

      {kit.roles.length > 0 && (
        <section>
          <h2 className="border-b pb-2 text-[17px] font-semibold tracking-tight">Experience</h2>
          <p className="mt-2 text-[13px] leading-5 text-muted-foreground">Add each role on LinkedIn with these details, then paste its description.</p>
          <div className="mt-3 space-y-3">
            {kit.roles.map((role) => (
              <div key={role.id} className="rounded-xl border bg-muted/30 p-3 sm:p-4">
                <p className="text-[14.5px] font-semibold">{[role.title, role.org].filter(Boolean).join(", ")}</p>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{[role.dates, role.location].filter(Boolean).join(" · ") || "Add the dates in My experience"}</p>
                <div className="mt-3">
                  {role.description ? (
                    <CopyField label="Description" text={role.description} limit={LINKEDIN_LIMITS.description} multiline />
                  ) : (
                    <p className="text-[13px] text-muted-foreground">No lines for this role yet. Add what you did in My experience.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(kit.skills.length > 0 || kit.licenses.length > 0) && (
        <section>
          <h2 className="border-b pb-2 text-[17px] font-semibold tracking-tight">Skills and certifications</h2>
          <div className="mt-3 space-y-3">
            {kit.skills.length > 0 && <CopyField label="Skills" text={kit.skills.join(", ")} hint="LinkedIn adds skills one at a time. Pin the three that matter most for the jobs you want." />}
            {kit.licenses.length > 0 && <CopyField label="Licenses and certifications" text={kit.licenses.join(", ")} />}
          </div>
        </section>
      )}
    </div>
  );
}
