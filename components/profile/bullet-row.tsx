"use client";

import { useState, useTransition } from "react";
import { Archive, Check, ChevronDown, CircleAlert, Pencil, Star } from "lucide-react";
import { archiveBulletAction, editBulletAction, favoriteBulletAction } from "@/app/app/profile/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { scoreBullet, type BulletCheck } from "@/lib/resume/bullet-score";
import { cn } from "@/lib/utils";

export type BulletView = {
  id: string;
  text: string;
  score: number | null;
  favorite: boolean;
  verified: boolean;
  status: "draft" | "active" | "archived";
  checks: BulletCheck[];
};

export function ScoreChip({ score }: { score: number }) {
  const tone = score >= 85 ? "strong" : score >= 65 ? "ok" : "weak";
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-9 items-center justify-center rounded-md px-1.5 text-[12px] font-semibold tabular-nums",
        tone === "strong" && "bg-brand-soft text-brand-ink",
        tone === "ok" && "bg-muted text-foreground",
        tone === "weak" && "bg-muted text-muted-foreground",
      )}
      title="Bullet score out of 100"
    >
      {score}
    </span>
  );
}

export function BulletRow({ bullet }: { bullet: BulletView }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bullet.text);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const live = editing ? scoreBullet(draft) : null;
  const tips = bullet.checks.filter((c) => c.tip);

  return (
    <li className={cn("group rounded-lg border bg-background p-3 transition-opacity", pending && "opacity-60")}>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setEditing(false);
            startTransition(() => editBulletAction(bullet.id, draft));
          }}
        >
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} className="text-[14px] leading-6" autoFocus />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm">
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            {live && (
              <span className="ml-auto flex items-center gap-2 text-[12px] text-muted-foreground">
                Live score <ScoreChip score={live.score} />
              </span>
            )}
          </div>
          {live && live.checks.some((c) => c.tip) && (
            <ul className="mt-2 space-y-1">
              {live.checks
                .filter((c) => c.tip)
                .map((c) => (
                  <li key={c.id} className="text-[12.5px] text-muted-foreground">
                    {c.tip}
                  </li>
                ))}
            </ul>
          )}
          <p className="mt-2 text-[12px] text-subtle-foreground">Any new number you type here is saved as a fact you stated.</p>
        </form>
      ) : (
        <>
          <div className="flex items-start gap-3">
            {bullet.verified ? (
              <Check className="mt-1 size-4 shrink-0 text-brand" strokeWidth={2.5} aria-label="Every number traces to a confirmed fact" />
            ) : (
              <CircleAlert className="mt-1 size-4 shrink-0 text-pending" aria-label="Waiting on your OK" />
            )}
            <p className="min-w-0 flex-1 text-[14px] leading-6">{bullet.text}</p>
            {bullet.score != null && <ScoreChip score={bullet.score} />}
          </div>
          <div className="mt-2 flex items-center gap-1 pl-7">
            <Button
              size="xs"
              variant="ghost"
              aria-pressed={bullet.favorite}
              onClick={() => startTransition(() => favoriteBulletAction(bullet.id, !bullet.favorite))}
              className={cn(bullet.favorite && "text-foreground")}
            >
              <Star data-icon="inline-start" className={cn(bullet.favorite && "fill-current")} />
              {bullet.favorite ? "Favorited" : "Favorite"}
            </Button>
            <Button size="xs" variant="ghost" onClick={() => setEditing(true)}>
              <Pencil data-icon="inline-start" />
              Edit
            </Button>
            <Button size="xs" variant="ghost" onClick={() => startTransition(() => archiveBulletAction(bullet.id))}>
              <Archive data-icon="inline-start" />
              Retire
            </Button>
            {tips.length > 0 && (
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className="ml-auto inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
              >
                {tips.length} {tips.length === 1 ? "way" : "ways"} to strengthen
                <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
              </button>
            )}
          </div>
          {open && (
            <ul className="mt-2 space-y-1.5 border-t pt-2 pl-7">
              {tips.map((c) => (
                <li key={c.id} className="text-[12.5px] leading-5">
                  <span className="font-medium">{c.label}:</span> <span className="text-muted-foreground">{c.tip}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  );
}
