"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createVariantsAction } from "@/app/app/resumes/compare/actions";
import { trackJobAction } from "@/app/app/tracker/actions";
import { Button } from "@/components/ui/button";

export function VariantCompareActions({ jobId, selected }: { jobId: string; selected: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      <Button disabled={pending} onClick={() => startTransition(async () => {
        setError("");
        try {
          const result = await createVariantsAction(jobId);
          if (!result.ok) { setError(result.error); return; }
          toast("Three tailored versions are ready.");
          router.refresh();
        } catch { setError("Couldn't build the versions. Please try again."); }
      })}>{pending ? "Building..." : "Build three versions"}</Button>
      {selected && <Button variant="outline" disabled={pending} onClick={() => startTransition(async () => {
        try { await trackJobAction(jobId, selected); toast("Selected for this application."); router.refresh(); }
        catch { setError("Couldn't select this version. A submitted version stays attached after applying."); }
      })}>Attach selected version</Button>}
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}

