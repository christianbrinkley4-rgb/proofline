"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { jobCaptureBookmarklet } from "./capture-payload";

export function JobCaptureHelp() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-2 text-[12.5px]">
      <button type="button" onClick={() => setOpen((value) => !value)} className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        Save jobs from other sites with a browser bookmark
      </button>
      {open && (
        <div className="mt-3 max-w-2xl rounded-xl border bg-muted/40 p-4 text-[13px] leading-5">
          <p className="font-medium">Set up a “Save to Proofline” bookmark</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-muted-foreground">
            <li>Copy the bookmark code below.</li>
            <li>Create a bookmark in your browser called “Save to Proofline.” Edit its address and paste the code as the address.</li>
            <li>Open a job posting and click that bookmark. Proofline will show the details for you to check before saving.</li>
          </ol>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(jobCaptureBookmarklet(window.location.origin));
                setCopied(true);
              } catch {
                toast("Could not copy the code. Check your browser's clipboard permission.");
              }
            }}
          >
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            {copied ? "Copied" : "Copy bookmark code"}
          </Button>
          <p className="mt-3 text-muted-foreground">
            It reads the posting visible in your browser. If a page blocks it or the details are incomplete, use the link or paste form here.
          </p>
        </div>
      )}
    </div>
  );
}
