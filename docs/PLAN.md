# Build plan

Living document. Updated as slices land.

**Picking this up? Read [handoff/CURSOR-NEXT.md](handoff/CURSOR-NEXT.md) first:** current state, the owner's test results, and what to fix next, in order.

## September 29 design pass (branch `design-system`, not merged or deployed)

The owner supplied four specs (design system, browser extension, discovery feed, one-click prefill) and asked for only changes that make the product better. Spec 01 ran first on its own branch. The existing tokens, type, and radii were already coherent, so the font swap to Inter, the blanket 8px radius, and a parallel `design/tokens.ts` were skipped as churn. What landed, one commit each:

- Dark mode: green-leaning `.dark` tokens (the old ones were stock zinc and purple), light by default, Settings > Appearance offers Light, Dark, Match my device. `scripts/screenshots.mjs` captures light and dark at desktop and 390px and flags overflow.
- My facts: each fact shows the day it was confirmed; deletes use an in-page dialog (`components/shared/confirm-delete.tsx`) instead of `window.confirm`.
- Tailor review: passed checks fold into "N checks passed", so failing ones stand out (the phone page is about 1,000px shorter).
- Tracker: counters and filters appear only once something is tracked.
- Job page: the score counts up once (CSS `count-up`, no hydration flash, reduced motion respected).
- Landing: the hero grain is a masked layer instead of a background image, so it no longer delays largest paint; Geist Mono isn't preloaded. Error copy owns the failure.

Verification: 768 tests, typecheck, lint, production build. Keyboard: every tab stop on onboarding, both job tabs, My facts, and Settings shows a focus ring. No horizontal overflow at 390px in either theme. Lighthouse (mobile, simulated, median of 3 on a local production build): home 87, /check 88, login 93, guides 94, privacy 92; accessibility 98 to 100; CLS 0. Home and /check are still under 90: with real device throttling the landing page spends about 2s on style and layout across the long page and the interactive demo. `content-visibility: auto` on lower sections was tried and reverted because it broke direct links such as `/#faq`. Signed-in pages weren't scored by Lighthouse (the dev login is off in production builds).

Specs 03 and 04 overlap work that already exists (job search already pulls Greenhouse and Lever boards; the tracker and packet exist) and were not started.

## September 29 fit badge on job sites (spec 02, branch `browser-extension`, not merged or deployed)

The extension (0.2.0) now shows the fit score on LinkedIn, Indeed, and Handshake job pages. `extension/sites.js` reads the posting's title, company, location, and description (several selectors per field, then the block under "About the job", then JobPosting data), waits for the page to settle, and scores again only when a different job opens, including LinkedIn's switch-without-reload. The badge opens a panel: knockouts first, then each component's arithmetic, then Open in Proofline, which saves the job and opens its page. That button stays pinned; only the middle scrolls. Signed out, the badge says "Sign in to see your fit" and opens `/login?next=/app/extension` (login now honors `next` for someone already signed in). A page it can't read offers "Paste it in Proofline" instead of a guess.

`POST /api/extension/score` (`lib/extension/score.ts`) calls the same `scoreFit` and `checkKnockouts` as a saved job and stores nothing; a test proves its score equals the saved job's score for the same posting. It logs `extension_scored` (score and whether there's a knockout, not the posting). `background.js` makes every request, so the token never enters a job site's page, and caches scores for the session (15 minutes). No new API permissions: the job sites are content-script matches only. The Connect page, popup, and Settings say what it reads and never reads. Store listing copy and screenshots are in `docs/extension-store/`.

Verification: 771 tests, typecheck, lint, production build. `node scripts/check-extension.mjs` loads the unpacked extension in Playwright's Chromium against synthetic pages for each site (`tests/fixtures/job-sites/`) and the local dev server; every step passed: signed out, connect, a score on LinkedIn search (724ms), LinkedIn public (668ms), Indeed (769ms), and Handshake (1,364ms, including the page's own 700ms render), panel order, the LinkedIn job switch with its new knockout, the unreadable fallback, and Open in Proofline landing on `/app/jobs/<id>`, light and dark. A live public LinkedIn job page read cleanly (title, company, location, and the full 4,452-character description) and scored. Not verified live: Indeed blocks headless browsers, and Handshake and signed-in LinkedIn need an account, so check those by hand in Chrome and Edge.

Hardening pass, same day:

- Indeed's live 2026 layout was checked in a real browser and its selectors were missing: the title is now `[data-testid="vj-job-title"]`, the company is the `/cmp/` link in `company-info-metadata`, the place is read from that unlabeled header, and the description is what follows the "Full job description" heading. The heading fallback now reads what follows a heading before its parent, so Indeed's "Explore other jobs" list below the description is never sent. A synthetic fixture of that layout is in the check.
- `POST /api/extension/score` is limited to 150 requests per account per 10 minutes (`rateLimiter` in `lib/check/rate-limit.ts`, now shared with the public check).
- Cached scores are dropped whenever the person opens or leaves a Proofline app page (`connect.js` now runs on `/app/*`), and a job tab asks again when it comes back into view. The Connect handshake also works after in-app navigation to `/app/extension`.
- Faster: the badge reads once on load instead of waiting for quiet, and the settle window is 300ms. A job's identity includes its description, so a site that fills the description in after the title gets a fresh score.
- The privacy note has a Browser extension section, which the store listing links to.

Verification: the check passes with badges in 228 to 412ms on LinkedIn and Indeed pages (Handshake 1,290ms including its 700ms render), a cached revisit in 143ms with no request, a fresh request after visiting Proofline, and every posting sent complete. On live LinkedIn search, profiling 25 seconds of scrolling with five job switches put the extension's own script at 17ms of about 1.9s of page script. Live Indeed extraction read the right title, company, place, and the full 6,665-character description.

Live check signed in to LinkedIn and Handshake (the owner signed in; the agent read only job pages):

- Signed-in LinkedIn had moved to a new layout (`/jobs/search-results/`) that none of the selectors matched, with generated class names and no `h1`. The badge now reads the tab title (checked against the open job's column), the line under it for the place, and the description box under "About the job". Checked on two jobs, an in-page switch, and a signed-in `/jobs/view/` page. LinkedIn's note about the person's profile missing qualifications is outside what's read.
- Handshake's search page has its own `h1` "Jobs", which the old fallback would have taken as the title. The badge now reads the job pane (`right-content`, or `job-details-page` on a job's own page): title, employer, place ("Onsite, based in Bedford, TX" becomes Bedford, TX; several places keep the first), At a glance (which carries "US work authorization required" for the knockout check), the description, and the listed qualifications, without Handshake's profile-match lines or AI summary. Handshake shows only about 450 of 1,800 characters until More is clicked and keeps no full copy in the page, so the panel says the score uses part of the description and rescores about 400ms after More. The extension doesn't click it or call Handshake's private data API.
- New fixtures (`linkedin-2026.html`, and `handshake-job.html` rebuilt on the live structure) keep these in the check, which passes: badges in 258 to 309ms on LinkedIn and Indeed, Handshake 1.2 to 1.4s including its fixture's 700ms render, and a cached revisit in 13ms. 772 tests, typecheck, lint.

Edge: `node scripts/check-extension.mjs --browser edge` loads the unpacked extension in the installed Microsoft Edge 154 (fresh profile) and every check passes. Store screenshots were retaken on a made-up posting with fictional employers and no real site's branding (`docs/extension-store/source/posting.html`, `scripts/store-screenshots.mjs`), including one with a graduation knockout. Publishing is the only step left for the owner.

## September 29 new-task discovery across careers

The owner clarified that Add some facts should uncover different work, not repeat existing bullets, and must serve people beyond the owner's profile. Recall previously offered saved-fact method/result follow-ups with a ranking boost; those could dominate fresh duties. Recall now offers only new core occupational tasks. Confirmed facts and active bullets provide relevance context and exclusion evidence, never reframe cards. Old pending fact follow-ups are omitted and cannot be saved through stale tabs. Legacy bank behavior remains compatible.

Matching uses the shared O*NET catalog across occupations and work, volunteering, leadership and projects. Unfamiliar titles can use specific activity and occupation clues; selected software/web/reporting project clues supplement the general matcher. Tools or broad interests alone do not establish an occupation. Part-time/full-time/contract/seasonal/freelance labels no longer distort common-duty title matching. If no supported different tasks remain, the page requests more specific work or title details instead of recycling the bank. No owner's name, account or career is hardcoded; discovery makes no model request and sends no profile to Gemini.

Duplicate checks normalize tense, quantities and common synonyms, compare the subject of broad cues against specific saved work, and exclude accepted/rejected activities. This reduces repetition but is not an exhaustive semantic-paraphrase guarantee. The shared bank currently has 6,020 distinct usable common-duty cues; occupational core relevance remains population survey evidence, not an individual's probability. Occupational wording adapters remain proposals requiring confirmation. The XYZ composer, review receipts and explicit confirmation still govern every save.

Validation: 768 tests across 84 files, typecheck, lint and production build passed. Discovery checks cover the full 6,020-cue bank, 24 careers across four experience kinds, decorated titles, unfamiliar projects and specific gardening context, rejection, exhaustion and old pending cards. Synthetic localhost browser checks verified a new task replacing saved-line follow-ups, the correct part-time bookkeeping occupation, skip advancement, basic wording review with fresh confirmation, exact saved text, a different next card, pause/resume, project discovery and no console errors. At 375px the page and dialog had no horizontal overflow. Production credentials and real accounts were not used.

The known Gemini HTTP 402 billing blocker and broader career-product readiness gates remain open; these discovery checks do not prove real model recovery or universal coverage of every career and language.


Commit `1162262` is live at https://proofline-beta.vercel.app as Ready production deployment `dpl_Cvnuqhgt8jQqKoqYb3Qt2vCnd8ma`. The Vercel cloud build passed; public checks returned home 200, signed-out My facts 307 to login, and development login 404. Reload old tabs to use new-task discovery. Signed-in checks used synthetic local data; real provider recovery remains unverified.

## Direction (from the founder, September 2026)

1. **Every account gets a personal agent** that learns and grows with the user.
2. **Users can bring their own AI** (Claude, ChatGPT, Gemini) instead of paying for ours.
3. **Free first.** The core loop has to work at $0.
4. **Measure against competitors** on job relevance, application time, document quality, and outcomes (see `research/COMPETITORS.md`).
5. **Only recommend the best bullets and templates** (see `research/RESUME-STANDARDS.md`).

6. **Students first, everyone welcome.** Students and recent graduates are the primary audience. School, degree, and internship history are optional; paid work, caregiving, training, projects, and volunteering can support a profile. The core path is: who you are and what you have done, what you want next, suggested roles, fit and gaps, then concrete steps to improve. A fit score is not a hiring probability.

## September 27 private beta (2 to 5 testers)

Proofline is scoped down to one loop for invited testers (`lib/beta.ts` hides the rest; the code stays):

- **Access**: `BETA_EMAILS` allowlist enforced twice in `lib/auth.ts` (request hook and user-create hook). Password reset works; without an email provider the link is stored in `inbox_message` for the owner to forward.
- **Onboarding** (`components/onboarding/beta-flow.tsx`): tell us about yourself (education, experience with 2 to 4 lines, projects, skills and licenses, where and when you can work), paste your first job, land on its fit score. Education and one experience are required; everything else can be skipped.
- **Fact base** (`lib/facts/base.ts`, `/app/facts`): every claim is a confirmed fact in the user's exact words. Edit re-confirms; delete takes it off every resume. The `facts` view gives the spec's columns.
- **Knockouts** (`lib/fit/knockouts.ts`): graduation window, work authorization, location and work mode, start date. Shown before the score, never blended into it; a knockout turns tailoring off.
- **Score**: the same six weights, each row with its math and a reason per item; plus what the role rewards and one pattern across saved roles (`lib/fit/insights.ts`). Keywords (`lib/jobs/keywords.ts`) are stored per job.
- **Tailor** (`lib/resume/tailor-best.ts`): one best resume per job, skills in the posting's wording only when it names the same thing. Gap questions become facts only on explicit confirm.
- **Review gate** (`lib/review/*`): 16-check linter (blocking: one page, em dashes, unconfirmed claims, banned content), then one Gemini Flash-Lite call keyed by `PROOFLINE_REVIEW_KEY`, capped at 50 calls per user per day. Export requires both, fingerprinted to the exact resume and facts.
- **Tracker**: 14-day follow-up, Mark as sent, confirmation reference, deadline column, search, optimistic moves.
- **Owner tools**: feedback button and contact form store to `inbox_message`; funnel events in `event_log`. Runbook: `docs/handoff/PRIVATE-BETA.md`.

Verified locally in the browser end to end; the model review was verified against a local stub of the Gemini endpoint, not the real model.

## September 26 readiness

The resume and cover-letter core is locally testable, but the hosted beta is intentionally on hold. After Claude Code's second UI pass and backend integration, the checkout passed 554 tests across 61 files, typecheck, lint without errors, and a production build. The deterministic 200-profile/800-posting evaluation also passes after the latest matching fixes. These checks cover consistency and claim support; they do not establish that a document wins interviews.

Career planning now stores a chosen or exploratory direction, an optional real posting benchmark, evidence snapshots, reflections, completed exploration steps, and next actions. The agent can read that history. This is a first coaching loop, not the full life-coach product. Next priorities are full-flow user testing, consent-based quality/outcome feedback, broader goal domains, and recommendations that adapt to what a person actually tried. No foundation model has been fine-tuned on private resumes or self-reported Reddit success posts.
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
- **Outcomes**: the tracker records application stages. Linking outcomes to exact document versions and using them to evaluate recommendations is planned; outcome signals need consent and careful interpretation.
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

- **PGlite locally, Neon for the hosted beta.** PGlite is real Postgres running in-process. A Neon Free project is prepared, with migrations through 0012 applied and the career and shared model-budget tables verified.
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
| 8 | Personal agent: workbench, guarded tools, MCP connector, in-app chat, and career-plan context | In progress |
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

## September 25 personal bullet bank

Profile now offers an answerable bullet deck for each experience. It draws from confirmed facts, curated tasks, and the O*NET occupation catalog; the person can confirm, edit, or reject each card. A confirmed card becomes a sourced fact and active bullet atomically. Rejections are remembered, including related tasks that were marked untrue. The deck shows a running active-bullet count and source credit for O*NET wording. Tailoring removes near-duplicate bullets when selecting from a large bank. The occupational catalog remains a question source, not a set of claims about an individual or proof of hiring outcomes.

Job gap questions now look across the person's past role titles and the occupation catalog for plausible tasks related to missing posting requirements. The UI names the prior experience, asks whether the task happened, and requires the person's own description before saving anything. Tasks previously rejected as untrue are excluded.

## September 28 competitive plan, Phase 1

A new competitive brief (`research/COMPETITORS.md`) found that the market is racing toward volume (auto-apply, autofill, AI-written resumes) while hiring teams struggle to verify anything. Nobody owns truth. The plan to win on it is `COMPETE-PLAN.md`. Phase 1 is done:

- **Landing** leads with "The resume you can defend in the interview." A new "Why it's different" section compares typical AI resume and auto-apply behavior with Proofline's, and the FAQ answers how it differs from other builders and ChatGPT. It makes no pricing promise beyond the beta; pricing is still an open owner decision.
- **Inline editing** on the tailored resume: select any bullet (or Edit this line / Edit here in the review), confirm it's true, save. A line that is one of the person's bullet facts re-confirms that fact (`editFact`); any other line becomes a new confirmed fact via `editBullet`. The resume rebuilds and the gate reruns (`editLineAction` in `app/app/jobs/[id]/tailor-actions.ts`).
- **Packet unhidden for testers.** Cover letter, application answers, and interview prep ship in the beta. The Resume tab links to them once the review passes; beta links point to the job's Resume tab and My facts instead of hidden pages.
- **LinkedIn profile kit** (`/app/facts/linkedin`, `lib/linkedin/profile-kit.ts`): headline, About, role descriptions, skills, and certifications from confirmed facts only, with copy buttons and LinkedIn's limits. The goal line stays a prompt for the person to write.

Next (Phase 2 in `COMPETE-PLAN.md`): the free public "Can you defend every line?" check, a review-first browser extension, spoken mock interviews grounded in the person's stories, and gap-to-project suggestions. Owner decisions still open: post-beta pricing, a paid job-search provider, and publishing an extension.

## September 28 competitive plan, Phase 2

All four Phase 2 items from `COMPETE-PLAN.md` are built, each checked in the browser and covered by tests:

- **Free public check** (`/check`, `lib/check/defend.ts`, `app/api/check`): paste or upload a resume, optionally a job. It lists every line with a number and the question an interviewer would ask about it, flags words that promise a size without giving one, runs the linter's content checks, and shows which posting terms appear, in the posting's own wording. Rules only, no account, nothing stored, rate-limited per address. Linked from the site header and footer.
- **Spoken mock interviews** (`lib/packet/practice.ts`): each prep question has a mic (browser dictation) and How did that sound? Rules-based feedback covers length for the kind of question, situation and result, I versus we, any number said that isn't a confirmed fact, whether the strongest story came up, honest gap answers, naming the company, and cliches. There's no live in-interview copilot, and the page says so.
- **Gap to earned evidence** (`lib/fit/earn.ts`): a skill marked Not yet gets one small project with an honest time range and a free resource from the tool's maker or a long-standing public source (every link checked). I did it, ask me again reopens the question so the person's own answer becomes the fact. Soft skills, paid credentials, and enterprise systems get no suggestion.
- **Browser extension** (`extension/`, `/app/extension`, `app/api/extension/*`): save the posting on the page, fill empty basic fields from the profile with every field outlined, and mark Applied. It never submits and skips sensitive questions. It connects through a scoped token handed over on the Connect page. Testers install it unpacked from `public/proofline-extension.zip` (`npm run extension:build`). See `extension/README.md`.

Still the owner's call: post-beta pricing, a paid job-search provider, and publishing the extension to the Chrome Web Store.

## September 28 pasted job details

A Handshake-style header was being read as the company. "Posted 3 weeks ago" produced the avatar initials "Pw", and "Onsite, based in Alexandria, VA" was kept whole. `lib/jobs/guess-posting.ts` now skips posted-ago and apply-by lines, rejects one- or two-character company guesses, and keeps the city. On a pasted job, "Fix title, company, or place" updates the title, company, and location the resume and score use (`updateJobDetails`). Shared listings are not renamed.

## September 28 competitive plan, Phase 3 (started)

- **Proof links** (`lib/proof/share.ts`, `/proof/[slug]`, migration 0015): once a resume passes review, the person can share a noindex page that shows each line, how it was worded, and the confirmed fact behind it, without contact details. It vouches only for what's true (nothing invented or inflated by software; Proofline doesn't contact employers), stops vouching if the facts change, and Stop sharing ends it at once. Verified end to end against a local stand-in for the review model (`PROOFLINE_REVIEW_BASE_URL`), not the real model.

- **Guides** (`/guides`, `lib/guides/content.ts`): three sourced guides (putting a defensible number on a bullet, ATS myths, what makes writing read as AI), each ending at the free check. A sitemap and robots rules list the public pages and keep `/app`, `/api`, and `/proof` out of search.

Remaining Phase 3 items need the owner or real data: a career-center pilot (who to approach, what a counselor may see), a paid job-search provider, and publishing outcomes once enough consented tracker history exists.

## September 28 one imported role line

An imported job, internship, club, or volunteer role that already has one line can be saved with that line (`saveRoleStepAction` in `app/app/onboarding/beta-actions.ts`). A role typed from scratch still needs two lines. The form keeps the imported line, does not write a second one, and still waits for the person to confirm it.

## September 28 tense within one entry

Tailoring keeps one tense inside a role or project. A current role or ongoing project (the date line says Present) uses present tense. A role that ended, and an entry with no dates, uses past tense. Only the opening verb changes. Numbers and the rest of the line stay as confirmed.


## September 28 education and contact continuation

- Onboarding keeps up to six education entries, including more than one degree at the same school. Each degree owns its GPA, honors, coursework, and any extra imported lines. Extra lines such as "CPA candidate" start unchecked and are saved only when the person checks that line. Leaving a line unchecked creates no fact.
- My facts groups education by degree and supports adding or removing an entry, adding its honors or coursework, and editing individual facts. Adding a school preserves earlier schools and their details. Legacy education remains editable; cleared GPA facts are not regenerated from mirrored profile fields.
- Imported LinkedIn, website, and resume email fields now reach the save action. My facts has a contact editor. Resume and cover-letter headers use the saved resume email instead of substituting the sign-in address; leaving it blank keeps it off the page. Existing resume snapshots need a rebuild after a contact edit. Migration 0016 adds `profile.contact_email`.
- Tailoring renders both degrees, with sourced details on the correct entry. GPA and honors sharing a line both contribute source ids, so removing an honor blocks export of a version that still cites it. Account isolation and duplicate-entry validation happen before education is changed.
- Validation: 705 tests across 80 files, typecheck, lint without warnings, production build, and the 200-profile/800-posting synthetic benchmark passed. PDF and DOCX text checks preserve both degrees, GPA, honors, coursework, and contact links. The local browser check covered pasted import, an unchecked candidate credential, a one-line imported role, contact editing, and phone/desktop layouts. Local checks used a stand-in review model; the real production review remains to be rerun.

The owner reported replacing the production review key with Cursor. Commits `8623e2d` and `d75791f` are now live on `https://proofline-beta.vercel.app` (Ready deployment `dpl_4H2gu7aYhTCxv5meS7WdbEz7VXR3`). The cloud build passed. Public pages, the signed-out login boundary, and the production-only exclusion of dev login were checked. The configured secret and absence of recent failure logs do not establish that a model call succeeded. Next: rebuild and rerun review on the owner's real posting. Existing pasted job metadata and already-confirmed education need the person's corrections or re-import; this change does not reconstruct facts lost by an older import.


## September 28 continuing fact cards

My facts now has a prominent Add some facts button and Suggest more facts on each role or project. The dialog lets the person pick an experience and work through one card at a time: No advances without adding evidence; Yes opens editable wording and numbers, and an unchecked confirmation box. Save and next question creates a confirmed fact and active sourced bullet, then loads the next card. Pause leaves the unanswered card available for later.

Onboarding no longer requires two initial task lines. The person can confirm the job title, organization, and dates first, with zero task lines, and the saved role immediately offers recall questions. Existing imported lines stay intact.

The new recall flow uses O*NET core occupational tasks with a stricter title match and organization/fact context, plus method/result questions about the person's own confirmed work. Unrated curated guesses and supplemental tasks are excluded from new occupational cards. O*NET core classification requires relevance >=67% and importance >=3.0 (https://www.onetcenter.org/dictionary/31.0/csv/task_statements.html); relevance describes surveyed workers, not a calibrated probability that this individual performed a task. Matching uses no invented personal percentage. Generic titles with no reliable match need a more specific title or an initial fact.

Cards use concise duty wording, a clear Yes/No and edit/save flow, and a collapsible Why this card? explanation naming the matched occupation or confirmed activity. The voice-rule test now covers the new screens and recall wording. Method and result prompts reflect the person's edited line, not the unedited occupational template. Filled details become newly confirmed evidence; they are not falsely attributed to the original source fact. Answered cards do not repeat, and role headers are not proposed as accomplishments. There is no 100-line storage cap and no promise to fabricate a target number of lines: a regression test keeps a 121-line bank intact while tailoring selects a late-added relevant bullet for a posting.

Validation: typecheck, lint, 726 tests across 82 files, production build, and local browser checks passed. The browser flow covered editing a number, explicit confirmation, No advancing without saving, persistence on My facts, changing experiences, a title-only cashier role immediately receiving questions, no console errors, and the 375px and desktop layouts.

Every recall card now uses an editable X-Y-Z draft: a strong action verb and accomplishment (X), a count/frequency/change supplied by the person (Y), and their method (Z). Unknowns remain bracketed cues in a draft. A separate result field supports an actual improvement percentage, without requiring an invented one. The live preview keeps supplied numbers verbatim. Save requires all three parts and an explicit confirmation on both client and server; placeholders, weak/overused openers, and missing details cannot enter the bank. Result follow-ups prefill only existing supplied details. Legacy bank cards stay separate from this versioned recall flow.

The existing catalog contains 18,838 tasks for 1,016 occupations, including 14,071 core tasks. After common-duty grammar and voice filtering, 5,997 distinct usable prompts remain, before personal follow-ups. `recallCatalogSize` and regression tests count distinct duties rather than rewordings. Formal cashier/accounting/inventory phrases were simplified, clipped clauses omitted, and mixed imperative verbs removed. This is a large shared occupational question bank; a person's role only receives relevant tasks.

Final local UI checks saved a synthetic XYZ line with a contribution count and 20% result, verified that the next card loaded and the bank count rose, skipped a payment duty without adding a fact, and verified the saved wording after reload. The 375px editor has no horizontal overflow and all confirmation controls are reachable. No production account or credential entry was used.

Commit `3fb7590` is live on https://proofline-beta.vercel.app as Ready production deployment `dpl_EVtZiCoLmm1QDaXueHtzKjGKWUr6`. The cloud build passed; public pages return 200, My facts redirects signed-out visitors to login, and the development login remains unavailable on production. Signed-in feature checks used localhost and synthetic data.


## September 28 fluent XYZ bullets

The owner asked that filled X/Y/Z answers read as one polished bullet on every card. The shared composer now integrates quantities with the correct noun, uses real frequencies without parentheses, turns first-person/present-tense notes into past-tense actions, distinguishes tools from action methods, fixes parallel method tense, and leads with supplied outcomes when clear. Estimates, ranges, money, percentages, and original denominator values remain unchanged. An unexplained percentage or an uncountable task with a bare count asks for clarification; nothing is inferred. Supporting work stays supporting work.

The live preview and server use the same composer. Every save must contain the exact finished text the person reviewed, so a stale client or changed preview cannot silently confirm different wording. Editing clears the checkbox and inputs pause during a save. Raw structured answers stay alongside the confirmed fluent line for follow-ups; supplied results are not asked again. Existing confirmed lines are not bulk rewritten.

The full-bank regression audit covers 6,000 distinct usable templates and 24,000 compositions with method/result variants. Additional cases cover named units, passive-vs-active experience, singular counts, shorthand frequencies, percentage results, participation, preserved numbers, saved raw parts, and stale-preview rejection. Final checks passed: 741 tests in 82 files, typecheck, lint, and build. Local browser checks verified live wording, number changes clearing confirmation, exact preview/save text, next-card advancement, no console errors, and no phone overflow at 375px. Production credentials and accounts were not entered.


Commit `b15542b` is live on https://proofline-beta.vercel.app as Ready production deployment `dpl_CGJqn3VNeaC5B74imhWpbtppMCZf`. The cloud build passed. Live route checks returned 200 for the home page and /check, redirected signed-out My facts visitors to login, and returned 404 for development login. Signed-in wording and save checks used localhost with synthetic data. Reload any previously open tab before confirming a new card so its preview uses the deployed composer.


## September 29 whole-sentence recall review and metric choices

The owner supplied a real awkward example: a marketing duty followed by "for booked 50 percent more appointments". Local composition now recognizes full quantitative actions and percentage comparisons in Y as outcomes, rather than appending them as units. Y offers a dropdown for a count/amount (with unit and optional timeframe), percentage change (value, direction, and what changed), frequency, or their own wording.

Save rereads all X/Y/Z answers together through the existing Gemini review service/key, with the owner's explicit approval to send only that card's answers. A dedicated prompt rewrites and rereads the complete sentence, removes occupational-template padding, preserves support/ownership, and asks for clarification rather than guessing. Numeric meaning (including currency and percent), timeframes, estimates, action openers, and voice rules are checked in code. Provider errors, unsafe output, and quota limits retain the answers and block saving. No configured model uses a visibly labeled basic local check.

If the reviewed sentence matches the confirmed preview, it saves. If wording changes, "Did you mean this?" displays the revision and clears confirmation; no evidence exists until the person confirms the exact revision. Edit my answers returns to the form. Server-held review receipts are scoped to account, card, exact raw answers, prompt version, and 30-minute expiry; stale clients cannot save without review. Unchanged reviews are cached so approval does not trigger another model call. Raw parts remain attached to the confirmed fact; old facts are not silently rewritten. No database migration is needed.

Local browser verification used synthetic insurance work and a local model test double, not a real provider key or production account. It reproduced the owner's free-text example, exercised count/frequency/percentage controls, verified the unchecked revision before save, returned to edit answers, saved exactly the reviewed sentence, advanced to the next card, and found no console errors. At 375px the dialog was 343.2px with every field inside the viewport; desktop also passed. The saved line was: "Booked 50 percent more appointments by developing insurance marketing strategies using an automation system I designed". This test double verifies the flow, not real model quality; a real signed-in provider request remains to be verified on beta. The privacy note and save guidance now disclose wording review through Gemini. Final validation passed: 754 tests in 83 files, typecheck, lint, and production build.

Commit `94dee68` is live on https://proofline-beta.vercel.app as Ready production deployment `dpl_C5H3UjsEhou6aB4XZAHnkSQFaJtU`. The cloud build and live public-route/login-boundary checks passed; the deployed privacy note includes Gemini wording review. CLI 61.0.0 returned Not authorized, but the prior CLI 60.1.3 recognized the existing account and deployed successfully without changing credentials. Use `npx vercel@60.1.3 --prod --yes` for this checkout until the CLI authentication difference is resolved. Reload old tabs before saving recall cards. Signed-in flow verification used synthetic local data and a model test double; a live signed-in Gemini request remains unverified.


## September 29 beta readiness audit

The owner's standard is a product that helps people figure out their career. The current deployed beta has substantial verification for applications and resumes; it is not signed off as the complete career product or for wider promotion. See [BETA-READINESS.md](BETA-READINESS.md) for evidence, ordered gates and acceptance scenarios.

Real signed-in Gemini review with the replaced key and the owner's original-versus-corrected resume/export comparison remain unverified. Production account recovery currently uses manual delivery; repeated model-backed cards need capacity validation and observed user sessions. Career plans and agent chat remain hidden by PRIVATE_BETA. Existing exploration actions are four general steps; reflection content does not drive their selection. Direction comparison, practical experiments and guidance that adapts to what the person learned are substantive product work, not just a switch to expose the existing pages.

This slice records a readiness audit and criteria. It changes documentation only, does not claim additional production checks passed, and does not enable hidden surfaces. Prior code validation remains 754 tests in 83 files, typecheck, lint and build; the sentence-review browser flow used a local model test double.


## September 29 provider billing outage and recall recovery

The owner reported "The wording review could not finish safely" while saving a card. Bounded live logs show two recall requests returning HTTP 402. Google's current Gemini billing documentation says a zero prepaid balance stops requests with 402; the billing account itself has not been inspected. Gemini 3.5 Flash-Lite has a free tier, but a key on a paid/prepaid project does not automatically switch to it. See https://ai.google.dev/gemini-api/docs/billing and https://ai.google.dev/gemini-api/docs/pricing. The owner must inspect the key's project in AI Studio Billing and resolve its plan/balance; no payment, key or billing setting was changed by the agent.

Recall now distinguishes an unavailable provider from a rejected sentence or incomplete response. Errors no longer imply that the person's answers were unsafe. In an edited card, retry keeps all answers and no longer offers a destructive Load next question shortcut. Provider/quota outages offer an explicit basic wording check, which runs the shared composer and all number/timeframe/estimate/ownership/voice validation without an external call or model credit. Its draft is visibly labeled as not AI-reviewed, always clears confirmation, and cannot save until the person confirms that exact sentence. Unsafe model output and clarification do not silently fall back. Model and basic review receipts are cached separately; the receipt version is recall-wording.v2. The resume export review gate is unchanged and still needs the provider.

Verification: focused provider/service tests cover the production 402, no evidence on failure or basic review, no provider call/credit for explicit basic review, exact confirmation, and separate caches. The full suite passed 758 tests in 83 files; typecheck and lint passed. A local synthetic 402 provider reproduced the failure in the browser: retry kept X/Y/Z/result, basic review left the bank unchanged and confirmation unchecked, edit returned original answers, and explicit confirmation saved one exact line, advanced the card and persisted after reload. At 375px the page width remained 375px and no inputs or controls overflowed; browser console errors were empty. Production AI review remains blocked until the billing issue is resolved; local tests do not prove it recovered.


Commit `9aa8953` is live at https://proofline-beta.vercel.app as Ready production deployment `dpl_8btrqyfTD94H1ub3NTqzoHBUecKY`. The Vercel cloud build passed. Post-deployment checks returned 200 for home, 307 for signed-out My facts, and 404 for development login. Signed-in recovery behavior was verified locally with a synthetic 402 provider; actual Gemini billing recovery has not been verified. No billing settings or credentials were changed.
