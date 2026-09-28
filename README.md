# Proofline

Proofline is built first for students and recent grads, and works for job seekers who never attended college or are changing careers later in life. A person records work, classes, training, projects, volunteering, and wins; reviews inferred facts; describes what they want next; finds roles; sees how their evidence fits each role and what they could improve; prepares tailored documents and interviews; and tracks applications. Every exported resume bullet and cover letter claim cites confirmed source facts. The fit score explains alignment with a posting. It does not estimate the probability of being hired.

Proofline drafts but never sends email or submits applications. Users can connect their own AI (Claude, Cursor, and other MCP apps) with a personal access token, or chat with the in-app agent.

## Run locally

Requires Node 20 or newer.

1. Run npm install.
2. Copy .env.example to .env.local and set the values needed for your environment.
3. Run npm run dev and open http://localhost:3000.

PGlite is the default local database, stored in `.data/pglite`. It is single-process: a lock file stops a second process from opening it, and tests and `next build` use an in-memory database. Set PGLITE_DIR to run a production server alongside the dev server, or DATABASE_URL to use external Postgres.

In development, `/api/dev/login` signs in a test student and `/api/dev/seed` gives them a complete sample profile.

## Private beta

Who can sign up is set by `BETA_EMAILS`: `*` for anyone, or a list of addresses. The private beta ships one loop: tell us about yourself, paste a job, knockouts and a fit score, one tailored resume behind a review gate, download, a cover letter and interview prep, track. Other surfaces are hidden by `PRIVATE_BETA` in `lib/beta.ts`. Testers send feedback with the always-visible button; it lands in the `inbox_message` table. See the [private beta runbook](docs/handoff/PRIVATE-BETA.md) for env vars and the SQL to read feedback and the event funnel.

Before sharing a hosted link, configure a persistent Postgres `DATABASE_URL`, a unique `BETTER_AUTH_SECRET`, and both `BETTER_AUTH_URL` and `NEXT_PUBLIC_SITE_URL` set to the final HTTPS origin. Set `ANTHROPIC_API_KEY` only if the hosted beta should use paid AI drafting; rules-based features work without it. Vercel deployments fail fast if the database URL or authentication secret is missing. Keep `.env.local` and hosted secrets out of Git. See [beta sharing handoff](docs/handoff/BETA-SHARING.md).

## Checks

- npm run typecheck
- npm run lint
- npm test
- npm run build

## Product flow

- Profile: import a resume (PDF or DOCX), add free-form life notes or talk through an experience, correct experiences, review proposed facts, and build source-backed accomplishment bullets.
- Jobs: search live sources and inspect fit, strengths, gaps, and eligibility limits.
- Resumes: one best version per posting (the engine compares its layouts internally and keeps the strongest); preview and export one-page PDF/DOCX files after the review gate passes. Stored versions preserve what was prepared for a job.
- Packet: for each job, a grounded cover letter (PDF/DOCX, in the resume's template) and interview prep built on the student's own stories.
- Tracker: save jobs or add opportunities manually, move stages, keep notes and contacts, see improvement steps, set deadlines, draft follow-ups, and record messages after sending them.
- Agent: see the next actions based on the profile and applications.
- Settings: create tokens to connect an outside AI over MCP at `/api/mcp`.

The export gates recheck current fact confirmation, cited evidence, and layout immediately before generating a file. Model-written text needs explicit approval or must pass number verification against cited facts. Anything an outside AI proposes stays unconfirmed until the student confirms it.

## Code map

- app/app/: signed-in pages and server actions
- app/api/: auth, job search, resume and cover letter export, MCP, and development helpers
- components/: product, marketing, and shared UI
- lib/kb/: profile, experiences, facts, story notes, and open questions
- lib/jobs/ and lib/fit/: job sources, search, and transparent scoring
- lib/resume/: parsing, bullet verification, tailoring, layout, and PDF/DOCX rendering
- lib/packet/: cover letters, interview prep, and their evidence ranking
- lib/tracker/: application lifecycle and follow-up logic
- lib/agent/: the tool layer every AI uses, access tokens, and learning signals
- docs/PLAN.md: roadmap and implementation state
- docs/research/: standards and competitor research
- DESIGN.md: visual and copy conventions

The product name is centralized in lib/site.ts.
