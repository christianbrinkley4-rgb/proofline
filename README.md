# Proofline

A web app that takes a student from "I need a job" to hired: profile, job discovery, fit scores, tailored one-page resumes, applications, tracking, follow-ups, and interview prep, in one loop. Every resume line traces back to a fact the user confirmed.

"Proofline" is the working name. It lives in one place, [`lib/site.ts`](lib/site.ts).

## Status

| Phase 1 slice | State |
| --- | --- |
| 1. Scaffold, design system, landing page | Done |
| 2. Auth, onboarding, knowledge base model | Next |
| 3. Resume upload and fact confirmation | |
| 4. Bullet generator with verification prompts | |
| 5. Natural-language job discovery and fit score | |
| 6. Tailoring engine and DOCX/PDF export | |
| 7. Application tracker | |

## Setup

Requires Node 20 or newer.

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

```bash
npm test             # unit tests (Vitest)
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run build        # production build
```

Copy `.env.example` to `.env.local` when a slice needs keys. Slice 1 needs none.

## Architecture map

```
app/                      Next.js App Router pages and global styles (tokens in globals.css)
components/ui/            shadcn/ui primitives (Radix base)
components/brand/         Logo and mark
components/marketing/     Landing page sections
  product-demo/           Interactive demo in the hero (find, score, tailor, track)
lib/site.ts               Product name, URLs, routes
lib/voice/rules.ts        Voice rules: em dashes, banned filler, weak bullet openers
lib/fit/rubric.ts         Fit score rubric (six components, eligibility gates)
lib/demo/sample-data.ts   Made-up student, companies, and postings for the demo
tests/                    Cross-cutting tests (site copy follows the voice rules)
```

Coming with the next slices:

```
lib/llm/provider.ts       Provider interface. Anthropic first, swappable.
lib/llm/prompts/          Versioned prompts (v1, v2...). Never inline in components.
lib/kb/                   Append-only fact store with verification states
lib/jobs/sources/         Greenhouse and Lever board clients, dedupe, ranking
supabase/migrations/      Database schema
```

## Where prompts live

`lib/llm/prompts/`, versioned by file (`bullets.v1.ts`, `bullets.v2.ts`). Components call typed functions in `lib/`, never a prompt string. The first prompts land in slice 3.

## Quality gate

The export quality gate (slice 12) blocks on factual failures and warns on style. Its style checks are already live in [`lib/voice/rules.ts`](lib/voice/rules.ts) and run in three places today:

- `npm test` checks the rules themselves, the demo's resume bullets, and every file of site copy.
- The landing page demo's "Checks" panel runs the same functions on the sample resume.
- New copy that uses an em dash or a banned word fails `npm test`.

## Design

See [DESIGN.md](DESIGN.md) for tokens, type, spacing, motion, and copy rules.

## Decisions that change the brief

Logged so they can be reversed on purpose, not by accident.

1. **Eligibility gates on the fit score.** The six weighted components stay as specified (30/25/15/15/10/5). On top of them, a failed hard requirement (graduation window, license, work authorization, a stated deal-breaker) caps the score at 40 and says why. A 78 you can't apply to is worse than useless. See `lib/fit/rubric.ts`.
2. **Amber "pending" status next to the single green accent.** Unconfirmed facts have to be visibly marked. Amber is used only for things waiting on the user, never decoratively.
3. **Made-up companies in the demo.** Real employer names next to fake postings could read as endorsements or real openings. The demo is labeled as sample data.
4. **Voice rules as code from day one.** The same module will power the export quality gate, so the site and the product can't drift apart on tone.
5. **Light-only marketing site for now.** Dark tokens exist so components stay theme-safe. The app UI can add a toggle later.
6. **No LLM code in slice 1.** The provider interface arrives with the first real call (slice 3) instead of as an empty stub.
