"use client";

import { useState } from "react";
import { LoaderCircle, Mic, Square } from "lucide-react";
import { cleanDictationAction } from "@/app/app/voice-actions";
import { cleanTranscript } from "@/lib/voice/transcript";
import { cn } from "@/lib/utils";
import { useDictation } from "./use-dictation";

/**
 * Tap to talk, tap to stop. What was said is cleaned up (filler out, corrections
 * applied, punctuated) and handed to `onText`, usually appended to a text box.
 */
export function MicButton({
  onText,
  label = "Speak instead of typing",
  className,
  size = "sm",
}: {
  onText: (text: string) => void;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const { supported, listening, interim, segments, error, start, stop } = useDictation();
  const [cleaning, setCleaning] = useState(false);
  if (!supported) return null;

  const finish = async () => {
    const said = stop();
    if (!said.length) return;
    setCleaning(true);
    try {
      const { text } = await cleanDictationAction(said);
      if (text) onText(text);
    } catch {
      // The rules cleanup also runs in the browser, so nothing said is lost.
      const text = cleanTranscript(said);
      if (text) onText(text);
    } finally {
      setCleaning(false);
    }
  };

  const heard = [...segments, interim].filter(Boolean).join(" ");
  const dim = size === "md" ? "size-9" : "size-7";

  return (
    <span className={cn("relative inline-flex items-center", className)}>
      <button
        type="button"
        aria-label={listening ? "Stop and use what I said" : label}
        aria-pressed={listening}
        title={listening ? "Stop" : label}
        disabled={cleaning}
        onClick={() => (listening ? void finish() : start())}
        className={cn(
          "grid shrink-0 place-items-center rounded-full border transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
          dim,
          listening ? "border-transparent bg-foreground text-background" : "bg-background text-muted-foreground hover:text-foreground",
        )}
      >
        {cleaning ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : listening ? (
          <Square className="size-3 fill-current" />
        ) : (
          <Mic className={size === "md" ? "size-4" : "size-3.5"} />
        )}
      </button>
      {listening && (
        <span
          role="status"
          aria-live="polite"
          className="absolute right-0 bottom-full z-20 mb-2 w-72 rounded-lg border bg-background p-2.5 text-[12.5px] leading-5 shadow-md motion-safe:animate-view-in"
        >
          <span className="flex items-center gap-1.5 font-medium">
            <span className="size-1.5 rounded-full bg-destructive motion-safe:animate-pulse" />
            Listening. Tap stop when you&apos;re done.
          </span>
          <span className="mt-1 block max-h-24 overflow-y-auto text-muted-foreground">{heard || "Go ahead, talk like you would to a friend."}</span>
        </span>
      )}
      {error && !listening && (
        <span role="alert" className="absolute right-0 bottom-full z-20 mb-2 w-64 rounded-lg border bg-background p-2.5 text-[12px] leading-5 text-destructive shadow-md">
          {error}
        </span>
      )}
    </span>
  );
}
