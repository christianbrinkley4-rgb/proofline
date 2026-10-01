# Proofline: what comes after Phase 2

Goal, in Christian's words: Proofline must end up BETTER than the manual job-campaign operation he runs today (the application assembly line: always-on hunting across 5 source types, tailored resume + cover letter, three-AI gate, submission, tracking, follow-ups, outreach). Not a helper. A replacement.

Non-negotiable through every phase: Proofline never writes a fact. Only user-confirmed facts reach a resume. That is the product's edge over every competitor and over sloppy automation. Every feature below must preserve it.

## Where Phase 2 stands (verified 2026-10-01 against the live deploy)

Working: the proof promise holds end to end (draft bullets never persist unless kept), the Ready page gating logic is correct (button disabled until school is confirmed), empty states are intentional and well written, onboarding bullet flow matches spec (2-4 drafts, Keep/Edit/Drop, Skip on number follow-ups, no forced brainstorming), no migration breakage, public pages healthy.

Two real bugs to fix first:
1. /app/applications is a stub ("This page isn't here yet") but the sidebar and the Ready page both promise roles land there. Ship the page or remove the links.
2. "Common in jobs like this" suggested penetration-tester lines for a QA intern. The similar-role matching is miscalibrated. Review it.

Still unverified (need his action, not Claude Code's): a real "Find 3 ready to apply" run against the live review model, and mobile 375px overflow on a real device.

## Phase 3: finish the package (Claude Code)

1. Fix the two bugs above.
2. Cover letter builder. The manual op ships resume + cover letter every time; Proofline ships half a package. Same rules: confirmed facts only, tailored to the posting, human voice, no filler. Gate it through the same review before it counts as ready.
3. Human-voice pass on generated documents. The manual op runs two language passes (human voice, then employer-language mirroring for AI screening). Proofline's resume builder needs the equivalent: mirror the posting's keyword language for real skills, strip anything that reads machine-made.

## Phase 4: a gate as strong as the manual one

4. Multi-reviewer consensus. Today the loop runs one review model. The manual op requires three independent reviewers to agree, with a disqualification protocol for hallucinating reviewers (we have repeated real cases of false FAILs). A single-model gate is the weakest link in the whole product. Build the equivalent inside Proofline: at least two independent review passes with different framings, and a rule that a reviewer flagging claims that are verifiably in the confirmed-facts store is disqualified for that run, not looped against.
5. Formatting audit in the gate. The manual gate checks one-page, no empty bullets, consistent bolding, no em dashes, date consistency. Cheap to automate, embarrassing to miss.

## Phase 5: the automation that beats manual

6. Gated auto-submit. This is the feature that makes Proofline better than the manual op instead of just equal to it: exact passing PDFs submitted while the user sleeps. Only unlocks behind the Phase 4 gate. Never submits a package that did not pass.
7. Follow-up engine. +14 days after submission, draft and queue the follow-up, tracked in Applications.
8. Source expansion, in this order: Lever and Ashby open-checks (explicitly missing, same pattern as the Greenhouse check), then the aggregator and portal-direct hunting the manual sweeps do. Greenhouse-only is a beta constraint, not the vision.

## Phase 6: distribution

9. Recruiter outreach module (gated drafts, user sends or auto-sends with standing permission).
10. Interview prep mode once applications are out.

## Sequencing discipline

Do not build Phase 5 before Phase 4. Auto-submit behind a single-model gate is how you mass-send bad applications. The order is: prove the loop on his own account (his action) -> fix QA bugs -> cover letter -> stronger gate -> 10 real beta users (UNCG seniors, his stated milestone) -> auto-submit -> sources.

Cost note: the 3-run / 9-per-day caps stay through beta. Revisit only when submission is automated and the unit economics are measured.
