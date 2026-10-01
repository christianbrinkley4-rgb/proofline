# Proofline Agent Upgrade Spec: From App to Woody-Level Agent

> **Status (October 1, 2026).** The owner chose to start Phase 2 before the Phase 1 gate (10 beta users, 3 applications each) was met. What exists now is listed under "Phase 2 progress" at the end. Phases 3 and 4 are untouched.

Written 2026-10-01. This is the engineering plan for closing the gap between what Proofline is today (a helpful app you drive) and what woody's application assembly line does for Christian today (an autonomous agent that produces submitted, gated applications while he sleeps).

## The thesis

The incumbents (Simplify, Teal, Huntr) build better shovels: trackers, autofill, resume builders, nicer templates. Proofline cannot win by out-shoveling funded teams, and should not try.

The winning wedge is the autonomous agent that does the entire job, not a step of it: finds roles, verifies they are live, checks fit, tailors materials, gates quality through multiple reviewers, submits, tracks, and follows up, while the user sleeps. Nobody else is selling that. The honest core (nothing unconfirmed ever reaches a resume) is the differentiator that makes the autonomy trustworthy.

Christian has been living inside the reference implementation for weeks. The fastest path is not inventing the architecture. It is documenting what woody does and rebuilding it as a product.

## The gap: 8 things woody does that Proofline does not

1. **Persistent memory.** Woody carries facts, preferences, standing rules, people, and commitments across every session. Proofline starts cold each time. Fix: a profile layer that deepens with use. The product remembers you, so you never re-explain yourself.

2. **Single source of truth.** One master resume and one canonical fact base. Every package derives from them, never the reverse, and global fixes propagate from master outward. Fix: a confirmed-fact store; all outputs render from it. No independent drifting documents.

3. **Adversarial multi-reviewer gating.** Three reviewers (woody, Gemini, Interview Engine) check every package in parallel against the live posting, the verbatim resume text, and the quality benchmark, and a hallucinating reviewer is disqualified with receipts instead of triggering rewrite loops. Single-pass generation is what makes AI output mediocre. Fix: a gate protocol with parallel reviewers, a fixed quality bar, and reviewer disqualification rules.

4. **The full loop, not steps.** Locate, verify live, fit-check, tailor, gate, submit, track, follow up. Tools do steps; woody does the loop. The loop is the product. Fix: one continuous pipeline per role, with the tracker updated at every stage, never batched.

5. **Autonomous operation.** Hunters run on schedule, follow-ups draft themselves when windows arrive, deadlines get watched without being asked. Proofline today is a UI you must drive. Fix: scheduled background work per user (role hunts, deadline watches, follow-up drafting), with the user approving sends, not initiating work.

6. **Accumulated rules (taste).** Woody's operating manual holds hundreds of standing rules learned from real mistakes (title checklists, verification discipline, voice rules). No prompt engineer writes this on day one. Fix: a rules engine with global rules plus per-user learned rules that accumulate from corrections. Every user correction should become a permanent rule.

7. **Verification machinery.** Fresh extraction before every gate, verbatim prompt generation from files (never retyped), substitution assertions, paragraph-count guards. Unsexy, and it is half the quality. Fix: build the verification steps into the pipeline as code, not as instructions the model might skip.

8. **Acting in the world.** Browser, email, sheets tracker, calendar. Woody submits applications and sends outreach; Proofline generates documents. Fix: integrations (email, calendar, job boards) so the agent can complete the loop. Without this it stays a document generator with a nice UI.

## Target architecture

- **Profile and memory layer.** Structured, persistent, user-editable. Grows with use.
- **Fact base.** Canonical, confirmed-only. The recommended-bullet flow (keep/edit/drop) is the intake valve. Nothing unconfirmed renders to an export.
- **Discovery engine.** Scheduled hunts across sources (job boards, company portals, aggregators), deduplicated against the user's tracker, with live-verification before anything is shown as actionable.
- **Fit scoring.** Honest eligibility check first (knockouts), then fit ranking. Rejections logged with reasons.
- **Tailoring engine.** Renders resume and cover letter from the fact base against the posting's own vocabulary (ATS keywords captured verbatim at locate).
- **Gate protocol.** Parallel reviewers, fixed benchmark, unanimous pass required, reviewer disqualification on hallucination. Verbatim document text in every review; never review from summaries.
- **Submission and tracking.** Tracker updated at every stage. Confirmation captured. Follow-up dates computed automatically.
- **Follow-up engine.** Drafts when the window arrives, user approves, sends logged.
- **Rules engine.** Global rules plus per-user learned rules. Corrections become rules.
- **Integrations.** Email, calendar, and job-board connectivity so the loop can complete without the user as the API.

## Phased plan, with gates between phases

**Phase 0 (now): simplification completes.** Claude Code finishes the simplification pass. Gate: measured step and click count from signup to downloaded resume, before vs after. Do not proceed until the core path is simple.

**Phase 1: 10 beta users. No new features.** Christian recruits UNCG seniors, watches sessions, logs every friction point. The work is distribution and observation, not code. Gate: 10 users, at least 3 applications each through the product, and a retention signal (they come back week two).

**Phase 2: agent v1.** Memory layer, fact base, and one continuous loop (find, tailor, gate, track) against one job source. Gate: users report interviews attributable to the product.

**Phase 3: multi-reviewer gate plus autonomy.** Adversarial review and scheduled background work (hunts, deadline watches, follow-up drafts). Gate: measurable interview-rate lift versus users' previous manual baseline.

**Phase 4: integrations and scale.** Email, calendar, broader sources. Only after Phase 3 gates pass.

## What not to build

- Do not out-feature incumbents on trackers, autofill, or templates. That is their game.
- Do not build the agent layer before 10 beta users exist. Distribution and feedback first, always.
- Do not automate submission without the honesty core intact. The product stops and asks when a form needs a fact it does not have. This is the trust the whole thing stands on.
- Do not let outputs drift from the fact base. One source of truth, or the product becomes a hallucination machine with a nice UI.

## The moat

The moat is not the code. It is three things: the accumulated rules (taste that compounds), the verified playbook (the assembly line, proven on a real campaign), and the story ("I built the machine that got me interviews" — told by a 21-year-old who actually did it). Every user interaction should feed the rules engine. The product should get smarter the more it is used, per user and globally.

## Mapping: woody's systems to Proofline components

- `~/AGENTS.md` (operating manual, standing rules) becomes the seed of the global rules engine.
- The application-assembly-line skill (locate, build, gate, submit, track) becomes the loop specification.
- The review gate protocol (three reviewers, verbatim text, benchmark, disqualification) becomes the gate protocol.
- The master resume workflow (one master, propagate fixes outward) becomes the fact-base architecture.
- The language double-gate and formatting audit checklist become gate checks.
- The follow-up rule (window = submit + 14 days, drafts when due) becomes the follow-up engine.

## Phase 2 progress (October 1, 2026)

Built on what already existed: the confirmed-fact base, the review gate, the Find jobs feed, the tracker, and profile dealbreakers.

- **One continuous loop, one source** (`lib/agent/loop.ts`, page `/app/ready`). For up to three of the best-fitting open Greenhouse roles per press: confirm the posting is live against the employer's own API (`lib/jobs/feed/verify-live.ts`; a 404 closes it for everyone, anything unclear is "unconfirmed" and never treated as open), check dealbreakers and knockouts against the full description, save to Applications, build the resume from confirmed facts, run the review gate, and link the passing resume to the application. Each stage is written to `agent_run.steps` (migration 0019), so the person reads why a role is ready or where it stopped. Nothing is submitted and no fact is written.
- **Per-run and daily caps.** 3 roles per press, 9 per person per day (each review is a model call on prepaid credit). Three unreachable boards in a row stops the run.
- **Memory.** Standing rules are the profile's `dealBreakers`, now writable from a correction: "Not for me" on a result offers just this job, never this employer, or skip a title word. Find jobs, search, and every later run honor the rule; `/app/ready` lists the rules with a remove button (`lib/agent/rules.ts`). Run history persists in `agent_run`.
- **Added after Phase 2 (see `docs/PLAN.md`, roadmap Phases 3 and 4):** the cover letter is drafted and reviewed with the resume, two independent reviewers with a disqualification protocol replace the single review model, and Lever, Ashby, and SmartRecruiters postings can be confirmed open (Ashby has no single-posting endpoint, so its board list is read).
- **Not built yet from the spec:** scheduled runs, follow-up drafting, a global rules engine seeded from woody's operating manual, auto-submit (a decision for the owner, see `docs/ROADMAP-PHASE-3-PLUS.md`).
- **Not verified:** a run that ends in "ready" against the real review model. Locally no review key is set, so a run stops at the gate; the ready path is covered by tests with an injected gate. The first production run should be watched.

