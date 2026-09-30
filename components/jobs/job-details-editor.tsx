"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateJobDetailsAction } from "@/app/app/jobs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Lets the person fix a bad guess on a posting they pasted. The resume name,
 * the browser tab, and the fit score all read these three fields.
 */
export function JobDetailsEditor({
  jobId,
  title,
  company,
  location,
}: {
  jobId: string;
  title: string;
  company: string;
  location: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 min-h-6 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
        Fix title, company, or place
      </button>
    );
  }

  return (
    <form
      className="mt-3 grid gap-2 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        const data = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await updateJobDetailsAction({
            jobId,
            company: String(data.get("company") ?? ""),
            title: String(data.get("title") ?? ""),
            location: String(data.get("location") ?? ""),
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setOpen(false);
          router.refresh();
        });
      }}
    >
      <label className="space-y-1 text-[12px] text-muted-foreground">
        <span>Job title</span>
        <Input name="title" defaultValue={title} maxLength={200} required className="h-9 bg-background text-foreground" />
      </label>
      <label className="space-y-1 text-[12px] text-muted-foreground">
        <span>Company</span>
        <Input name="company" defaultValue={company} maxLength={160} required className="h-9 bg-background text-foreground" />
      </label>
      <label className="space-y-1 text-[12px] text-muted-foreground">
        <span>Location <span className="text-subtle-foreground">(optional)</span></span>
        <Input name="location" defaultValue={location} maxLength={160} className="h-9 bg-background text-foreground" />
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { setError(""); setOpen(false); }}>
          Cancel
        </Button>
        {error && (
          <p role="alert" className="text-[13px] text-pending-ink">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
