# Competitive moat verification, October 2, 2026

## Production release

Items 0-3 are live at https://proofline-beta.vercel.app. READY deployment `dpl_26T79osdEcDpQok86Bf2LmSLciDy` runs source commit `78d0d4520909fdb2b7a3446d6b3dd20fd29374e9`, pushed to GitHub main. The release was built with Production settings, checked READY, and then promoted. [Cloud build and deployment log](evidence/moat-2026-10-02/release-production-deploy.log), [build exit receipt](evidence/moat-2026-10-02/release-build-result.json), [promotion receipt](evidence/moat-2026-10-02/release-promotion.log), [live target metadata](evidence/moat-2026-10-02/release-production-config.json).

The owner explicitly approved transferring the existing scoped URI to sensitive server-only Vercel Production `MONGODB_URI`, setting `MONGODB_DB=proofline`, and adding Atlas `0.0.0.0/0` for Vercel's dynamic outbound IPs. The rule is Active; credentials and TLS remain required. No paid service was added. [Applied network rule](evidence/moat-2026-10-02/release-atlas-network-applied.png). `.vercelignore` excludes local data, credentials, caches, and verification artifacts from deployment uploads. Credentials were checked absent from tracked text before pushing.

| Live check | Evidence |
| --- | --- |
| Production Atlas usable by Vercel | Signed-in `/app/calibration` completed the actual Atlas reads and index initialization, and rendered the five empty production buckets. This is separate from the synthetic test account's 48%/1-of-1 local result. [Screenshot](evidence/moat-2026-10-02/release-calibration.png), [rendered text](evidence/moat-2026-10-02/release-calibration-dom.txt). |
| Tracker loads | Signed-in Applications renders its empty state and the calibration link. [Rendered text](evidence/moat-2026-10-02/release-tracker.txt). |
| Existing real AI provider answers | Owner Check AI now returned resume review passed and fact wording answered through `gemini-3.5-flash-lite`, 0.7 seconds. This health check sends made-up data and is not a three-reviewer quality evaluation. [Result](evidence/moat-2026-10-02/release-ai-health.txt), [screenshot](evidence/moat-2026-10-02/release-ai-health.png). |
| Public routes and authentication | Home, signup, login, privacy, check: 200. Signed-out calibration: 307 to login. Temporary public `/sentry-check`: 404. [HTTP receipt](evidence/moat-2026-10-02/release-smoke.json). |
| Positioning and Sentry client config survive release | The home response contains 10 perfect applications and 300 autopilot submissions. Of 14 script assets checked, `/_next/static/immutable/chunks/1erxqlyeptq_n.js` contains the full public DSN. [Receipt](evidence/moat-2026-10-02/release-smoke.json). Original dashboard receipt remains documented under item 0. |
| Runtime error scan | New deployment, error-level logs, 15-minute window: no logs found. [Scan](evidence/moat-2026-10-02/release-error-scan.log). This is a bounded scan, not a long-term stability claim. |

The full local acceptance loop and its controlled reviewer/send tests below remain the evidence for outcome math, day-14 timing, contact verification, gate edits and touch persistence. No real outreach/follow-up email was sent during release verification; real delivery is not claimed.

## Item 0: production fix deployed, dashboard receipt confirmed

- Production deployment: `dpl_CGFjTF6wMRux7eYZc4WuH3y7nF4p`, READY, https://proofline-beta.vercel.app.
- Browser initialization already used `NEXT_PUBLIC_SENTRY_DSN`; removed the `next.config.ts` override that replaced it with the server variable.
- Verified the full Client Key DSN in the signed-in Sentry Proofline project (project ID `4512183107190784`). Set Vercel Production `NEXT_PUBLIC_SENTRY_DSN` directly, and aligned `SENTRY_DSN` with that full URL. Doppler CLI is unavailable. No unrelated secrets retrieved.
- Public bundle check: `/sentry-check` returned 200; inspected 13 JavaScript assets; the full DSN appears in `/_next/static/immutable/chunks/3vx3bvwwrvgjj.js`.
- Browser test clicked on production: `Proofline safe browser verification`, event ID `e315d0e1935a415097f9ab91614803f2`; SDK transport finished. This is not dashboard receipt.
- Dashboard receipt confirmed after the owner restored browser control: issue `PROOFLINE-1`, environment `production`, tag `operation=monitoring.browser-check`, `synthetic=true`, and the production page URL. [Exact event receipt](https://christian-brinkley.sentry.io/issues/7768334297/events/e315d0e1935a415097f9ab91614803f2/?project=4512183107190784).
- There are no Sentry tunnel references in the source configuration. Direct ingestion is used; `/monitoring` is unused.
- The temporary public `/sentry-check` page was removed after receipt and is now 404 in the release above. The durable test control is available only on the existing owner page.
- Full tests: 111 files, 1,481 tests passed. Typecheck, lint, local production build and Vercel production build passed.

## Item 1: Atlas prediction and outcome loop verified locally

Every completed passing resume, letter, outreach, and follow-up gate writes an integer probability, application ID, gate fingerprint, version, timestamp, and one-line for/against reason to Atlas. A failed Atlas acknowledgement prevents a gate from being stored as complete. The initial estimator is explicitly labeled an uncalibrated fit prior, version `interview-fit-prior.v1`; these numbers are not trained interview probabilities.

| Acceptance | Evidence |
| --- | --- |
| Probability automatically stored at PASS | Real Atlas application `0497194b-157f-41a5-8a2d-0e09eb5e146a`: resume prediction `83475a22-0f07-4933-a98e-200903363a00`, outreach `e3d2bf07-ddd5-47f4-b2bf-6c2b8e4a12ab`, follow-up `372d766b-c354-4d94-be8d-866ce52ef505`, all 48%. Reason: `For: Bookkeeping, which they ask for; against: 2+ years of experience requested.` [Atlas records](evidence/moat-2026-10-02/atlas-loop.json). |
| One-tap tracker outcomes | The fresh account clicked Interview once. Atlas stores outcome `interview`, probability 48, submittedAt `2026-10-02T16:26:23.036Z`, and the pre-submission outreach prediction ID. A later outreach PASS does not replace that frozen prediction. The board also exposes Rejection, No response, and Withdrawn. [Calibration DOM](evidence/moat-2026-10-02/calibration-dom.txt). |
| Correct calibration counts and math | Browser displays all five buckets. Only 41-60% contains a submitted application: applications 1, recorded outcomes 1, pending 0, withdrawn 0, predicted 48%, actual 100% (1/1). The second gated application remains Saved and does not enter the submitted cohort. [Screenshot](evidence/moat-2026-10-02/calibration.png). |
| Bucketing tested | `lib/interviews/model.test.ts`: all ten boundaries, all 101 valid integers exactly once, invalid and fractional inputs, same resolved cohort for both rates, pending/withdrawn exclusions, explicit no-response denominator, duplicate application handling, and pre-submission freezing. Persistence tests cover ownership and failed writes. Included in the green full suite below. |
| Atlas, no paid service | Owner-authorized free Proofline cluster; separate `proofline` and `proofline_moat_verification_20261002` databases with scoped readWrite roles. Local URI stays in ignored `.env.local`. [Connection write/read receipt](evidence/moat-2026-10-02/atlas-connection.json). |

Implementation: `lib/interviews/{model,mongo,service}.ts`, `/app/calibration`, tracker outcome controls, account export/deletion integration, and gate persistence hooks. Mongo indexes initialize automatically; this slice adds no SQL migration. Pending and withdrawn applications are excluded from both compared rates; no response counts only when explicitly recorded.

## Item 2: verified contact, review/send, and day-14 follow-up verified locally

Live source evidence supplies contacts. A contact requires an explicit named hiring/posting contact and a public email together in source evidence; a pasted name, generic inbox, company founder mention, or a model suggestion is insufficient. The implementation conservatively leaves the lane empty when it cannot verify a sendable contact.

| Acceptance | Evidence |
| --- | --- |
| Real contact, no invented identity | [Official posting](https://careers.h-fts.com/job/68213/accounts-assistant-semi-senior-accountant/heywood) explicitly names David Hawthorne-Finch and the public email. Atlas retains the exact source quote, URL, and read time. Role is labeled Posting contact. [Source and gate screenshot](evidence/moat-2026-10-02/outreach-gate.png). |
| Short personal draft, confirmed fit detail, same three-reviewer gate | Draft includes the person's entered reason about client work and the exact confirmed QuickBooks fact. Facts, reader, and complete reviewers each PASS before Review outreach becomes available. [Review panel](evidence/moat-2026-10-02/outreach-review.png), [Atlas gate and message](evidence/moat-2026-10-02/atlas-loop.json). |
| User reviews and sends from app | Browser opened the read-only draft and then clicked Send. The local provider stand-in returned `synthetic-local-22633cce-b86f-4f15-bc93-07fd1458c7cd`; the stored touch preserves the exact reviewed recipient/body, date, and receipt. This is simulated provider acceptance, not delivery to the real contact. [Timeline](evidence/moat-2026-10-02/outreach-timeline.png), [provider capture](evidence/moat-2026-10-02/synthetic-email-receipts.jsonl). |
| Follow-up pre-gated at submission, due at day 14 | Marking Applied prepared and gated the follow-up. Day-zero review/send stayed disabled. Advancing only the isolated server clock by 14 days surfaced Follow-up due. One board tap on Review follow-up opened the exact reviewed draft; one Send tap recorded it. [Day zero](evidence/moat-2026-10-02/follow-up-prepared-day0.png), [day 14](evidence/moat-2026-10-02/follow-up-due-day14.png), [one-tap review](evidence/moat-2026-10-02/follow-up-one-tap-review.png). |
| All touches logged | Atlas and the tracker contain outreach at `2026-10-02T16:30:55.364Z` and follow-up at simulated `2026-10-16T16:37:35.348Z`. Follow-up receipt: `synthetic-local-91cd5478-f5ac-4cc8-abec-625e0c44c2d1`. Repeated sends disabled; reminder cleared. [Two-touch timeline](evidence/moat-2026-10-02/conversation-timeline.png). |
| Posting without recruiter stays empty | [Extenteam posting](https://job-boards.greenhouse.io/extenteam/jobs/5436695008) names no recruiter. Application `3318c521-5d23-493c-8296-9f17efc3a2d2` passes its resume gate and stores 33%, prediction `c2f1b111-47f8-43fe-a9f3-882623ae5c5f`. Browser displays `No verified contact found`; Atlas contact/draft/follow-up/gates are null, touches empty. [Screenshot](evidence/moat-2026-10-02/no-contact.png), [DOM](evidence/moat-2026-10-02/no-contact-dom.txt), [Atlas record](evidence/moat-2026-10-02/atlas-loop.json). |

Implementation: `lib/outreach/{contact,model,service,email}.ts` and `components/tracker/relationship-lane.tsx`. Tests cover no name/email, generic/privacy/placeholder contacts, unconfirmed facts, changed recipient/source/facts/reason, tenant isolation, forged or two-reviewer receipts, concurrent sends, repeated sends, rejected/ambiguous provider responses, and early/day-14 timing. Ambiguous sends remain locked for reconciliation rather than risking duplicate email. Production uses the existing Resend service; the local harness intercepts its request before any outbound email.

## Item 3: transparent gate receipts and positioning verified locally

| Acceptance | Evidence |
| --- | --- |
| Reviewer names, scopes, verdicts, clean PASS | Application receipts show Fact check (confirmed truth), Recruiter/Hiring manager read (voice and employer language), Full read (clarity and formatting), and each verdict. PASS requires exactly three distinct completed standing reviewer reads plus blocking checks. [Resume receipt](evidence/moat-2026-10-02/resume-gate-pass.png), [no-contact application DOM](evidence/moat-2026-10-02/no-contact-dom.txt). |
| FAIL exact quote and actual changes | A controlled synthetic reviewer FAIL quotes `I want this role because it is the best job in the world.` and explains the filler rule; sending is blocked. Correcting the person's reason shows the actual before/after text and a fresh three-reviewer PASS. Suggested fixes and observed edits have separate labels. [Quoted failure](evidence/moat-2026-10-02/gate-fail-quote.png), [observed change](evidence/moat-2026-10-02/gate-observed-change.png). |
| Interviews positioning in landing and onboarding | `components/marketing/hero.tsx` and `components/onboarding/beta-flow.tsx` contain `10 perfect applications` versus `300 autopilot submissions`, the interview goal, fact confirmation, and user control of sending. No competitor names or em dashes in this new copy. |
| Existing document rules retained | Deterministic gates still enforce confirmed facts, no em dashes, finished formatting, human voice, and employer relevance. Outreach uses an exact confirmed fact and the user's own reason. Consensus, letter-gate, receipt, outreach-model and service tests are included in the full green suite. [Reviewer inputs/outputs from browser loop](evidence/moat-2026-10-02/synthetic-review-calls.jsonl). |

Implementation: `lib/review/receipt.ts`, `components/review/gate-receipt.tsx`, application receipts, review framings/consensus, and resume/letter document snapshots. An unsupported reviewer issue can be set aside only when a replacement yields three standing completed reads; a failed/incomplete or legacy two-reader receipt cannot authorize sending.

## Verification bar and release status

| Check | Result and evidence |
| --- | --- |
| Full suite | 117 files, 1,553 tests PASS, exit 0. [Log](evidence/moat-2026-10-02/full-tests-final.log). |
| Typecheck | PASS, exit 0. [Log](evidence/moat-2026-10-02/typecheck-final.log). |
| Lint | PASS, exit 0. [Log](evidence/moat-2026-10-02/lint-final.log). |
| Final local production build | PASS, exit 0, completed `2026-10-03T00:21:49.7147133Z`, after the final empty-state UI change. [Log](evidence/moat-2026-10-02/build-final.log), [exit receipt](evidence/moat-2026-10-02/build-result.json). |
| Fresh-signup whole loop | Synthetic fresh account: signup, onboarding/confirmed bookkeeping facts, Find jobs, paste real posting, tailor, three-reader gate with Atlas probability, verified outreach draft, mark Applied, prepare follow-up, record Interview, calibration update. [Onboarding](evidence/moat-2026-10-02/onboarding.png), [Find](evidence/moat-2026-10-02/find.png), gate/draft/outcome screenshots and Atlas records linked above. The isolated Find feed was empty; its paste-a-job path was used. |

Test/typecheck/lint exit receipts: [check-results.json](evidence/moat-2026-10-02/check-results.json). Browser loop uses the optimized local build, PGlite for the ordinary app tables, real Atlas for predictions/outcomes/lanes, explicitly synthetic reviewers, and an intercepted synthetic email provider. It verifies flow, gates, persistence and receipts; it does not establish real Gemini judgment quality or real email delivery. The Interview outcome is a test record, not a real interview success claim. Day 14 is a process-only test clock, not a changed OS clock or backdated application.

The evening continuation restored the already-authorized current-computer IP after a network change. OneDrive read-only attributes prevented the local acceptance database reopening; its stale lock was preserved and folder attributes corrected without ACL changes or database reset. [Recovery diagnostic](evidence/moat-2026-10-02/local-db-reopen-restored.log), [Atlas network evidence](evidence/moat-2026-10-02/atlas-current-ip-restored.png). The main application's original records and receipts remain intact.

Items 0-3 were subsequently released with the explicitly approved production Atlas configuration and network rule, as recorded at the top. The existing real AI provider answered its synthetic health sample; the email provider's configuration is present, but real delivery was not exercised. No paid service was added. No B2B, pricing, marketing integration, or mobile work was included.

Reproduce the local acceptance server with ignored local Atlas configuration: `node scripts/start-moat-verification.mjs`; capture Atlas evidence with `node scripts/capture-moat-atlas.mjs`. For the timing check only, set `MOAT_VERIFICATION_ADVANCE_DAYS=14` before starting the harness. The synthetic provider preload refuses to run outside the named verification database and synthetic email key. It is never imported by the application.
