# Build plan

Living document. Updated as slices land.

## Direction (from the founder, September 2026)

1. **Every account gets a personal agent** that learns and grows with the user.
2. **Users can bring their own AI** (Claude, ChatGPT, Gemini) instead of paying for ours.
3. **Free first.** The core loop has to work at $0.
4. **Measure against competitors** on job relevance, application time, document quality, and outcomes (see `research/COMPETITORS.md`).
5. **Only recommend the best bullets and templates** (see `research/RESUME-STANDARDS.md`).

6. **Students first, everyone welcome.** Students and recent graduates are the primary audience. School, degree, and internship history are optional; paid work, caregiving, training, projects, and volunteering can support a profile. The core path is: who you are and what you have done, what you want next, suggested roles, fit and gaps, then concrete steps to improve. A fit score is not a hiring probability.

## Architecture

```
                 ┌─────────────── Web app (Next.js) ───────────────┐
 Student ───────▶│ Onboarding · Profile · Jobs · Resumes · Tracker │
                 │               Agent workbench                  │
                 └───────────────────────┬─────────────────────────┘
                                         │
 Student's own Claude /                  ▼
 ChatGPT / Gemini ──MCP──▶  Tool layer (lib/agent/tools)  ◀── Proofline agent
                           search_jobs · score_fit · list_facts ·     (our key, or
                           propose_fact · tailor_resume · export ·     offline mode)
                           track_application · draft_follow_up
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              ▼                          ▼                          ▼
     Knowledge base               Job sources                Resume engine
     (facts + history,            Greenhouse, Lever,         standards, bullet score,
      preferences, voice,         Ashby, SmartRecruiters     templates, exact 1-page
      outcomes)                   + dedupe + fit engine      layout, PDF + DOCX
              │
              ▼
     Postgres (PGlite locally, Supabase or Neon in production)
```

**Guardrails live in the tool layer, not in prompts.** An outside assistant connected over MCP gets the same rules as our own agent: it can propose facts but not confirm them, and it cannot export a resume with an unconfirmed claim.

## The personal agent

Memory, all per user, all in Postgres:

- **Facts**: confirmed, unconfirmed, needs review. Append-only with history.
- **Preferences**: target roles, places, work mode, pay floor, deal-breakers. Stated in onboarding, then learned from saves and dismissals ("You've skipped 6 onsite roles. Should I stop showing onsite?").
- **Voice**: every edit the user makes to a generated bullet or email is kept as a sample, so later drafts sound like them.
- **Outcomes**: every application's result (no response, assessment, interview, offer, rejection) linked to the resume version, template, and job type. The agent learns what gets responses for this person.
- **Open questions**: what the agent still wants to know, asked at the right moment instead of all at once.

Proactive work: daily scans of saved searches, deadline and follow-up reminders, gap-closing suggestions from saved jobs.

## Cost model

| Piece | Runs on | Cost |
|---|---|---|
| Job search, dedupe, fit scoring, eligibility gates | Code + free public job board APIs | $0 |
| Resume layout, PDF/DOCX export, quality gate, bullet scoring | Code | $0 |
| Onboarding, knowledge base, tracker, reminders | Code | $0 |
| Writing (bullets, tailoring, cover letters, parsing messy resumes) | Offline templates by default; Claude when a key is set; or the student's own AI over MCP | $0 to provider-dependent usage cost when AI writing is enabled |
| Database | PGlite locally; Supabase or Neon free tier when deployed | $0 |

## Decisions (and why)

- **PGlite + Drizzle instead of a hosted Supabase project for now.** The Supabase account is at its 2-project free limit. PGlite is real Postgres running in-process, so the schema and migrations move to Supabase or Neon unchanged by setting `DATABASE_URL`.
- **Better Auth for accounts.** Open source, runs on our own database, has email/password, magic links, OAuth, and an MCP OAuth plugin for the bring-your-own-AI connector.
- **Rules-first engine, AI second.** Everything that can be deterministic is. AI makes the writing better but the product never depends on it being available.
- **Claude Opus 5 is the default model** when a key is set. The model is one environment variable, so switching to a cheaper model is a config change.

## Build order

| # | Slice | State |
|---|---|---|
| 1 | Scaffold, design system, landing page | Done |
| 2 | Database, auth, app shell | Done |
| 3 | Knowledge base, onboarding, resume upload and fact confirmation | Done |
| 4 | Resume standards engine, bullet scoring, bullet generator with verification | Done |
| 5 | Live job discovery and fit engine | Done |
| 6 | Three per-job resume strategies, comparison, PDF and DOCX export, quality gate | Done |
| 7 | Tracker with drag and drop, notes, fit guidance, follow-up drafts | Done |
| 8 | Personal agent: workbench, learning signals, tool layer, and MCP connector done; in-app chat planned | In progress |
| 9 | Landing page refresh | Done |
| 10 | Application packet: grounded cover letters (PDF/DOCX), interview prep with the student's own stories | Done |

## September 23 continuation

The personal history is a living profile, not a one-time intake. Students can add free-form work, classes, projects, research, volunteering, and wins from the Profile page. Their own statements become confirmed source facts; model-written bullets wait for explicit approval. Changing a fact invalidates affected resume exports.

For each job, a student can build and compare experience-first, skills-first, and keyword-match resume versions. Each version is saved as a snapshot. The tracker connects the chosen version with an application and records stage changes, strengths, gaps, action steps, notes, deadlines, follow-up reminders, editable draft emails, and a record of what the student says they sent. Proofline does not submit job applications or send emails.

## September 24 continuation

- **Resume import reads real layouts.** PDF text is rebuilt from item positions, so flush-right dates and places stay in their own column and wrapped bullets rejoin; DOCX list items keep their bullets. Proofline's own PDF and DOCX exports re-import exactly (tested).
- **Experiences are editable.** Name, role, kind, place, and dates can be corrected or the experience removed; facts and bullets stay attached.
- **Application packet** (`/app/jobs/[id]/packet`). The cover letter is drafted from confirmed evidence only, shows the facts behind each paragraph, and never invents why someone wants the job: that part stays a bracketed prompt until they write it, and downloads are refused until every check passes. With a key, Claude writes the middle paragraphs and every number is verified against cited facts. Interview prep pairs likely questions with the student's strongest story and flags required skills they haven't shown.
- **Bring your own AI.** `lib/agent/tools.ts` is the one tool layer for any AI; `/api/mcp` serves it over MCP with revocable personal access tokens (Settings). Proposals from an outside AI are unconfirmed and credited to it.
- **Search quality.** "Remote or anywhere" lifts place limits, aggregator listings older than 120 days are skipped, and one role in several cities shows once.
- **Local database safety.** Tests and `next build` use in-memory PGlite; a lock file stops a second process from opening `.data/pglite` (the cause of two corruptions). `/api/dev/seed` builds a full sample profile in development.

Later on September 24:

- **Chat with the agent** on the Agent page, over the same tool layer. With a key it's a streaming Claude tool loop; without one, a rules-based agent handles the common requests (next moves, search, watch a search, status, cover letter, prep, follow-up, saving a story).
- **Application questions** in the packet: grounded drafts for a form's short-answer questions, with bracketed prompts for what only the student knows.
- **Watched searches** rerun daily (on Today visits, "Check now", and `/api/cron/refresh-searches`), remember what they've shown, and surface new postings on Today.
- **Learning from dismissals**: repeated patterns become suggestions (skip on-site roles, a pay floor, a company, a kind of role) that change nothing until accepted. Search now applies deal-breakers and never re-shows a dismissed job.
- **Your data**: export everything as JSON or delete the account from Settings.
- **Import**: two-column PDFs and LinkedIn's Save to PDF read correctly; pasted text works too.
- **Database**: opened lazily, so Next's helper processes never touch it (the real cause of the corruption).
- **Talk it out**: browser dictation on Profile turns the student's reviewed words into confirmed source facts, drafts grounded bullets, and asks follow-up questions for missing numbers. Answering those questions regenerates the bullets with the new evidence. Typing works when speech recognition is unavailable.

Next: OAuth for browser-based connectors (claude.ai, ChatGPT); a profile timeline; email delivery for reminders and watched-search news; more job sources; outcome analysis once enough consented application history exists.

## September 24 role discovery and capture

- Onboarding can finish without a target job title. The signed-in home page suggests up to three role families from stated goals and confirmed profile evidence, with a reason for each suggestion and a search link. These are starting points, not available-job or hiring predictions.
- Search now shares its Workday page budget across two requested roles, gives multiple Muse categories separate bounded searches, and removes known work-mode mismatches. The employer registry is still finite; external relevance and coverage have not been benchmarked.
- A browser bookmark can carry a visible posting into a review form for jobs Proofline cannot fetch. The person checks and submits it; some sites may block bookmarks that run code.
- Fit guidance names missing skills and eligibility issues, and no longer treats a preferred degree as a requirement. Service, operations, healthcare, and trade skills have initial matching terms. The fit score remains evidence alignment, not a chance of being hired.
