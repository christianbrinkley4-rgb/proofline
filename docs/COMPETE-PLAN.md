# Plan: beat the resume and career tools by owning "true"

## Context

The competitive brief (now in `docs/research/COMPETITORS.md`, researched 2026-09-28) found:

- **The market is racing toward volume**: Jobright's auto-apply agent, Simplify's free autofill, LinkedIn's Apply Assistant, and Kickresume drafting a whole resume from a job title. **Hiring teams are drowning in it**: about 11,000 LinkedIn applications a minute (up 45%), and 65% of hiring managers say skills are harder to verify (Robert Half 2026).
- **Nobody owns truth.** Proofline already enforces it in code (confirmed facts, the claim linter, fingerprinted export gates), but the landing page leads with a generic headline and hides the differentiator in the FAQ.
- **Proofline is behind on everything around the resume**: editing freedom (Teal, Rezi), autofill (Simplify, Huntr), LinkedIn profile (Jobscan, LinkedIn Premium), interview practice (Final Round), skill building (Handshake AI Skills Studio, launched 2026-09-22), distribution (campuses, free extensions, SEO, free tools), and job discovery. Cover letters, interview prep, search, and the agent are **already built but hidden** by `PRIVATE_BETA`.
- **Pricing is a wedge**: competitors cost $29 to $50 a month, often with weekly plans ($13 to $20 a week) and strict refunds, and billing complaints dominate their reviews.

**Strategy:** don't out-volume them. Be the resume you can defend in the interview. Close the gaps around it the Proofline way, where every feature reuses confirmed facts, and add nothing that invents or auto-submits. Phases are ordered so the 2 to 5 person beta keeps working, and each slice ships and commits on its own (per the autonomous-improvement memory).

## Phase 1: quick wins (this week to week 3)

### 1. Say the differentiator (landing and messaging)
- `components/marketing/hero.tsx`: headline "The resume you can defend in the interview." Subhead: every line comes from something you confirmed; nothing is invented; paste any job and get your fit and one tailored page.
- New section `components/marketing/proof-vs.tsx`: a side-by-side of the same bullet written by a generic AI builder (invented "increased engagement 40%") versus Proofline (asks for the number first, cites the fact). Fictional sample data, like `ProductDemo`.
- `components/marketing/faq.tsx`: add "How is this different from Teal, Jobscan, or ChatGPT?" and a pricing promise: free for students, no weekly plans, cancel in one click.
- Copy follows `DESIGN.md`: no em dashes; the fit score is never called hiring odds.

### 2. Edit any line inline, with checks rerun live (Teal and Rezi editing parity)
- In the tailored-resume preview (`components/jobs/tailor-panel.tsx`, `Workspace`), make each bullet clickable to edit. Saving calls a new server action in `app/app/jobs/[id]/tailor-actions.ts` that:
  1. finds the fact cited by that bullet,
  2. calls the existing `editFact(userId, factId, text)` in `lib/facts/base.ts` (it re-confirms the fact in the person's words),
  3. reruns `buildAndReview` (the existing helper in the same file) so the linter and gate update.
- A confirm checkbox ("This is true and in my words") is required, matching `GapSchema`.
- Add tests next to `lib/review/linter.test.ts` for the edited-fact path: an edited number must be the confirmed one.

### 3. Unhide the built parity features for testers
- Remove `hiddenInBeta` from `app/app/jobs/[id]/packet/page.tsx` so cover letters, application answers, and interview prep ship (`lib/packet/*` already exists and is grounded).
- Link to the packet from the job page's next-step coach (`lib/agent/coach.ts` already has packet steps) only after the resume passes the gate, so the core loop stays first.
- Keep agent chat, MCP, career, and search hidden until the Phase 0 metrics below look healthy.

### 4. LinkedIn profile kit (Jobscan and LinkedIn Premium parity)
- New pure module `lib/linkedin/profile-kit.ts`: from `loadFactBase(userId)`, produce a headline (target role plus top confirmed skills, 220 characters or fewer), an About section built only from confirmed facts, and each experience's entry reusing active bullets. Tests in `lib/linkedin/profile-kit.test.ts`.
- UI: a "LinkedIn" tab on `/app/facts` with a copy button per field. Nothing is posted; the person pastes it in.

## Phase 2: close the big functional gaps (weeks 3 to 10)

### 5. Free public "Can you defend every line?" check (Jobscan scanner parity, top of funnel)
- Route `app/check/page.tsx` plus `app/api/check/route.ts`, no sign-in, rate-limited per IP.
- Paste a resume and a job, or upload a file through the existing `lib/resume/parse`. Run `lib/review/linter.ts` checks that need no facts (verbs, numbers, filler, dates, contact info, keyword overlap) and add an "interview-risk" list: every number and claim a recruiter could ask about. Reuse `numbersIn` from `lib/resume/verify.ts` and the buzzword rules in `lib/voice/rules.ts`.
- CTA: "Confirm these facts and Proofline rebuilds it so every line is provable." Store nothing unless the person signs up (see `lib/privacy.ts`).

### 6. Browser extension: capture, review-first autofill, auto-track (Simplify and Huntr parity)
- New `extension/` package (Manifest V3). It replaces the bookmarklet but reuses `readCaptureFragment` and `CapturedJob` from `components/jobs/capture-payload.ts`.
- Autofill only from confirmed facts and saved packet answers (`readAnswers` in `lib/packet/service.ts`), on Greenhouse, Lever, Ashby, and Workday first. Every filled field is highlighted for review. **The extension never clicks submit.**
- "I submitted it" moves the job to Applied in the tracker (`lib/tracker/service.ts`) with the exact resume version.
- Auth: the existing personal access tokens (`lib/agent` tokens, Settings page) scoped to capture, read-facts, and track.

### 7. Spoken mock interviews grounded in your own stories (Final Round parity, the honest way)
- Extend `lib/packet/interview.ts` (`interviewPrep`, `storyParts`) with a practice mode: ask the question aloud, capture the answer with the dictation already in `lib/voice/transcript.ts`, then give rules-based feedback. Did it follow STAR (reuse `storyParts`)? Did it use a confirmed number? Did it claim anything not in the fact base (reuse `canonical` and `numbersIn` from `lib/resume/verify.ts`)?
- There will be no live in-interview copilot, and we say why on the page.

### 8. From gap to earned evidence (answer to Handshake Skills Studio)
- When a gap is marked "Not yet" (`lib/fit/gaps.ts`, the gap-actions flow), offer one small, free project or course matched to the skill: a curated list in `lib/catalog/` keyed by the skill families in `lib/fit/skills.ts`.
- On completion, the person describes what they built. The existing `answerGapQuestionAction` path turns it into a confirmed fact, and the resume rebuilds.

## Phase 3: distribution and moat (months 3 to 6)

9. **Career-center pilot.** A counselor view (consented, read-only) of a student's facts, resumes, and gate results, plus bulk invites. Pitch: authentic applications, which answers NACE's "ghostwritten candidate" concern. Free for schools.
10. **Proof link (category creation).** An optional, consented share link per exported resume that shows which confirmed fact backs each line. It gives recruiters a reason to trust a Proofline resume; no competitor has one.
11. **Job coverage.** Add Adzuna and USAJobs keys (code exists in `lib/jobs/sources/search-apis.ts`), then unhide search. A paid Google-for-Jobs provider needs the owner's decision.
12. **Published outcomes.** Once consented tracker outcomes (`lib/tracker/outcomes.ts`) reach a meaningful sample, publish real numbers instead of vendor-style claims.
13. **Content.** Honest guides that fit the thesis: "Can recruiters tell my resume is AI?", "How to quantify a bullet with no numbers," "Resume with no experience," "Is auto-apply worth it?", and an ATS myths page drawn from `docs/research/RESUME-STANDARDS.md`.

## Phase 0, running alongside: measure before widening

- Use the existing `event_log` funnel (signup, job_ingested, score_viewed, tailor_completed, gate_passed, gate_failed, exported). Add `inline_edit`, `packet_opened`, `linkedin_copied`, `check_run`, and `practice_answered`.
- Truth benchmark: run the same fictional student through Teal, Rezi, ChatGPT, and Proofline, and count unsupported claims and invented numbers per resume. Record it in `docs/research/` for marketing proof.
- Owner action still pending (from memory): set `PROOFLINE_REVIEW_KEY`, or no tester can export.

## What we deliberately won't build

Auto-submit or mass apply, a live interview copilot, weekly billing, creative multi-column templates, and AI-written claims without a confirmed fact.

## Open decisions for the owner (these don't block Phase 1)

- Pricing after the beta. Recommendation: the core stays free for students; Pro at about $8 to $12 a month or about $25 per semester, with no weekly plans.
- A paid job-search provider (SerpApi or JSearch) for item 11.
- Whether to publish the extension (item 6) to the Chrome Web Store (an outward-facing step to confirm first).

## Critical files

- Messaging: `components/marketing/hero.tsx`, `faq.tsx`, new `proof-vs.tsx`
- Inline edit: `components/jobs/tailor-panel.tsx`, `app/app/jobs/[id]/tailor-actions.ts`, `lib/facts/base.ts` (`editFact`), `lib/review/gate.ts`
- Unhide the packet: `app/app/jobs/[id]/packet/page.tsx`, `lib/beta.ts`, `lib/agent/coach.ts`
- LinkedIn kit: new `lib/linkedin/profile-kit.ts`, `app/app/facts/page.tsx`
- Public check: new `app/check/*`, `lib/review/linter.ts`, `lib/resume/verify.ts`, `lib/voice/rules.ts`
- Extension: new `extension/`, `components/jobs/capture-payload.ts`, `lib/packet/service.ts`, `lib/tracker/service.ts`
- Practice: `lib/packet/interview.ts`, `lib/voice/transcript.ts`
- Docs: update `docs/PLAN.md` after each slice; `docs/research/COMPETITORS.md` holds the brief

## Verification (for every slice)

1. `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`
2. Browser check via `preview_start` with `/api/dev/login` and `/api/dev/seed`:
   - Landing: new headline, the comparison section, and the FAQ render at mobile and desktop widths.
   - Inline edit: edit a bullet's number, confirm; the fact changes on `/app/facts`, the resume rebuilds, and the gate reruns. An unconfirmed save is refused.
   - Packet: reachable from the job page after the gate passes; the cover letter downloads.
   - LinkedIn kit: every copied field traces to a confirmed fact.
   - `/check`: works signed out and stores nothing.
3. Commit each slice locally on main with a descriptive message; never push.
