# Proofline beta readiness, September 29, 2026

## Decision

The deployed application workflow has substantial automated and local browser verification. It is not signed off as a complete career exploration product or as ready for wider promotion. Open signup is already enabled; that is an access setting, not readiness evidence. No percentage of readiness or guarantee of zero defects is justified.

The standard is a person being able to understand their experience, compare plausible directions, choose a next experiment, act, and return with what they learned. A polished resume is one output of that journey.

## Evidence available

| Area | Observed evidence | Limit |
| --- | --- | --- |
| Latest code | Commit 1162262; 768 passing tests in 84 files; typecheck, lint, local build and Vercel production build passed | Automated coverage cannot establish every wording or user journey |
| Deployment | Ready deployment dpl_C5H3UjsEhou6aB4XZAHnkSQFaJtU at https://proofline-beta.vercel.app | Public route checks do not prove authenticated model requests |
| Recall bank | 6,020 distinct usable cues; full-bank duplicate audit and 24 careers across four experience kinds; existing 121-line selection regression | Synthetic checks do not establish relevance or satisfaction for every role |
| Sentence review | Synthetic local browser flow verified metric choices, changed-wording confirmation, exact saved text, next card and 375px layout | Provider response was a local test double; real Gemini quality remains unverified |
| Resume details | Automated and synthetic checks preserve multiple degrees, coursework, honors and contact details, including exports and evidence revocation | The owner's original resume versus corrected live output comparison remains unfinished |
| Career planning | Goals, one-posting benchmarks, check-ins and evidence counts exist | Career page and agent chat are hidden; exploratory actions are four general steps |

## Gates before wider beta promotion

These are ordered by impact. An unverified gate is not a claim that the underlying feature is broken.

1. **Verify the real provider and full signed-in workflow.** On a consenting existing account, review a fact card with the configured Gemini service, confirm the exact sentence, reload it, tailor a resume for a real posting, pass the review gate, and inspect both downloaded formats. Include retry/provider failure behavior and a correction after editing answers. Pass when the provider succeeds, numbers and meaning survive, confirmation is required, persistence is correct, and exports match the reviewed document. Do not enter credentials or create production accounts for an automated test.
2. **Close the owner's real resume regression.** Correct the existing imported facts and posting metadata, rebuild, and compare the original PDF against the current preview/PDF/DOCX. Account for each education entry, date, honor, coursework item, contact field and relevant work example. Pass when every intentional difference is explainable and no confirmed detail is lost or unsupported detail added.
3. **Provide dependable account recovery.** Production configuration lists neither RESEND_API_KEY nor EMAIL_FROM; lib/email.ts therefore uses the manual owner-inbox fallback. Configure an authorized sender and verify a delivered reset, invalid/expired link, and non-disclosing response for unknown email. Manual delivery needs a documented owner process until self-service is verified.
4. **Exercise the capacity of the growing bank.** Fact wording review and resume review share model credits. Test repeated cards, cached reviews, rate limits, provider latency, and recovery for a person building hundreds of lines; measure actual cost and latency before increasing budgets. Pass when users retain their answers, understand limits, and can resume without duplicate facts or charges caused by approval retries. Existing credit settings alone do not demonstrate capacity.
5. **Run observed user sessions.** Start with at least five consenting testers spanning a student with little paid experience, an undecided user, an experienced worker, a career changer, and a mobile user. Watch signup/import, recall, clarification, selection, review, exports, and returning later. Record assistance needed, misleading cards, rewritten claims, failed tasks and recovery. Fix critical failures and repeat the affected journey. This is an initial usability gate, not proof of hiring outcomes.
6. **Record operational readiness evidence.** Verify the recovery/restore process, useful failure monitoring, support ownership and the existing account-data controls in the deployed environment. Define how a failed provider or deployment is handled. These checks were not completed in this audit; absence of evidence is not proof they are absent.

## Work needed for the career product standard

The current beta journey in lib/agent/coach.ts is Your resume, Paste a job, Tailored resume, Close gaps. PRIVATE_BETA hides career planning and agent chat. Removing that switch would expose unfinished product breadth without supplying the missing guidance.

Build and verify the following connected journey:

1. **Understand the person.** Capture strengths supported by examples, interests, tasks they enjoy or avoid, practical constraints, and priorities. Include projects, caregiving and volunteering. Separate preferences from resume claims. Permit uncertainty and revision without forcing someone to choose a job title first.
2. **Compare plausible directions.** Offer a small set of explainable role options with supporting experience, unknowns, likely gaps and practical tradeoffs. Show the sources and dates for labor-market claims. Distinguish missing evidence from a skill the person lacks; explain why a direction appears and let the person reject it.
3. **Choose a small next experiment.** Turn a selected direction into concrete actions with effort, cost, intended learning and completion criteria. Use more than one real benchmark posting when generalizing about a career. An informational conversation or short project may be the next step before an application.
4. **Adapt to what happened.** A check-in should change the next recommendation when a person dislikes the work, encounters a constraint, gains evidence, or changes priorities. The current career service records reflections and completed steps, but its action selection does not interpret reflection content. Preserve the reason for a change and avoid repetitive generic advice.
5. **Connect direction to applications.** Use the growing confirmed bank to tailor a focused resume, prepare interview examples and track applications. Keep every claim attributable and editable. Record self-reported outcomes with consent; do not imply one document caused an interview or rejection.

Acceptance scenarios: an undecided person can compare directions and choose a practical experiment; a career changer sees transferable examples and a realistic gap plan; a returning user receives a different next step after a meaningful check-in; an experienced user can maintain a large bank and select a small relevant application; none require fabricated metrics or hiring-probability claims.

## Wording and recommendation quality

- Review every new recall save through the shared sentence path; a full-bank local audit does not certify every real model response. Use human-reviewed examples across varied roles and messy answers to assess specificity, fluency, truthful ownership and preserved quantities.
- O*NET core task relevance of at least 67% describes occupational survey data. It is not a calibrated claim that an individual was at least 50% likely to perform the task. Keep that distinction visible in product wording and evaluation.
- A polished sentence must not upgrade assistance to leadership, change direction or magnitude, add an outcome, or manufacture a number. Users must be able to clarify or skip when they do not know a measure.
- Success measures should include completion without help, useful confirmed examples, understandable career choices, practical actions completed, and return usefulness. A large bank, test count or polished screen alone is insufficient.

## Follow-up: provider failure identified

Live recall logs from September 29 show HTTP 402. The real provider gate is now a known billing/prepaid-credit blocker rather than only an unverified call. The account's actual plan and balance have not been inspected. An explicit basic wording check and answer-preserving retries have been verified locally with a synthetic 402 response; they do not establish restored AI review. Current tests: 758 across 83 files. The resume export model gate remains unchanged.

## Next order of work

First close the real provider and owner-document checks, then recovery and capacity. Continue observed sessions as the direction-comparison journey is built. Keep this checklist open until each gate has recorded evidence; update it after each finished slice. Current assessment: tested application beta with explicit verification gaps, and substantial career-guidance work remaining.

## Follow-up: varied-career discovery verification

Add some facts now offers different sourced tasks rather than saved-line follow-ups. Synthetic browser checks cover skip, exact reviewed save, next card, pause/resume, project matching and phone layout. Shared tests span trades, healthcare, service, education, office work and technology. Employment arrangement labels are ignored for occupation matching. Unsupported or exhausted coverage asks for detail. This is broader regression evidence, not a claim that every career, language or semantic paraphrase is covered. All earlier real-provider, original-document and career-guidance gates remain open.
