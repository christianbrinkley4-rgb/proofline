# Proofline

Proofline helps someone turn their full life story into a job search they can understand and manage. They can record work, classes, research, projects, volunteering, and wins; review inferred facts; find roles; compare tailored resume versions; draft cover letters and prepare for interviews; and track every application and follow-up. Every exported resume bullet and cover letter claim cites confirmed source facts.

Proofline drafts but never sends email or submits applications. Students can connect their own AI (Claude, Cursor, and other MCP apps) with a personal access token, or chat with the in-app agent.

## Run locally

Requires Node 20 or newer.

1. Run npm install.
2. Copy .env.example to .env.local and set the values needed for your environment.
3. Run npm run dev and open http://localhost:3000.

PGlite is the default local database, stored in `.data/pglite`. It is single-process: a lock file stops a second process from opening it, and tests and `next build` use an in-memory database. Set PGLITE_DIR to run a production server alongside the dev server, or DATABASE_URL to use external Postgres.

In development, `/api/dev/login` signs in a test student and `/api/dev/seed` gives them a complete sample profile.

## Checks

- npm run typecheck
- npm run lint
- npm test
- npm run build

## Product flow

- Profile: import a resume (PDF or DOCX), add free-form life notes or talk through an experience, correct experiences, review proposed facts, and build source-backed accomplishment bullets.
- Jobs: search live sources and inspect fit, strengths, gaps, and eligibility limits.
- Resumes: create experience-first, skills-first, and keyword-match versions for a posting; preview and export one-page PDF/DOCX files. Stored versions preserve what was prepared for a job.
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
