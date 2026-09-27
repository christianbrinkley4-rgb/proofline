# Handoff: the bullet bank

**Goal.** A student adds one experience ("Bookkeeping assistant at a dental office") and Proofline offers bullet after bullet they can answer yes or no to. Every answer changes what comes next. Over time each student builds a bank of dozens to hundreds of true, approved bullets, and tailoring picks the best ones for each job.

Read `AGENTS.md`, `DESIGN.md`, `docs/PLAN.md` (latest sections), and `docs/research/RESUME-STANDARDS.md` first.

## Current implementation

The role-question source now includes O*NET 31.0 data: 18,838 tasks across 1,016 occupations. The safety and voice filters yield 7,051 base task questions, with optional method and result follow-ups after a task is confirmed (21,153 potential prompts). `lib/resume/onet-catalog.json`, `lib/resume/onet-tasks.ts`, and `lib/resume/onet-prompts.ts` hold the catalog, eligibility filters, and posting-aware ranking. The agent's read-only `get_role_task_prompts` tool returns up to 12 questions for an experience on the current person's profile. It can rank those questions against a full job description. The integration test confirms lookup saves no facts and cannot read another person's experience.

This is a question catalog, not a bank of claims about any individual. The per-person suggestion deck, persistent answer history, and accept/reject table are implemented on Profile. A yes saves a confirmed fact and active bullet in one transaction; a no saves no claim and suppresses related tasks. Tailoring now removes near-duplicate bullets across the page. Do not count occupational tasks or online success posts as verified personal accomplishments or hiring outcomes. Build those remaining parts using the confirmation rule below. See `docs/research/MOCK-APPLICANT-BENCHMARK.md` for the repeatable 200-profile, 800-posting synthetic check.


## The rule that matters most

Proofline never puts an unconfirmed claim on a resume. A suggestion is a **question**, not a bullet:

- A "yes" is the student confirming it. Save the accepted text as a confirmed fact (`source: "user_stated"`, `sourceDetail: "suggestion:<id>"`) and an **active** bullet whose `factIds` include that fact. Use `addFact` in `lib/kb/facts.ts`, and follow the insert pattern in `editBullet` in `lib/resume/bullets/service.ts`.
- **Never invent numbers.** A suggestion that needs one has a slot, e.g. `Reconciled [how many?] vendor accounts each month`. The student fills the slot before "yes" can be saved. A suggestion with no slot has no digits. `verifyBullet` in `lib/resume/verify.ts` must pass on every accepted bullet.
- A "no" never saves anything about the student. It only changes what's suggested next.

## What to build, in order (commit each slice separately)

### 1. Data and pure ranking (no UI)

- New table `bullet_suggestion` in `lib/db/schema.ts`: `id`, `userId`, `experienceId`, `text`, `taskId` (nullable), `kind` (`"reframe" | "likely_task" | "skill_angle"`), `skills text[]`, `sourceFactIds uuid[]`, `slot` (nullable, e.g. `"how many?"`), `status` (`"pending" | "accepted" | "rejected"`), `reason` (`"not_true" | "true_but_weak" | "wording"`, nullable), `batch int`, `generator`, `promptVersion`, `createdAt`, `answeredAt`. Generate a migration with drizzle-kit the way `drizzle/0007_*` was made. Migrations run at server start.
- `lib/resume/role-tasks.ts`: an offline library of common tasks per kind of experience, keyed by title keywords and the role families in `lib/jobs/roles.ts`. Cover at least: bookkeeping and accounting, front desk and reception, retail and cashier, food service, tutoring and teaching assistant, customer service and call center, warehouse, club officer or treasurer, research assistant, marketing and social media, data or analyst internships, and software projects. Each task has an `id`, a template (starting with a past-tense action verb from `lib/resume/verbs.ts`), skills tags that match names in `lib/fit/skills.ts`, an optional number slot, and `related` task ids.
- `lib/resume/suggest.ts`, pure and fully tested:
  - `candidates(experience, confirmedFacts, tasks)` produces **reframes** (the same confirmed fact from a different angle: result first, skill first, scope first; same numbers only), **likely tasks** for that title, and **skill angles** that line up with the student's target roles.
  - `rankSuggestions(candidates, history)` orders the next batch from past answers:
    - `not_true` suppresses that task, and lowers its `related` tasks for this experience.
    - An accepted task boosts its `related` tasks.
    - `true_but_weak` favors suggestions with a number slot or a result clause.
    - Skip anything too close to an existing bullet or earlier suggestion. Add a `nearDuplicate(a, b)` helper (normalized token overlap, or verb plus object) and use it.
    - Mix kinds so a batch isn't all one shape.
  - Every generated text must pass `findVoiceIssues` and `findWeakOpener` in `lib/voice/rules.ts`.

### 2. Server actions and the model path

- `app/app/profile/suggest-actions.ts`: `nextSuggestionsAction(experienceId, count = 5)`, `answerSuggestionAction(id, { answer: "yes" | "no", reason?, slotValue?, editedText? })`, and `bankStatsAction()`.
- A "yes" with an edit saves the student's edited text instead; `editedFromId` pairs become voice samples, as in `editBullet`.
- Optional model path: prompt `lib/llm/prompts/bullet-suggest.v1.ts`, used only when `getLlm()` returns a model. It may only rephrase the cited confirmed facts or propose common tasks for the title, and it must use slots instead of numbers. Validate the model output with zod, then run the same voice checks and slot rules as the offline path. Offline must work fully without a key.
- Log `suggestion_answered` agent events (`lib/agent/events.ts`) so the preference learner can use them later.

### 3. UI: the deck

- On each experience card on Profile (`components/profile/experience-card.tsx`), add a "Build my bullet bank" button. It opens a deck that shows one card at a time:
  - **Yes**, **No**, and **Edit** buttons, plus the keyboard shortcuts Y, N and E.
  - "No" asks one quick follow-up: *Not something I did* / *True, but weak* / *Wording is off*.
  - A slot shows as an inline input that must be filled before Yes saves.
  - A running counter: "37 bullets in your bank".
  - The next batch loads in the background as the deck runs low.
- Follow `DESIGN.md`: one primary action, `animate-view-in` between cards, no confetti, 375px wide without sideways scroll, and all copy passing `tests/site-copy.test.ts`.

### 4. Tailoring with a big bank

- `lib/resume/tailor.ts` already picks from all active bullets. With hundreds of them, add near-duplicate suppression, so two bullets saying the same thing never both land on one page, and keep the tailoring fast (measure it with 300 bullets in a test).

## Acceptance

- Unit tests for `role-tasks`, `candidates`, `rankSuggestions`, `nearDuplicate`, and the slot rules. The key test: a "not_true" answer means that task and its close relatives never come back for that experience.
- An integration test like `lib/agent/tools.test.ts` (in-memory PGlite): accepting a slotted suggestion creates one confirmed fact and one active bullet that passes `verifyBullet`, and a rejection creates neither.
- Browser check: with the dev login (`/api/dev/login?fresh=1&next=/app/profile`), add an experience, answer 10 cards, and see the counter and the Profile bullets update. Then paste a job on Today; the new bullets should be eligible for the three resumes.
- `npx tsc --noEmit`, `npx eslint app components lib`, and `npx vitest run` all pass.

## House rules

- Run only one dev server; a second process can't open `.data/pglite` (see `lib/db/index.ts`).
- Use a file-editing tool for code with regex backslashes; shell scripts on this machine have mangled them.
- No em dashes and no banned filler anywhere (`lib/voice/rules.ts`).
- Don't change the landing page, the design tokens, or the job workspace in this handoff.
- Update `docs/PLAN.md` with what shipped and what's next.
