# Proofline

Proofline helps someone turn their full life story into a job search they can understand and manage. They can record work, classes, research, projects, volunteering, and wins; review inferred facts; find roles; compare tailored resume versions; and track every application and follow-up. Every exported resume bullet cites confirmed source facts.

The product currently drafts follow-ups but does not send email or submit applications. The Agent page is a workbench for next actions; chat, outside AI connections, and automatic outcome learning are planned.

## Run locally

Requires Node 20 or newer.

1. Run npm install.
2. Copy .env.example to .env.local and set the values needed for your environment.
3. Run npm run dev and open http://localhost:3000.

PGlite is the default local database. Set DATABASE_URL to use external Postgres. Use a separate PGLITE_DIR for an isolated production build while a dev server is running.

## Checks

- npm run typecheck
- npm run lint
- npm test
- npm run build

## Product flow

- Profile: import a resume, add free-form life notes, review proposed facts, and build source-backed accomplishment bullets.
- Jobs: search live sources and inspect fit, strengths, gaps, and eligibility limits.
- Resumes: create experience-first, skills-first, and keyword-match versions for a posting; preview and export one-page PDF/DOCX files. Stored versions preserve what was prepared for a job.
- Tracker: save jobs or add opportunities manually, move stages, keep notes and contacts, see improvement steps, set deadlines, draft follow-ups, and record messages after sending them.
- Agent: see the next actions based on the profile and applications.

The export gate rechecks current fact confirmation, cited bullets, and one-page layout immediately before generating a file. Model-written bullets need explicit user approval before they can be used.

## Code map

- app/app/ — signed-in pages and server actions
- app/api/ — auth, job search, and resume export endpoints
- components/ — product, marketing, and shared UI
- lib/kb/ — profile, experiences, facts, and open questions
- lib/jobs/ and lib/fit/ — job sources, search, and transparent scoring
- lib/resume/ — bullet verification, tailoring, layout, and PDF/DOCX rendering
- lib/tracker/ — application lifecycle and follow-up logic
- lib/agent/ — event signals for future learning
- docs/PLAN.md — roadmap and implementation state
- docs/research/ — standards and competitor research
- DESIGN.md — visual and copy conventions

The product name is centralized in lib/site.ts.
