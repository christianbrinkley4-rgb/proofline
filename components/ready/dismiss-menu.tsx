"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { dismissRunAction } from "@/app/app/ready/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Choice = Parameters<typeof dismissRunAction>[1];

export function DismissMenu({ runId, company }: { runId: string; company: string }) {
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = (choice: Choice) =>
    startTransition(async () => {
      setError(null);
      const result = await dismissRunAction(runId, choice);
      if (!result.ok) return void setError(result.error);
      setOpen(false);
      toast(result.rule ? "Got it. Proofline will skip those from now on. You can undo this under Standing rules." : "Removed from your list and your applications.");
    });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="justify-start text-muted-foreground">
          <X />
          Not for me
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-3">
        <Button variant="outline" size="sm" disabled={pending} onClick={() => send({ kind: "one" })} className="justify-start">
          Just this job
        </Button>
        <Button variant="outline" size="sm" disabled={pending} onClick={() => send({ kind: "company" })} className="h-auto justify-start py-1.5 text-left whitespace-normal">
          Never show jobs at {company}
        </Button>
        <form
          className="flex flex-col gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            send({ kind: "word", word });
          }}
        >
          <Label htmlFor={`word-${runId}`} className="text-[13px] font-normal text-muted-foreground">
            Skip titles with this word
          </Label>
          <div className="flex gap-2">
            <Input
              id={`word-${runId}`}
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="senior, sales, manager"
              maxLength={40}
              autoComplete="off"
              aria-describedby={error ? `word-error-${runId}` : undefined}
            />
            <Button type="submit" size="sm" disabled={pending || word.trim().length < 2}>
              Skip
            </Button>
          </div>
          {error && (
            <p id={`word-error-${runId}`} role="alert" className="text-[12.5px] text-destructive">
              {error}
            </p>
          )}
        </form>
      </PopoverContent>
    </Popover>
  );
}
