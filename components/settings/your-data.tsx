"use client";

import { useState, useTransition } from "react";
import { Download, Trash2 } from "lucide-react";
import { deleteAccountAction } from "@/app/app/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function YourData({ email }: { email: string }) {
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5">
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium">Download everything</p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Your profile, every version of everything you confirmed, jobs, resumes, applications, and feedback, as one JSON file.</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href="/api/account/export">
            <Download data-icon="inline-start" />
            Download
          </a>
        </Button>
      </div>
      <div className="rounded-lg border border-destructive/30 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium">Delete my account and all my data</p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">Permanently removes your account and everything in it: your experience, jobs you pasted, resumes, applications, and feedback. This can&apos;t be undone.</p>
          </div>
          {!confirming && (
            <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
              <Trash2 data-icon="inline-start" />
              Delete account
            </Button>
          )}
        </div>
        {confirming && (
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              startTransition(async () => {
                const result = await deleteAccountAction(typed);
                if (result && !result.ok) setError(result.error);
              });
            }}
          >
            <label className="block space-y-1.5 text-[12.5px]">
              <span>
                Type <span className="font-medium">{email}</span> to confirm
              </span>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </label>
            {error && <p role="alert" className="text-[12.5px] text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" variant="destructive" size="sm" disabled={pending || typed.trim().toLowerCase() !== email.toLowerCase()}>
                Delete permanently
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setConfirming(false); setTyped(""); }}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
