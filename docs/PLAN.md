# Build plan

Living document. Updated as slices land.

## Direction (from the founder, September 2026)

1. **Every account gets a personal agent** that learns and grows with the user.
2. **Users can bring their own AI** (Claude, ChatGPT, Gemini) instead of paying for ours.
3. **Free first.** The core loop has to work at $0.
4. **Be better than every competitor** at what they do (see `research/COMPETITORS.md`).
5. **Only recommend the best bullets and templates** (see `research/RESUME-STANDARDS.md`).

## Architecture

```
                 ┌─────────────── Web app (Next.js) ───────────────┐
 Student ───────▶│ Onboarding · Profile · Jobs · Resumes · Tracker │
                 │                 Agent chat panel                 │
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
| Writing (bullets, tailoring, cover letters, parsing messy resumes) | Offline templates by default; Claude when a key is set; or the student's own AI over MCP | $0 to about $0.09 per tailored resume on Claude Opus 5 |
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
| 2 | Database, auth, app shell | |
| 3 | Knowledge base, onboarding, resume upload and fact confirmation | |
| 4 | Resume standards engine, bullet scoring, bullet generator with verification | |
| 5 | Live job discovery (4 sources) and fit engine | |
| 6 | Tailoring, templates, exact one-page PDF and DOCX export, quality gate | |
| 7 | Tracker with drag and drop, follow-up drafts | |
| 8 | Personal agent: memory, learning signals, chat, MCP connector | |
| 9 | Landing page refresh | |
