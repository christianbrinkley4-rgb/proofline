"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { importPastedJobAction } from "@/app/app/jobs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** Review details from a browser capture or enter a posting Proofline cannot open. */
export function PasteJob({ initial, onCancel, captured = false }: { initial?: { company?: string; title?: string; location?: string; url?: string; description?: string }; onCancel?: () => void; captured?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="mt-3 grid gap-3 rounded-xl border bg-muted/40 p-4 sm:grid-cols-2 motion-safe:animate-view-in"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError("");
        startTransition(async () => {
          const result = await importPastedJobAction({
            company: String(f.get("company") ?? ""),
            title: String(f.get("title") ?? ""),
            location: String(f.get("location") ?? ""),
            url: String(f.get("url") ?? ""),
            description: String(f.get("description") ?? ""),
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.push(`/app/jobs/${result.jobId}?build=1#resumes`);
        });
      }}
    >
      <p className="text-[12.5px] leading-5 text-muted-foreground sm:col-span-2">
        {captured
          ? "Check the company, title, location, and description captured from the page. Add anything missing before you score and save it."
          : "For jobs on Handshake, LinkedIn, or anywhere we can't open: copy the posting and paste it here. You'll get a fit score, a resume, and a cover letter like any other job."}
      </p>
      <label className="space-y-1.5 text-[12.5px]">
        <span>Company</span>
        <Input name="company" required maxLength={160} defaultValue={initial?.company} className="bg-background" />
      </label>
      <label className="space-y-1.5 text-[12.5px]">
        <span>Job title</span>
        <Input name="title" required maxLength={200} defaultValue={initial?.title} className="bg-background" />
      </label>
      <label className="space-y-1.5 text-[12.5px]">
        <span>
          Location <span className="text-muted-foreground">(optional)</span>
        </span>
        <Input name="location" maxLength={160} defaultValue={initial?.location} placeholder="City, ST or Remote" className="bg-background" />
      </label>
      <label className="space-y-1.5 text-[12.5px]">
        <span>
          Link to apply <span className="text-muted-foreground">(optional)</span>
        </span>
        <Input name="url" type="url" maxLength={2000} defaultValue={initial?.url} placeholder="https://" className="bg-background" />
      </label>
      <label className="space-y-1.5 text-[12.5px] sm:col-span-2">
        <span>Job description</span>
        <Textarea name="description" required minLength={200} maxLength={40000} rows={8} defaultValue={initial?.description} placeholder="Paste the whole posting: responsibilities, qualifications, pay, and anything else it says." className="bg-background" />
      </label>
      {error && (
        <p role="alert" className="text-[12.5px] text-destructive sm:col-span-2">
          {error}
        </p>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : <ArrowRight data-icon="inline-end" />}
          Score it
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
