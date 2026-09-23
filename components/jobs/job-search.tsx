"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Bell, BellRing, Check, CornerDownLeft, Link2, LoaderCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { importLinkAction, saveSearchAction } from "@/app/app/jobs/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { describeIntent } from "@/lib/jobs/intent";
import type { JobResult } from "@/lib/jobs/search";
import type { JobIntent, SearchStats } from "@/lib/jobs/types";
import { cn } from "@/lib/utils";
import { ResultRow } from "./result-row";

type LogLine = { id: number; text: string; tone: "status" | "found" | "done" };
type Sort = "fit" | "newest";

const EXAMPLES = [
  "accounting internships in Raleigh for summer 2027, remote-friendly",
  "entry-level finance roles that don't require the CPA",
  "remote data analyst internships",
  "tax internships near Charlotte, NC",
];

export function JobSearch({
  initialQuery,
  initialResults,
  autoRun,
}: {
  initialQuery: string;
  initialResults: JobResult[];
  autoRun: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [intent, setIntent] = useState<JobIntent | null>(null);
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [results, setResults] = useState<JobResult[]>(initialResults);
  const [sort, setSort] = useState<Sort>("fit");
  const [hideLongShots, setHideLongShots] = useState(false);
  const [watching, setWatching] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [linkPending, startLink] = useTransition();
  const source = useRef<EventSource | null>(null);
  const counter = useRef(0);

  const push = (text: string, tone: LogLine["tone"] = "status") => setLog((l) => [...l.slice(-7), { id: counter.current++, text, tone }]);

  const run = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) return;
      source.current?.close();
      setRunning(true);
      setLog([]);
      setStats(null);
      setWatching(false);
      const url = new URL(window.location.href);
      url.searchParams.set("q", trimmed);
      window.history.replaceState(null, "", url);

      const es = new EventSource(`/api/jobs/search?q=${encodeURIComponent(trimmed)}`);
      source.current = es;
      es.onmessage = (message) => {
        const event = JSON.parse(message.data);
        if (event.type === "intent") {
          setIntent(event.intent);
          const chips = describeIntent(event.intent).map((c) => c.value);
          push(`Understood: ${chips.join(" · ") || trimmed}`);
        } else if (event.type === "status") push(event.message);
        else if (event.type === "source") push(`${event.source}: ${event.found} ${event.found === 1 ? "match" : "matches"}`, "found");
        else if (event.type === "done") {
          setStats(event.stats);
          push(`Done in ${(event.stats.ms / 1000).toFixed(1)}s`, "done");
        } else if (event.type === "results") {
          setResults(event.results);
          setRunning(false);
          es.close();
        } else if (event.type === "error") {
          toast(event.message);
          setRunning(false);
          es.close();
        }
      };
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) return;
        es.close();
        setRunning(false);
      };
    },
    [],
  );

  useEffect(() => {
    // Arriving with ?q= (from onboarding or a saved search) starts the hunt right away.
    const timer = autoRun && initialQuery ? setTimeout(() => run(initialQuery), 0) : undefined;
    return () => {
      clearTimeout(timer);
      source.current?.close();
    };
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    const list = hideLongShots ? results.filter((r) => r.score >= 50) : results;
    return sort === "fit"
      ? list
      : [...list].sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""));
  }, [results, sort, hideLongShots]);

  const chips = intent ? describeIntent(intent) : [];

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(query);
        }}
        className="flex items-center gap-2 rounded-xl border bg-background p-1.5 pl-4 shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25"
      >
        <Search className="size-4 shrink-0 text-subtle-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe the job you want, like you'd text a friend"
          aria-label="What are you looking for?"
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle-foreground"
        />
        <Button type="submit" size="lg" disabled={running || query.trim().length < 2} className="px-4">
          {running ? <LoaderCircle className="animate-spin" /> : <CornerDownLeft data-icon="inline-start" />}
          {running ? "Searching" : "Search"}
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {!results.length && !running
          ? EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setQuery(ex);
                  run(ex);
                }}
                className="rounded-full border border-dashed border-border-strong px-3 py-1 text-[12.5px] text-muted-foreground transition-colors hover:border-solid hover:bg-muted hover:text-foreground"
              >
                {ex}
              </button>
            ))
          : chips.map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[12px] leading-4">
                <span className="text-subtle-foreground">{c.label}</span>
                <span className="font-medium">{c.value}</span>
              </span>
            ))}
        <button
          type="button"
          onClick={() => setLinkOpen((o) => !o)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] text-muted-foreground hover:text-foreground"
        >
          <Link2 className="size-3.5" />
          Paste a job link
        </button>
      </div>

      {linkOpen && (
        <form
          className="mt-3 flex gap-2 rounded-xl border bg-muted/40 p-3 motion-safe:animate-view-in"
          onSubmit={(e) => {
            e.preventDefault();
            startLink(async () => {
              const r = await importLinkAction(link);
              if (!r.ok) return void toast(r.error);
              router.push(`/app/jobs/${r.jobId}`);
            });
          }}
        >
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="A job from LinkedIn, Indeed, Handshake, or any company site"
            className="h-10 bg-background"
            autoFocus
          />
          <Button type="submit" size="lg" disabled={linkPending || link.trim().length < 8}>
            {linkPending ? <LoaderCircle className="animate-spin" /> : <ArrowRight data-icon="inline-end" />}
            Score it
          </Button>
        </form>
      )}

      {(running || log.length > 0) && (
        <section
          aria-live="polite"
          aria-label="Agent activity"
          className={cn("mt-5 overflow-hidden rounded-xl border bg-zinc-950 text-zinc-100 transition-opacity", !running && "opacity-90")}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
            <span className="flex items-center gap-2 font-mono text-[11.5px] tracking-wide text-zinc-400">
              <span className={cn("size-1.5 rounded-full", running ? "animate-pulse bg-brand" : "bg-zinc-500")} />
              {running ? "AGENT SEARCHING" : "SEARCH COMPLETE"}
            </span>
            {stats && (
              <span className="font-mono text-[11.5px] text-zinc-400 tabular-nums">{stats.scanned.toLocaleString()} postings scanned</span>
            )}
          </div>
          {running && <div className="h-px w-full overflow-hidden bg-white/5"><div className="h-full w-1/3 animate-[scan_1.6s_ease-in-out_infinite] bg-brand/70" /></div>}
          <ol className="space-y-1 px-4 py-3 font-mono text-[12.5px] leading-5">
            {log.map((line) => (
              <li key={line.id} className="flex gap-2 motion-safe:animate-view-in">
                <span className={cn("select-none", line.tone === "found" ? "text-brand" : line.tone === "done" ? "text-zinc-400" : "text-zinc-600")}>
                  {line.tone === "found" ? "+" : line.tone === "done" ? "✓" : "›"}
                </span>
                <span className={line.tone === "found" ? "text-zinc-100" : "text-zinc-400"}>{line.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {results.length > 0 && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-muted-foreground">
              <span className="font-medium text-foreground">{results.length} matches</span>
              {stats
                ? ` from ${stats.scanned.toLocaleString()} postings on ${stats.boardsSearched} employer boards and ${stats.sourcesSearched - 1} job ${stats.sourcesSearched - 1 === 1 ? "site" : "sites"}${stats.duplicatesMerged ? ` · ${stats.duplicatesMerged} duplicate${stats.duplicatesMerged === 1 ? "" : "s"} merged` : ""}`
                : " from your last searches"}
            </p>
            <div className="flex items-center gap-1.5">
              <label className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <input type="checkbox" checked={hideLongShots} onChange={(e) => setHideLongShots(e.target.checked)} className="accent-foreground" />
                Hide long shots
              </label>
              <div className="ml-2 flex rounded-md border p-0.5 text-[12.5px]">
                {(["fit", "newest"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSort(s)}
                    className={cn("rounded px-2 py-0.5", sort === s ? "bg-muted font-medium" : "text-muted-foreground")}
                  >
                    {s === "fit" ? "Best fit" : "Newest"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <ul className="mt-3 divide-y overflow-hidden rounded-xl border bg-background">
            {shown.map((r) => (
              <ResultRow key={r.jobId} result={r} />
            ))}
          </ul>

          {params.get("q") && !running && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3 text-[13px]">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Bell className="size-4" />
                Want me to keep watching? I&apos;ll show new matches on your Today page.
              </span>
              <Button
                size="sm"
                variant={watching ? "ghost" : "outline"}
                disabled={watching}
                onClick={async () => {
                  setWatching(true);
                  await saveSearchAction(params.get("q") ?? query);
                  toast("Saved. Your agent will keep watching this search.");
                }}
              >
                {watching ? <Check data-icon="inline-start" /> : <BellRing data-icon="inline-start" />}
                {watching ? "Watching" : "Watch this search"}
              </Button>
            </div>
          )}
        </section>
      )}

      {!running && stats && results.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed p-8 text-center">
          <p className="text-[15px] font-medium">Nothing matched that exactly.</p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            I scanned {stats.scanned.toLocaleString()} postings. Try a wider area, drop the season, or paste a link to a job you found.
          </p>
        </div>
      )}
    </div>
  );
}
