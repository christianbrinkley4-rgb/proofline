"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Star, TriangleAlert, X } from "lucide-react";
import { dismissJobAction, saveJobAction, unsaveJobAction } from "@/app/app/jobs/actions";
import { CompanyAvatar, ScoreMeter } from "@/components/shared/fit";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { JobResult } from "@/lib/jobs/search";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  workday: "company site",
  themuse: "The Muse",
  adzuna: "Adzuna",
  usajobs: "USAJOBS",
  himalayas: "Himalayas",
  jobicy: "Jobicy",
  link: "your link",
};

const DISMISS_REASONS = ["Wrong location", "Wrong kind of role", "Not interested in this company", "Pay too low", "Already applied elsewhere"];

export function postedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

export function ResultRow({ result }: { result: JobResult }) {
  const [status, setStatus] = useState(result.status);
  const [, startTransition] = useTransition();
  if (status === "dismissed") return null;

  const meta = [result.pay ?? "Pay not listed", postedLabel(result.postedAt) && `posted ${postedLabel(result.postedAt)}`, `via ${SOURCE_LABEL[result.source] ?? result.source}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="group relative">
      <Link
        href={`/app/jobs/${result.jobId}`}
        className="flex items-center gap-3.5 px-4 py-3 pr-24 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none sm:px-5"
      >
        <CompanyAvatar name={result.company} className="hidden sm:grid" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] leading-5 font-medium">{result.title}</span>
          <span className="mt-0.5 block truncate text-[13px] leading-5 text-muted-foreground">
            {[
              result.company,
              result.location ? result.location + (result.alsoIn.length ? ` (+${result.alsoIn.length} more ${result.alsoIn.length === 1 ? "city" : "cities"})` : "") : null,
              result.mode !== "unknown" ? result.mode[0].toUpperCase() + result.mode.slice(1) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="mt-1 block truncate text-[12px] leading-4 text-subtle-foreground">{meta}</span>
          {result.cappedBy && (
            <span className="mt-1.5 flex items-start gap-1.5 text-[12px] text-pending-ink">
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              <span className="line-clamp-2">{result.cappedBy}</span>
            </span>
          )}
        </span>
        <ScoreMeter score={result.score} />
      </Link>
      <div className="absolute top-3 right-3 flex gap-0.5 sm:right-4">
        <button
          type="button"
          aria-label={status === "saved" ? "Unsave" : "Save"}
          aria-pressed={status === "saved"}
          onClick={() => {
            const next = status === "saved" ? "new" : "saved";
            setStatus(next);
            startTransition(() => (next === "saved" ? saveJobAction(result.jobId) : unsaveJobAction(result.jobId)));
          }}
          className={cn(
            "grid size-8 place-items-center rounded-md text-subtle-foreground transition-colors hover:bg-background hover:text-foreground",
            status === "saved" && "text-foreground",
          )}
        >
          <Star className={cn("size-4", status === "saved" && "fill-current")} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Not for me"
            className="grid size-8 place-items-center rounded-md text-subtle-foreground outline-none hover:bg-background hover:text-foreground"
          >
            <X className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>Not for you? Tell your agent why.</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {DISMISS_REASONS.map((reason) => (
              <DropdownMenuItem
                key={reason}
                onSelect={() => {
                  setStatus("dismissed");
                  startTransition(() => dismissJobAction(result.jobId, reason));
                }}
              >
                {reason}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onSelect={() => {
                setStatus("dismissed");
                startTransition(() => dismissJobAction(result.jobId));
              }}
            >
              Just hide it
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
