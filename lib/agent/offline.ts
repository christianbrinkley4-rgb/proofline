import { careerDashboard } from "@/lib/career/service";
import { listMatches } from "@/lib/jobs/store";
import { familiesFor } from "@/lib/jobs/roles";
import { roleName } from "@/lib/jobs/text";
import { listApplications } from "@/lib/tracker/service";
import { loadJourney } from "./coach";
import { nextMoves } from "./next-moves";
import { TOOL_BY_NAME, runTool, type ToolContext } from "./tools";

/**
 * The agent without a model: common requests routed by rules to the same tools.
 * Free, instant, and honest about what it can't do in this mode.
 */

export type OfflineReply = { text: string; tools: Array<{ name: string; ok: boolean }> };

/** Early tool-start events so the chat UI can show a chip before a long tool finishes. */
export type OfflineEmit = (event: { type: "tool"; name: string; title: string }) => void;

const HELP = `Here's what I can do right now:

- **Find jobs**: "find accounting internships in Raleigh for summer 2027"
- **Watch a search**: "keep an eye on tax internships in Charlotte"
- **Plan your day**: "what should I do next?"
- **Explore your direction**: "I feel lost and do not know what career fits me"
- **Check your applications**: "where do my applications stand?"
- **Draft a cover letter**: "cover letter for Robinhood"
- **Prep for an interview**: "help me prep for Deloitte"
- **Draft a follow-up**: "follow up with Coinbase"
- **Save something you did**: just tell me, like "Last summer I ran the front desk at a dental office and cut check-in time in half."

For a question I do not recognize, start with [your career plan](/app/career) or a specific job on [Jobs](/app/jobs). This beta needs no API key from you.`;

type SearchResult = {
  scanned: number;
  thin?: boolean;
  readAs?: string[];
  widerSearches?: Array<{ label: string; query: string; why: string }>;
  results: Array<{ title: string; company: string; location: string | null; fit: number; warning: string | null; url: string }>;
};

type JobRef = { company: string; title: string; jobId: string | null; applicationId?: string };

async function knownJobs(userId: string): Promise<JobRef[]> {
  const [apps, matches] = await Promise.all([listApplications(userId), listMatches(userId, ["saved", "new"], 60)]);
  return [
    ...apps.map((a) => ({ company: a.company, title: a.title, jobId: a.jobId, applicationId: a.id })),
    ...matches.map(({ job }) => ({ company: job.company, title: job.title, jobId: job.id })),
  ];
}

/** The job whose company the message names, preferring tracked applications and the longest name. */
export function pickJob(message: string, jobs: JobRef[]): JobRef | null {
  const text = message.toLowerCase();
  const named = jobs.filter((j) => j.company.length > 1 && text.includes(j.company.toLowerCase()));
  if (!named.length) return null;
  return named.sort((a, b) => b.company.length - a.company.length || Number(Boolean(b.applicationId)) - Number(Boolean(a.applicationId)))[0];
}

export type Intent = "help" | "explore" | "next" | "search" | "watch" | "letter" | "prep" | "follow_up" | "status" | "story" | "unknown";

const WATCH = /\b(keep (an eye|watching)|watch for|watch|alert me|notify me|let me know (when|if)|tell me when)\b/;

/** "Keep an eye on accounting internships in Raleigh for me" -> "accounting internships in Raleigh". */
export function watchQuery(message: string): string {
  return message
    .replace(/^(can you|could you|please)\s+/i, "")
    .replace(/\b(keep an eye on|keep watching|watch for|watch|alert me (about|to|when there are|if there are)?|notify me (about|of|when there are)?|let me know (when|if) (there are|there's)?( new)?|tell me when (there are)?( new)?)\b/gi, "")
    .replace(/\b(for me|please|new)\b/gi, "")
    .replace(/\b(open up|come up|get posted|are posted|show up)\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.:]+|[\s,.?!]+$/g, "")
    .trim();
}

export function classify(message: string): Intent {
  const m = message.toLowerCase().trim();
  if (/cover letter/.test(m)) return "letter";
  if (/\b(lost|calling|purpose|career path|career goals?|what career|what to do with my life|don't know what (to do|i want)|dont know what (to do|i want)|figure out (my|what))\b/.test(m)) return "explore";
  if (WATCH.test(m) && /\b(jobs?|internships?|roles?|positions?|openings?|co-?ops?)\b/.test(m)) return "watch";
  if (/\b(interview|prep(are)?|practice)\b/.test(m)) return "prep";
  if (/\bfollow[- ]?up\b/.test(m)) return "follow_up";
  if (/\b(what('s| is)? next|what should i do|to-?do|what'?s due|catch me up|next steps?|next moves?)\b/.test(m)) return "next";
  if (/\b(applications?|tracker|where do i stand|status)\b/.test(m) && !/\b(find|search)\b/.test(m)) return "status";
  if (/\b(find|search|look(ing)? for|show me|any)\b[^.?!]*\b(jobs?|internships?|roles?|positions?|openings?|co-?ops?)\b/.test(m) || /^(\w+\s){0,3}(internships?|jobs?)\b/.test(m)) return "search";
  if (/^(i|i'm|i've|i was|last (summer|year|semester|spring|fall)|this (summer|year|semester)|at my|in my|my (job|internship|club|team|class))\b/.test(m) && m.split(/\s+/).length >= 6) return "story";
  if (/^(hi|hey|hello|help|what can you do|how does this work)\b/.test(m)) return "help";
  // A bare role, typos included ("business", "buisness internships"), is a search.
  const words = m.replace(/[^a-z0-9&+ -]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length <= 4 && familiesFor(words).length) return "search";
  return "unknown";
}

function list(items: string[]): string {
  return items.map((i) => `- ${i}`).join("\n");
}

function emitToolStart(emit: OfflineEmit, name: string) {
  emit({ type: "tool", name, title: TOOL_BY_NAME.get(name)?.title ?? name });
}

export async function offlineReply(message: string, ctx: ToolContext, emit: OfflineEmit = () => {}): Promise<OfflineReply> {
  const tools: OfflineReply["tools"] = [];
  const call = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
    try {
      const result = (await runTool(name, args, ctx)) as T;
      tools.push({ name, ok: true });
      return result;
    } catch (error) {
      tools.push({ name, ok: false });
      throw error;
    }
  };

  switch (classify(message)) {
    case "help":
      return { text: HELP, tools };

    case "explore": {
      const plan = await careerDashboard(ctx.userId);
      if (!plan.goal) {
        return {
          text: "You don't need to know your job title yet. Start with one clue: what is a real task that made you feel useful or curious, even outside paid work? Put that on [your career plan](/app/career), and we'll use it to choose a small experiment.",
          tools,
        };
      }
      const action = plan.actions[0];
      return {
        text: action
          ? `Your current direction is **${plan.goal.targetRole}**. ${action.detail} Start with [${action.title}](${action.href}). After you try it, save what you learned in [your career check-in](/app/career).`
          : `Your current direction is **${plan.goal.targetRole}**. Record what you learned and choose your next small experiment in [your career plan](/app/career).`,
        tools,
      };
    }
    case "next": {
      const [journey, moves] = await Promise.all([loadJourney(ctx.userId), nextMoves(ctx.userId)]);
      const { action } = journey;
      const where =
        journey.current === "done"
          ? "Your last application is out."
          : `You're on step ${journey.position} of 6 (${journey.steps.find((s) => s.state === "current")?.label}).`;
      const urgent = moves.filter((m) => (m.kind === "deadline" || m.kind === "follow_up") && m.href !== action.href).slice(0, 2);
      const also = urgent.length ? `\n\nAlso due:\n\n${list(urgent.map((m) => `[${m.title}](${m.href}): ${m.detail}`))}` : "";
      return { text: `${where} Here's the one thing to do now:\n\n**[${action.title}](${action.href})**. ${action.detail}${also}`, tools };
    }

    case "search": {
      emitToolStart(emit, "search_jobs");
      const result = await call<SearchResult>("search_jobs", { query: message, limit: 5 });
      const readAs = result.readAs?.length ? `I read ${result.readAs.join(" and ")}. ` : "";
      const wider = result.widerSearches?.length
        ? `\n\nWant to widen it? Pick one:\n\n${list(result.widerSearches.map((w) => `[${w.label}](/app/jobs?q=${encodeURIComponent(w.query)}): ${w.why.toLowerCase()}`))}`
        : "";
      if (!result.results.length) {
        return { text: `${readAs}I scanned ${result.scanned.toLocaleString()} postings and nothing matched that exactly.${wider || " Try a wider area or drop the season."}`, tools };
      }
      const lines = result.results.map((r) => `[${r.title}](${new URL(r.url).pathname}) at ${r.company}${r.location ? `, ${r.location}` : ""}: **${r.fit}** fit${r.warning ? ` (heads up: ${r.warning})` : ""}`);
      const next = result.thin ? wider : "\n\nNext: open the best one, read why it scored that way, and save it. Then I'll help you tailor a resume.";
      return { text: `${readAs}I scanned ${result.scanned.toLocaleString()} postings. The best fits for your confirmed story:\n\n${list(lines)}${next}`, tools };
    }

    case "letter":
    case "prep":
    case "follow_up": {
      const intent = classify(message);
      const jobs = await knownJobs(ctx.userId);
      const job = pickJob(message, jobs);
      if (!job?.jobId && !(intent === "follow_up" && job?.applicationId)) {
        const names = [...new Set(jobs.map((j) => j.company))].slice(0, 6);
        return {
          text: names.length
            ? `Which company? I have ${names.join(", ")} in your search and tracker. Try "${intent === "letter" ? "cover letter for" : intent === "prep" ? "prep for" : "follow up with"} ${names[0]}".`
            : "I don't see that company in your search or tracker yet. Find the job on [Jobs](/app/jobs) first.",
          tools,
        };
      }
      if (intent === "letter") {
        const draft = await call<{ checks: Array<{ check: string; ok: boolean }> }>("draft_cover_letter", { jobId: job.jobId });
        const needsReason = draft.checks.some((c) => !c.ok && /prompt/i.test(c.check));
        return {
          text: `I drafted a cover letter for the ${roleName(job.title)} role at ${job.company} from your confirmed evidence. ${
            needsReason ? "Add a sentence or two on why you want this job, in your own words, then" : "Read it once more, then"
          } review and download it in [your packet](/app/jobs/${job.jobId}/packet#letter).`,
          tools,
        };
      }
      if (intent === "prep") {
        const prep = await call<Array<{ question: string; story: { where: string | null; text: string } | null }>>("interview_prep", { jobId: job.jobId });
        const top = prep
          .filter((q) => q.story)
          .slice(0, 3)
          .map((q) => `**${q.question}** Your story${q.story!.where ? ` from ${q.story!.where}` : ""}: ${q.story!.text.replace(/[.\s]+$/, "")}.`);
        return { text: `Likely questions for ${job.company}, with the stories you already have:\n\n${list(top.length ? top : prep.slice(0, 3).map((q) => q.question))}\n\nPractice all ${prep.length} in [your packet](/app/jobs/${job.jobId}/packet#interview).`, tools };
      }
      if (!job.applicationId) return { text: `Track ${job.company} first and mark it Applied; then I can draft a follow-up. [Open the tracker](/app/tracker).`, tools };
      const draft = await call<{ subject: string; body: string }>("draft_follow_up", { applicationId: job.applicationId });
      return { text: `Here's a follow-up you can send from your email. Record it in the [tracker](/app/tracker) after you do.\n\n**Subject:** ${draft.subject}\n\n${draft.body}`, tools };
    }

    case "watch": {
      const query = watchQuery(message);
      if (query.length < 3) return { text: 'What should I watch for? Try "watch for accounting internships in Raleigh".', tools };
      await call("watch_search", { query });
      return {
        text: `Watching "${query}". I'll rerun it about once a day and put anything new on your [Today](/app) page. Manage watched searches on [Jobs](/app/jobs).`,
        tools,
      };
    }

    case "status": {
      const apps = await call<Array<{ company: string; title: string; stage: string; followUpDue: boolean; deadline: string | null }>>("list_applications", {});
      if (!apps.length) return { text: "Nothing in your tracker yet. Save a job from [Jobs](/app/jobs) or add one you found elsewhere in the [tracker](/app/tracker).", tools };
      const lines = apps.slice(0, 8).map((a) => `${a.company}, ${a.title}: **${a.stage}**${a.followUpDue ? " (follow-up due)" : ""}${a.deadline ? ` (deadline ${a.deadline})` : ""}`);
      return { text: `You're tracking ${apps.length} ${apps.length === 1 ? "opportunity" : "opportunities"}:\n\n${list(lines)}`, tools };
    }

    case "story": {
      await call("save_story_note", { body: message });
      return {
        text: "Saved to your story notebook. When you're ready, turn it into evidence on your [Profile](/app/profile) and I'll ask a question or two to make it stronger.",
        tools,
      };
    }

    default:
      return { text: `I'm not sure how to help with that yet.\n\n${HELP}`, tools };
  }
}
