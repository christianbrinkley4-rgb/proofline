"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Hash, LoaderCircle } from "lucide-react";
import { measureBulletAction } from "@/app/app/jobs/[id]/gap-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type Unmeasured = { bulletId: string; text: string; org: string };

/**
 * Bullets on the best resume that don't carry a number yet. The student rewrites
 * each one in their own words with the count, amount, or frequency; nothing is
 * estimated for them.
 */
export function MeasureBullets({ jobId, bullets }: { jobId: string; bullets: Unmeasured[] }) {
  // Kept here so a confirmation survives the refresh that removes the old bullet from the list.
  const [saved, setSaved] = useState<Array<{ id: string; text: string }>>([]);
  const open = bullets.filter((b) => !saved.some((s) => s.id === b.bulletId));
  if (!open.length && !saved.length) return null;
  return (
    <div className="mt-6">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold">
        <Hash className="size-4 text-muted-foreground" />
        Add a number
      </h3>
      <p className="mt-1 mb-3 max-w-2xl text-[13.5px] leading-6 text-muted-foreground">
        Recruiters trust bullets they can measure. How many, how much, how often, or how fast? An honest estimate is fine if you&apos;d stand behind it in an interview.
      </p>
      <div className="space-y-3">
        {saved.map((s) => (
          <p key={s.id} className="flex items-start gap-2 rounded-xl border border-brand/30 bg-brand-soft/60 p-4 text-[13.5px] motion-safe:animate-view-in">
            <Check className="mt-0.5 size-4 shrink-0 text-brand-ink" strokeWidth={3} />
            <span>
              <span className="font-medium">Updated.</span> {s.text}
            </span>
          </p>
        ))}
        {open.map((b) => (
          <MeasureCard key={b.bulletId} jobId={jobId} bullet={b} onSaved={(text) => setSaved((x) => [...x, { id: b.bulletId, text }])} />
        ))}
      </div>
    </div>
  );
}

function MeasureCard({ jobId, bullet, onSaved }: { jobId: string; bullet: Unmeasured; onSaved: (text: string) => void }) {
  const router = useRouter();
  const [text, setText] = useState(bullet.text);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="rounded-xl border bg-background p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        startTransition(async () => {
          const result = await measureBulletAction({ jobId, bulletId: bullet.bulletId, text });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          onSaved(result.text);
          router.refresh();
        });
      }}
    >
      <p className="text-[12px] text-subtle-foreground">{bullet.org}</p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={400} aria-label={`Rewrite with a number: ${bullet.text}`} className="mt-1.5 text-[14px] leading-6" />
      {error && (
        <p role="alert" className="mt-2 text-[12.5px] text-destructive">
          {error}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending || text.trim() === bullet.text}>
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Save with the number
        </Button>
        <span className="text-[12px] text-muted-foreground">Saved as your own words.</span>
      </div>
    </form>
  );
}
