"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SquareKanban, Star } from "lucide-react";
import { toast } from "sonner";
import { saveJobAction, unsaveJobAction } from "@/app/app/jobs/actions";
import { trackJobAction } from "@/app/app/tracker/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function JobActions({ jobId, saved: initiallySaved }: { jobId: string; saved: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <Button
        size="lg"
        variant="outline"
        aria-pressed={saved}
        onClick={() => {
          setSaved(!saved);
          startTransition(() => (saved ? unsaveJobAction(jobId) : saveJobAction(jobId)));
        }}
      >
        <Star data-icon="inline-start" className={cn(saved && "fill-current")} />
        {saved ? "Saved" : "Save"}
      </Button>
      <Button
        size="lg"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await trackJobAction(jobId);
            toast("Added to your tracker.", { action: { label: "Open", onClick: () => router.push("/app/tracker") } });
          })
        }
      >
        <SquareKanban data-icon="inline-start" />
        Track it
      </Button>
    </>
  );
}
