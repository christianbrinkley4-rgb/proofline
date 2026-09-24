"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, LoaderCircle, RotateCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatRecord } from "@/lib/agent/chat-store";
import { cn } from "@/lib/utils";
import { RichText } from "./rich-text";

type ToolState = { name: string; title?: string; ok?: boolean };
type Turn = { id: string; role: "user" | "assistant"; text: string; tools: ToolState[]; pending?: boolean; status?: string };

const TOOL_LABEL: Record<string, string> = {
  get_profile: "Read your profile",
  list_facts: "Read your facts",
  propose_fact: "Proposed a fact",
  save_story_note: "Saved a note",
  list_open_questions: "Checked open questions",
  answer_question: "Recorded your answer",
  search_jobs: "Searched jobs",
  watch_search: "Watching a search",
  list_matched_jobs: "Checked your matches",
  get_job_fit: "Checked fit",
  list_applications: "Read your tracker",
  track_job: "Tracked a job",
  move_application: "Updated a stage",
  tailor_resume: "Tailored a resume",
  draft_cover_letter: "Drafted a cover letter",
  draft_application_answer: "Drafted an answer",
  interview_prep: "Built interview prep",
  draft_follow_up: "Drafted a follow-up",
  plan_application: "Planned your next step",
};

const SUGGESTIONS = ["What should I do next?", "Find business internships for summer 2027", "Where do my applications stand?", "Help me prep for an interview"];

export function AgentChat({ initial, mode }: { initial: ChatRecord[]; mode: "model" | "offline" }) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>(initial.map((r) => ({ id: r.id, role: r.role, text: r.text, tools: r.tools })));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [turns]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    const replyId = `r-${Date.now()}`;
    setTurns((t) => [...t, { id: `u-${Date.now()}`, role: "user", text: message, tools: [] }, { id: replyId, role: "assistant", text: "", tools: [], pending: true }]);
    const update = (fn: (turn: Turn) => Turn) => setTurns((t) => t.map((turn) => (turn.id === replyId ? fn(turn) : turn)));
    let changed = false;
    try {
      const res = await fetch("/api/agent/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }) });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | { type: "text"; delta: string }
            | { type: "tool"; name: string; title: string }
            | { type: "tool_done"; name: string; ok: boolean }
            | { type: "status"; message: string }
            | { type: "done" }
            | { type: "error"; message: string };
          if (event.type === "text") update((turn) => ({ ...turn, text: turn.text + event.delta }));
          else if (event.type === "tool") update((turn) => ({ ...turn, tools: [...turn.tools, { name: event.name, title: event.title }], status: undefined }));
          else if (event.type === "status") update((turn) => ({ ...turn, status: event.message }));
          else if (event.type === "tool_done") {
            if (!["get_profile", "list_facts", "list_open_questions", "list_matched_jobs", "get_job_fit", "list_applications", "interview_prep", "draft_follow_up"].includes(event.name)) changed = true;
            update((turn) => {
              const i = turn.tools.findIndex((t) => t.name === event.name && t.ok === undefined);
              const tools = i >= 0 ? turn.tools.map((t, j) => (j === i ? { ...t, ok: event.ok } : t)) : [...turn.tools, { name: event.name, ok: event.ok }];
              return { ...turn, tools, status: undefined };
            });
          } else if (event.type === "error") update((turn) => ({ ...turn, text: turn.text ? `${turn.text}\n\n${event.message}` : event.message }));
        }
      }
    } catch {
      update((turn) => ({ ...turn, text: turn.text || "I couldn't reach the server. Check your connection and try again." }));
    } finally {
      update((turn) => ({ ...turn, pending: false }));
      setBusy(false);
      // Refresh counts and lists elsewhere on the page when the agent changed something.
      if (changed) router.refresh();
    }
  }

  return (
    <section className="flex min-h-[32rem] flex-col rounded-xl border bg-background">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-brand" />
          <h2 className="text-[15px] font-semibold tracking-tight">Ask your agent</h2>
        </div>
        {turns.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              await fetch("/api/agent/chat", { method: "DELETE" });
              setTurns([]);
            }}
          >
            <RotateCcw data-icon="inline-start" />
            New conversation
          </Button>
        )}
      </header>

      <div className="max-h-[65vh] flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-5" aria-live="polite">
        {turns.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-[14px] font-medium">What can I help with?</p>
            <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-5 text-muted-foreground">
              I work from your confirmed story. I draft; you decide what to send.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border px-3 py-1.5 text-[12.5px] text-muted-foreground hover:border-border-strong hover:text-foreground">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((turn) =>
          turn.role === "user" ? (
            <div key={turn.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-muted px-3.5 py-2 text-[13.5px] leading-6 whitespace-pre-wrap">{turn.text}</p>
            </div>
          ) : (
            <div key={turn.id} className="max-w-[92%] text-[13.5px] leading-6">
              {turn.tools.length > 0 && (
                <div className="mb-2">
                  <div className="flex flex-wrap gap-1.5">
                    {turn.tools.map((t, i) => (
                      <span key={i} className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11.5px] text-muted-foreground", t.ok === false && "border-pending/40 text-pending-ink")}>
                        {t.ok === undefined ? <LoaderCircle className="size-3 animate-spin" /> : t.ok ? <Check className="size-3 text-brand" /> : <X className="size-3" />}
                        {TOOL_LABEL[t.name] ?? t.title ?? t.name}
                      </span>
                    ))}
                  </div>
                  {turn.pending && turn.status ? <p className="mt-1.5 text-[11.5px] leading-4 text-muted-foreground">{turn.status}</p> : null}
                </div>
              )}
              {turn.text ? <RichText text={turn.text} /> : turn.pending ? <LoaderCircle className="size-4 animate-spin text-muted-foreground" aria-label="Thinking" /> : null}
            </div>
          ),
        )}
        <div ref={bottom} />
      </div>

      <form
        className="border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <div className="flex items-end gap-2 rounded-xl border bg-background px-3 py-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/25">
          <textarea
            aria-label="Message your agent"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Ask about jobs, your applications, or tell me about something you did..."
            className="max-h-40 min-h-6 flex-1 resize-none bg-transparent text-[13.5px] leading-6 outline-none placeholder:text-subtle-foreground"
          />
          <Button type="submit" size="icon-sm" aria-label="Send" disabled={busy || !input.trim()}>
            {busy ? <LoaderCircle className="animate-spin" /> : <ArrowUp />}
          </Button>
        </div>
        <p className="mt-2 px-1 text-[11.5px] leading-4 text-subtle-foreground">
          {mode === "model"
            ? "Anything I learn about you waits for your confirmation on the Profile page."
            : "Quick mode: I handle common requests without an AI model. Connect your own AI in Settings for open conversation."}
        </p>
      </form>
    </section>
  );
}
