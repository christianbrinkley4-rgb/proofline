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
- **Watched searches** remember postings already shown and surface new ones on Today. "Check now" runs a search on demand. Opening Today queues up to two searches older than four hours in the background; results appear on a later visit. In production, `/api/cron/refresh-searches` checks the oldest due searches once daily at 13:00 UTC, up to 20 or the function's time budget. [Vercel Hobby permits only one cron run per day](https://vercel.com/docs/cron-jobs/usage-and-pricing), with execution sometime within that hour. This is in-app news, not an instant or email alert. Production needs `CRON_SECRET` and a persistent `DATABASE_URL`; failed searches become eligible on the next run.
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

## September 24 coverage and freshness

- Search accepts worldwide queries and no longer defaults to U.S. results when the person has no target location. Company boards use a 30-minute in-memory cache.
- Himalayas and Jobicy add public global remote listings without keys. Each result points to and credits the provider. Their feeds have their own update windows; neither gives universal or instant coverage.
- A saved posting from a supported Greenhouse, Lever, Ashby, or SmartRecruiters board can add that board to the person's later searches. Discovery is user-scoped and capped at 12 boards.
- Watched searches become eligible after four hours when the person visits Today. The hosted cron stays daily to fit Vercel Hobby limits and checks up to 20 due searches per run. A persistent database and `CRON_SECRET` are required in production.
- Wider coverage needs licensed feeds, employer or ATS partnerships, source health metrics, and event-based delivery where publishers provide it. Coverage and detection delay must be measured by source and region before making stronger claims.

## September 24 coach and design refresh

- **"business" search fixed.** The business family now matches bare "business" titles (Business Intern, Business Development, rotational and leadership programs) and keeps engineering titles out. Common misspellings ("buisness", "busness", "acounting") map to the right family, plus a narrow fuzzy fallback (swaps and one missing or extra letter only, so "produce" stays "produce"). Business searches reach wide across the employer registry. A live "business internships" search found 43 matches from 19,216 postings.
- **Thin searches suggest the next one.** Under five matches, Jobs offers neighboring role families and the same role without the place or season (`lib/jobs/widen.ts`). The agent tool returns the same suggestions, and the offline agent offers them as links.
- **The coach** (`lib/agent/coach.ts`): one application walked through Story, Find, Fit, Resume, Packet, Track. Today leads with a six-step rail and one action. The job page leads with one ordered next step (story, resume, packet, apply, or prep). The packet is three steps in order with the rest collapsed. An empty Profile shows one coach entry (upload, talk, or type). Onboarding no longer finishes hollow: with no real evidence it asks for one experience first. Next moves add cold-start story, per-job resume, and packet moves.
- **Chat**: `chat.v2` prompt makes the agent end every reply with one next action, chain tools (search, track, tailor, letter), and disambiguate vague searches instead of guessing. New `plan_application` tool (also over MCP) returns the coach's next step.
- **Design**: green-tinted neutrals, deep forest ink for primary, soft atmospheric washes with grain, Bricolage Grotesque display type, a rebuilt landing (hero with the product as its visual, six-step walkthrough, coach band), and onboarding motion (directional slides, word-by-word agent lines, staggered choices). See DESIGN.md.
- **Dev**: `/api/dev/login?fresh=1&next=/app` signs in a brand-new student to walk the first-run path.

Next: measure whether students finish the loop (step reached per week); give the coach rail a "switch job" control; a scroll-driven version of the landing walkthrough; widen the employer registry for business and operations roles.

## September 24 resume-first focus

Proofline now leads with the resume, not the search. Students find jobs on LinkedIn, Indeed, and Handshake anyway; Proofline's edge is building the best true resume for each one.

- **Loop** (`lib/agent/coach.ts`): Your resume (confirmed facts and a general resume), Paste a job, Three resumes, Close the gaps. Cover letter, tracking, and prep follow. A student who pastes a job before building a general resume isn't sent back for one.
- **Paste box** (`components/coach/paste-job-box.tsx`) on Today and Jobs: a link is fetched when the site allows; otherwise the pasted posting's title, company, and place are read from the text (`lib/jobs/guess-posting.ts`) for the student to check. Either way they land on the job with three resumes building.
- **Job workspace** (`/app/jobs/[id]`): fit strengths and gaps, the three resumes with the best one picked by how many requirements it visibly shows (`screeningReport`), then "Make it stronger".
- **Gap loop** (`lib/fit/gaps.ts`, `app/app/jobs/[id]/gap-actions.ts`): each required, preferred, or posting skill the student hasn't shown becomes a question. An answer is saved as their own confirmed facts (the experience in their words, plus the skill), bullets are written and verified against those facts, and the fit is rescored. "Not yet" is remembered across jobs (agent events) and can be undone. Degree, years, and eligibility gaps show as advice. Resumes built before new evidence are flagged for a one-click rebuild.
- **Agent**: `plan_application` with a job returns fit, gap questions, and rebuild status; `chat.v2` coaches through the gaps without writing claims for the student.
- Verified in the browser: a Staff Accountant Intern posting went from 4 of 6 requirements shown to 5 of 6 (fit 80 to 86) after one gap answer and a rebuild; a pasted posting's title, company, and place were read correctly and its three resumes built on arrival.

Next: resume polish checks from career-center guidance (contact info, quantified bullets, tense consistency, typos, buzzwords); per-job keyword mirroring in the skills line; a way to switch which job the coach is focused on.

## September 24 resume polish

Career-center guidance (Harvard's "Create a strong resume" and common recruiter tips the founder collected) mapped onto the engine. Already enforced: single column, standard fonts, one page, X-Y-Z bullets, action verbs, tailoring, relevance cuts. Added:

- Tailoring fixes form automatically: past tense for roles that ended, spacing and capitals, repeated skills merged, soft skills kept off the Skills line.
- Seven more quality checks (12 total): contact line with LinkedIn, share of bullets with numbers, tense, proofreading, repeated skills, requirements shown on the page, and a longer buzzword list. Tailored resumes show "N of 12 checks passed" and the next fix on the job page.
- Why no summary, and how keyword mirroring stays honest: see docs/research/RESUME-STANDARDS.md.

Next: let a student edit a tailored bullet inline and have the checks rerun live; suggest the specific number question for each unmeasured bullet from the resume page.
