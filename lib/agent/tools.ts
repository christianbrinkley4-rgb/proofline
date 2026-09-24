import { z } from "zod";
import { jobPlan, loadJobProgress, loadJourney, storyReady } from "@/lib/agent/coach";
import { logEvent } from "@/lib/agent/events";
import { loadCandidate } from "@/lib/fit/candidate";
import { scoreFit } from "@/lib/fit/engine";
import { formatPay, searchJobs } from "@/lib/jobs/search";
import { THIN_RESULTS, widerSearches } from "@/lib/jobs/widen";
import { watchSearch } from "@/lib/jobs/saved";
import { getJobForUser, listMatches, requirementsOf } from "@/lib/jobs/store";
import { listExperiences } from "@/lib/kb/experiences";
import { addFact, factCounts, listFacts } from "@/lib/kb/facts";
import { getProfile } from "@/lib/kb/profile";
import { answerQuestion, listOpenQuestions } from "@/lib/kb/questions";
import { createStoryNote } from "@/lib/kb/story";
import { letterText } from "@/lib/packet/cover-letter";
import { draftAnswer, draftCoverLetter, packetView } from "@/lib/packet/service";
import { VARIANT_LABEL, type VariantId } from "@/lib/resume/document";
import { formatRange } from "@/lib/resume/parse/dates";
import { saveTailoredResume, tailorResume } from "@/lib/resume/tailor";
import { followUpDraft, StageSchema, STAGE_LABEL } from "@/lib/tracker/model";
import { getApplication, listApplications, moveApplication, trackJob } from "@/lib/tracker/service";

/**
 * The tools an AI can use on a person's behalf: Proofline's own agent, or the
 * person's Claude, ChatGPT, or Gemini connected over MCP. The rules live here,
 * in code, so every caller gets the same ones:
 *
 * - Anything an AI adds about the person is a proposal. Facts it proposes stay
 *   unconfirmed until the person says yes in Proofline.
 * - It can draft (resumes, letters, follow-ups) but never send, submit, or export a file.
 * - Every call is recorded as an agent event.
 */

export type ToolContext = {
  userId: string;
  email: string;
  /** Who is calling, e.g. "Claude" or "Proofline". Shown to the person next to proposals. */
  client: string;
  /** Live status lines for long tools (in-app chat). MCP callers leave this unset. */
  onStatus?: (message: string) => void;
};

export type AgentTool = {
  name: string;
  title: string;
  description: string;
  input: z.ZodRawShape;
  /** True when the tool only reads. */
  readOnly: boolean;
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
};

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const link = (path: string) => `${APP_URL.replace(/\/$/, "")}${path}`;

function tool<S extends z.ZodRawShape>(def: {
  name: string;
  title: string;
  description: string;
  input: S;
  readOnly: boolean;
  run: (args: z.infer<z.ZodObject<S>>, ctx: ToolContext) => Promise<unknown>;
}): AgentTool {
  return def as unknown as AgentTool;
}

export const TOOLS: AgentTool[] = [
  tool({
    name: "get_profile",
    title: "Get profile",
    description:
      "The student's basics (school, degree, graduation), job goals, and counts of confirmed and pending facts. Start here to understand who you're helping.",
    input: {},
    readOnly: true,
    run: async (_args, ctx) => {
      const [profile, facts, experiences] = await Promise.all([getProfile(ctx.userId), listFacts(ctx.userId), listExperiences(ctx.userId)]);
      return {
        name: profile?.fullName ?? null,
        school: profile?.school ?? null,
        degree: [profile?.degree, profile?.major].filter(Boolean).join(" in ") || null,
        graduation: profile?.gradDate ?? null,
        location: [profile?.city, profile?.region].filter(Boolean).join(", ") || null,
        goals: {
          roles: profile?.targetRoles ?? [],
          term: profile?.targetTerm ?? null,
          places: profile?.targetLocations ?? [],
          workModes: profile?.workModes ?? [],
        },
        experiences: experiences.map((e) => ({ id: e.id, kind: e.kind, org: e.org, title: e.title, dates: formatRange(e.startDate, e.endDate) })),
        facts: {
          confirmed: facts.filter((f) => f.verificationState === "confirmed").length,
          waitingOnStudent: facts.filter((f) => f.verificationState !== "confirmed").length,
        },
        profileUrl: link("/app/profile"),
      };
    },
  }),

  tool({
    name: "list_facts",
    title: "List facts",
    description:
      "Everything Proofline knows about the student, grouped by experience. Only facts with state \"confirmed\" may be used as claims in anything you write for them.",
    input: {
      experienceId: z.uuid().optional().describe("Limit to one experience."),
      includePending: z.boolean().optional().describe("Also return facts still waiting for the student to confirm."),
    },
    readOnly: true,
    run: async (args, ctx) => {
      const [facts, experiences] = await Promise.all([
        listFacts(ctx.userId, { experienceId: args.experienceId, states: args.includePending ? ["confirmed", "unconfirmed", "needs_review"] : ["confirmed"] }),
        listExperiences(ctx.userId),
      ]);
      const org = new Map(experiences.map((e) => [e.id, e.org]));
      return facts.map((f) => ({
        id: f.id,
        state: f.verificationState,
        category: f.category,
        content: f.content,
        experience: f.experienceId ? org.get(f.experienceId) ?? null : null,
        experienceId: f.experienceId,
      }));
    },
  }),

  tool({
    name: "propose_fact",
    title: "Propose a fact",
    description:
      "Suggest something true about the student that they told you, such as a result, a tool they used, or an award. It is saved as unconfirmed; the student must confirm it in Proofline before it can appear on a resume. Use their words and never add numbers they didn't give you.",
    input: {
      content: z.string().trim().min(3).max(500).describe("One specific statement, in the student's words where possible."),
      category: z.enum(["experience", "metric", "skill", "tool", "award", "certification", "education", "project", "leadership", "other"]),
      experienceId: z.uuid().optional().describe("The experience it belongs to, from get_profile."),
    },
    readOnly: false,
    run: async (args, ctx) => {
      if (args.experienceId && !(await listExperiences(ctx.userId)).some((e) => e.id === args.experienceId)) {
        throw new Error("That experience isn't on the student's profile. Call get_profile for valid ids.");
      }
      const fact = await addFact(ctx.userId, {
        content: args.content,
        category: args.category,
        experienceId: args.experienceId ?? null,
        source: "connector",
        sourceDetail: ctx.client,
      });
      return {
        id: fact.id,
        state: fact.verificationState,
        note: "Saved as a proposal. Ask the student to confirm it in Proofline; it won't be used until they do.",
        reviewUrl: link("/app/profile"),
      };
    },
  }),

  tool({
    name: "save_story_note",
    title: "Save a story note",
    description:
      "Save something the student told you about their life (a job, class, project, volunteer work, or a win) to their private notebook. Notes don't affect resumes or matches until the student turns them into evidence themselves.",
    input: {
      body: z.string().trim().min(4).max(4000).describe("What they said, as close to their words as possible."),
      context: z.string().trim().max(160).optional().describe("Where or what, e.g. a job or class."),
      when: z.string().trim().max(100).optional().describe("When it happened, if they said."),
    },
    readOnly: false,
    run: async (args, ctx) => {
      const note = await createStoryNote(ctx.userId, { body: args.body, context: args.context ? `${args.context} (via ${ctx.client})` : `via ${ctx.client}`, when: args.when });
      return { id: note.id, note: "Saved to the student's private notebook.", notebookUrl: link("/app/profile") };
    },
  }),

  tool({
    name: "list_open_questions",
    title: "List open questions",
    description: "Questions Proofline wants the student to answer so their evidence gets stronger (often a missing number). Ask the student, then pass their answer to answer_question.",
    input: {},
    readOnly: true,
    run: async (_args, ctx) =>
      (await listOpenQuestions(ctx.userId, { limit: 20 }))
        .filter((q) => q.kind !== "yes_no")
        .map((q) => ({ id: q.id, question: q.prompt, kind: q.kind })),
  }),

  tool({
    name: "answer_question",
    title: "Answer a question",
    description:
      "Record the student's own answer to an open question. The resulting fact is saved as unconfirmed until they confirm it in Proofline. Only pass what the student actually said.",
    input: {
      questionId: z.uuid(),
      answer: z.string().trim().min(1).max(1000),
    },
    readOnly: false,
    run: async (args, ctx) => {
      const result = await answerQuestion(ctx.userId, args.questionId, args.answer, "connector");
      if (!result) throw new Error("That question isn't open, or it needs the student to answer it in Proofline.");
      return { saved: Boolean(result.fact), factState: result.fact?.verificationState ?? null, reviewUrl: link("/app/profile") };
    },
  }),

  tool({
    name: "search_jobs",
    title: "Search jobs",
    description:
      "Live search of employer career sites and job boards from a plain-language request (e.g. \"accounting internships in Raleigh for summer 2027\"). Every result is scored 0 to 100 against the student's confirmed facts. Takes up to 30 seconds.",
    input: {
      query: z.string().trim().min(3).max(300),
      limit: z.number().int().min(1).max(25).optional(),
    },
    readOnly: false,
    run: async (args, ctx) => {
      const { intent, results, stats } = await searchJobs(ctx.userId, args.query, (event) => {
        if (event.type === "status") ctx.onStatus?.(event.message);
      });
      const thin = results.length < THIN_RESULTS;
      return {
        understood: { roles: intent.roles, level: intent.level, term: intent.term, places: intent.locations, modes: intent.modes },
        ...(intent.corrections?.length ? { readAs: intent.corrections.map((c) => `"${c.from}" as "${c.to}"`) } : {}),
        scanned: stats.scanned,
        matched: results.length,
        thin,
        ...(thin ? { widerSearches: widerSearches(intent, 4).map((w) => ({ label: w.label, query: w.query, why: w.why })) } : {}),
        results: results.slice(0, args.limit ?? 10).map((r) => ({
          jobId: r.jobId,
          title: r.title,
          company: r.company,
          location: r.location,
          pay: r.pay,
          fit: r.score,
          warning: r.cappedBy,
          url: link(`/app/jobs/${r.jobId}`),
        })),
      };
    },
  }),

  tool({
    name: "plan_application",
    title: "Plan the next step",
    description:
      "The coach's single next step. Without a jobId: where the student's current application stands in the loop (story, find, fit, resume, packet, track) and the one action to take now. With a jobId: the next step for that job. Call this before suggesting what to do, and offer to do the step with your tools when you can.",
    input: { jobId: z.uuid().optional().describe("A job from search results or the tracker.") },
    readOnly: true,
    run: async (args, ctx) => {
      if (!args.jobId) {
        const journey = await loadJourney(ctx.userId);
        return {
          focus: journey.focus ? { jobId: journey.focus.jobId, company: journey.focus.company, title: journey.focus.title } : null,
          loop: journey.steps.map((s) => `${s.label}: ${s.state}`),
          current: journey.current,
          next: { ...journey.action, url: link(journey.action.href) },
        };
      }
      const [jobs, facts, experiences, data] = await Promise.all([
        loadJobProgress(ctx.userId),
        factCounts(ctx.userId),
        listExperiences(ctx.userId),
        getJobForUser(ctx.userId, args.jobId),
      ]);
      if (!data) throw new Error("Job not found.");
      const progress = jobs.find((j) => j.jobId === args.jobId);
      const plan = jobPlan({
        resumes: progress?.resumes ?? 0,
        letter: progress?.letter ?? "none",
        stage: progress?.stage ?? null,
        capped: false,
        storyReady: storyReady({ confirmedFacts: facts.confirmed, experiences: experiences.length }),
      });
      const url = {
        story: link("/app/profile#start"),
        resume: link(`/app/resumes/compare?job=${args.jobId}`),
        packet: link(`/app/jobs/${args.jobId}/packet#letter`),
        prep: link(`/app/jobs/${args.jobId}/packet#interview`),
        apply: link(`/app/jobs/${args.jobId}/packet#tracking`),
      }[plan.primary];
      const tool = { story: "save_story_note", resume: "tailor_resume", packet: "draft_cover_letter", prep: "interview_prep", apply: "track_job" }[plan.primary];
      return { company: data.job.company, title: data.job.title, next: plan.primary, note: plan.note, url, toolThatHelps: tool, tracked: Boolean(progress?.stage) };
    },
  }),

  tool({
    name: "watch_search",
    title: "Watch a search",
    description:
      "Keep watching a job search for the student. Proofline reruns it about once a day and shows new postings on their Today page. Use a plain-language query like search_jobs takes.",
    input: { query: z.string().trim().min(3).max(300) },
    readOnly: false,
    run: async (args, ctx) => {
      const search = await watchSearch(ctx.userId, args.query);
      return { id: search.id, query: search.query, note: "Watching. New postings will appear on the student's Today page.", todayUrl: link("/app") };
    },
  }),

  tool({
    name: "list_matched_jobs",
    title: "List matched jobs",
    description: "Jobs from the student's recent searches and saved list, best fit first.",
    input: { savedOnly: z.boolean().optional() },
    readOnly: true,
    run: async (args, ctx) =>
      (await listMatches(ctx.userId, args.savedOnly ? ["saved"] : ["new", "saved"], 40)).map(({ job, match }) => ({
        jobId: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        pay: formatPay(job),
        fit: match.fitScore,
        saved: match.status === "saved",
      })),
  }),

  tool({
    name: "get_job_fit",
    title: "Explain job fit",
    description: "One posting with the student's fit score broken down: strengths, gaps, and any eligibility limits. Scored from confirmed facts only; it's an explanation of evidence, not a hiring prediction.",
    input: { jobId: z.uuid() },
    readOnly: true,
    run: async (args, ctx) => {
      const data = await getJobForUser(ctx.userId, args.jobId);
      if (!data) throw new Error("Job not found.");
      const { job } = data;
      const fit = scoreFit({ title: job.title, location: job.location, mode: job.mode, level: job.level, requirements: requirementsOf(job) }, await loadCandidate(ctx.userId));
      return {
        title: job.title,
        company: job.company,
        location: job.location,
        pay: formatPay(job),
        applyUrl: job.url,
        fit: fit.score,
        cappedBy: fit.cappedBy?.reason ?? null,
        strengths: fit.strengths,
        gaps: fit.gaps,
        points: fit.points,
        description: (job.description ?? "").slice(0, 4000),
        url: link(`/app/jobs/${job.id}`),
      };
    },
  }),

  tool({
    name: "list_applications",
    title: "List applications",
    description: "Every opportunity in the student's tracker, with stage, deadlines, and follow-up reminders.",
    input: {},
    readOnly: true,
    run: async (_args, ctx) =>
      (await listApplications(ctx.userId)).map((a) => ({
        applicationId: a.id,
        jobId: a.jobId,
        company: a.company,
        title: a.title,
        stage: STAGE_LABEL[a.stage],
        appliedAt: a.appliedAt?.toISOString().slice(0, 10) ?? null,
        deadline: a.deadline,
        followUpDue: a.stage === "applied" && a.nextFollowUpAt ? a.nextFollowUpAt <= new Date() : false,
        hasResume: Boolean(a.resumeId),
      })),
  }),

  tool({
    name: "track_job",
    title: "Track a job",
    description: "Add a job to the student's tracker as saved. Do this when they want to apply or keep an eye on it.",
    input: { jobId: z.uuid() },
    readOnly: false,
    run: async (args, ctx) => {
      const app = await trackJob(ctx.userId, args.jobId);
      return { applicationId: app.id, stage: STAGE_LABEL[app.stage], trackerUrl: link("/app/tracker") };
    },
  }),

  tool({
    name: "move_application",
    title: "Update application stage",
    description:
      "Move an application to a new stage when the student tells you what happened (for example, they applied or got an interview). Proofline never applies on their behalf.",
    input: { applicationId: z.uuid(), stage: StageSchema },
    readOnly: false,
    run: async (args, ctx) => {
      await moveApplication(ctx.userId, args.applicationId, args.stage);
      return { stage: STAGE_LABEL[args.stage] };
    },
  }),

  tool({
    name: "tailor_resume",
    title: "Tailor a resume",
    description:
      "Build a one-page resume for a job from confirmed facts only, and save it as a version the student can review and download in Proofline. Strategies: experience (default), skills, or ats (keyword match).",
    input: { jobId: z.uuid(), strategy: z.enum(["experience", "skills", "ats"]).optional() },
    readOnly: false,
    run: async (args, ctx) => {
      const variant: VariantId = args.strategy ?? "experience";
      const job = await getJobForUser(ctx.userId, args.jobId);
      if (!job) throw new Error("Job not found.");
      const result = await tailorResume(ctx.userId, { jobId: args.jobId, variant, email: ctx.email });
      const row = await saveTailoredResume(ctx.userId, args.jobId, result, { variant, name: `${job.job.company} ${VARIANT_LABEL[variant]}` });
      return {
        resumeId: row.id,
        strategy: VARIANT_LABEL[variant],
        onePage: !result.layout.overflow,
        bullets: result.why.map((w) => ({ text: w.text, why: w.reason })),
        cut: result.cuts.length,
        checks: result.checks.filter((c) => c.status !== "pass").map((c) => c.detail),
        reviewUrl: link(`/app/resumes/${row.id}`),
        note: "The student reviews and downloads the file in Proofline.",
      };
    },
  }),

  tool({
    name: "draft_cover_letter",
    title: "Draft a cover letter",
    description:
      "Draft a cover letter for a job from confirmed evidence, and save it to the job's packet. Pass `why` only if the student told you, in their own words, why they want this job; otherwise the letter keeps a prompt for them to fill in.",
    input: {
      jobId: z.uuid(),
      why: z.string().trim().max(1200).optional().describe("The student's own reason for applying, as they said it."),
    },
    readOnly: false,
    run: async (args, ctx) => {
      const letter = await draftCoverLetter(ctx.userId, args.jobId, args.why);
      const view = await packetView(ctx.userId, args.jobId);
      const profile = await getProfile(ctx.userId);
      return {
        text: letterText(letter, profile?.fullName ?? ""),
        checks: view?.checks.map((c) => ({ check: c.label, ok: c.ok, detail: c.detail })) ?? [],
        editUrl: link(`/app/jobs/${args.jobId}/packet#letter`),
      };
    },
  }),

  tool({
    name: "draft_application_answer",
    title: "Draft an application answer",
    description:
      "Draft an answer to a short-answer question from a job's application form, from confirmed evidence, and save it to the job's packet. Parts only the student knows (their motivation, the context of a story) come back as bracketed prompts for them to fill in; don't fill those in for them.",
    input: {
      jobId: z.uuid(),
      question: z.string().trim().min(5).max(1000),
      wordLimit: z.number().int().min(20).max(1000).optional(),
    },
    readOnly: false,
    run: async (args, ctx) => {
      const answer = await draftAnswer(ctx.userId, args.jobId, args.question, args.wordLimit ?? null);
      return { answer: answer.answer, needsStudentInput: /\[[^\]]{8,}\]/.test(answer.answer), editUrl: link(`/app/jobs/${args.jobId}/packet#questions`) };
    },
  }),

  tool({
    name: "interview_prep",
    title: "Interview prep",
    description: "Likely interview questions for a job, each with the student's strongest matching story (action and result) and tips. Help them practice; don't invent details of their stories.",
    input: { jobId: z.uuid() },
    readOnly: true,
    run: async (args, ctx) => {
      const view = await packetView(ctx.userId, args.jobId);
      if (!view) throw new Error("Job not found.");
      return view.prep.map((q) => ({
        question: q.question,
        why: q.why,
        story: q.story ? { where: q.story.org, text: q.story.text, action: q.story.parts.action, result: q.story.parts.result } : null,
        tips: q.tips,
      }));
    },
  }),

  tool({
    name: "draft_follow_up",
    title: "Draft a follow-up",
    description: "A short follow-up email draft for an application. Proofline never sends email; the student sends it and records it in the tracker.",
    input: { applicationId: z.uuid() },
    readOnly: true,
    run: async (args, ctx) => {
      const app = await getApplication(ctx.userId, args.applicationId);
      if (!app) throw new Error("Application not found.");
      const profile = await getProfile(ctx.userId);
      return { ...followUpDraft(app, profile?.fullName ?? ""), trackerUrl: link("/app/tracker") };
    },
  }),
];

export const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

/** Runs one tool with its input validated and the call recorded. */
export async function runTool(name: string, rawArgs: unknown, ctx: ToolContext): Promise<unknown> {
  const def = TOOL_BY_NAME.get(name);
  if (!def) throw new Error(`Unknown tool: ${name}`);
  const args = z.object(def.input).parse(rawArgs ?? {});
  try {
    const result = await def.run(args, ctx);
    await logEvent(ctx.userId, "connector_call", { tool: name, client: ctx.client, ok: true });
    return result;
  } catch (error) {
    await logEvent(ctx.userId, "connector_call", { tool: name, client: ctx.client, ok: false, error: error instanceof Error ? error.message.slice(0, 300) : "error" });
    throw error;
  }
}
