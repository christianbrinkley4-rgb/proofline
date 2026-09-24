"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileUp, Mic, PencilLine } from "lucide-react";
import { LifeNote } from "@/components/profile/life-note";
import { VoiceStory } from "@/components/profile/voice-story";
import { cn } from "@/lib/utils";

type Mode = "talk" | "type";

const CHOICES = [
  { id: "upload", title: "Upload a resume", text: "PDF, DOCX, or LinkedIn's Save to PDF. I'll pull out facts for you to confirm.", icon: FileUp, href: "/app/onboarding?step=upload" },
  { id: "talk", title: "Talk it out", text: "Tell me about one job, class, or project like you'd tell a friend. I'll write the bullets.", icon: Mic },
  { id: "type", title: "Type a few lines", text: "Add one experience in your own words. Rough is fine; I'll ask about the numbers.", icon: PencilLine },
] as const;

/**
 * One way in for an empty profile: pick how to tell your story, then do just that.
 * Replaces showing every capture tool at once.
 */
export function StoryStart({ name }: { name: string }) {
  const [mode, setMode] = useState<Mode | null>(null);

  if (mode) {
    return (
      <section id="start" className="mt-8">
        <button type="button" onClick={() => setMode(null)} className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          Choose another way
        </button>
        {mode === "talk" ? <VoiceStory /> : <LifeNote defaultOpen />}
      </section>
    );
  }

  return (
    <section id="start" aria-labelledby="story-start" className="relative isolate mt-8 overflow-hidden rounded-2xl border bg-background shadow-lift">
      <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-80 atmosphere-soft" />
      <div className="p-5 sm:p-8">
        <p className="text-[12px] font-medium text-brand-ink">Step 1 of 6 · Story</p>
        <h2 id="story-start" className="mt-1 font-display text-[26px] leading-[1.1] font-semibold sm:text-[32px]">
          {name ? `${name}, tell me about one thing you've done.` : "Tell me about one thing you've done."}
        </h2>
        <p className="mt-2 max-w-xl text-[14.5px] leading-6 text-muted-foreground">
          Pick whichever is easiest. Everything becomes a fact you confirm, and only confirmed facts reach a resume or a fit score.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {CHOICES.map((choice, i) => {
            const Icon = choice.icon;
            const body = (
              <>
                <span className={cn("grid size-9 place-items-center rounded-xl", i === 0 ? "bg-ink text-ink-foreground" : "bg-brand-soft text-brand-ink")}>
                  <Icon className="size-4" />
                </span>
                <span className="mt-4 block text-[15px] font-semibold">{choice.title}</span>
                <span className="mt-1 block text-[13px] leading-5 text-muted-foreground">{choice.text}</span>
              </>
            );
            const className = "flex h-full flex-col rounded-xl border bg-background p-4 text-left transition-colors hover:border-border-strong hover:bg-muted/40";
            return "href" in choice ? (
              <Link key={choice.id} href={choice.href} className={className}>
                {body}
              </Link>
            ) : (
              <button key={choice.id} type="button" onClick={() => setMode(choice.id)} className={className}>
                {body}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
