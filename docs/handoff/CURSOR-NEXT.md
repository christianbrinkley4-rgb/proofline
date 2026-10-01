# Handoff to Cursor (September 28, 2026)

## October 1 agent loop (committed locally, not deployed)

The owner supplied `docs/AGENT-UPGRADE.md` (the plan for turning Proofline into an autonomous application agent) and chose to start Phase 2 before its Phase 1 gate. `/app/ready` now runs one continuous loop over open Greenhouse roles: live check, dealbreakers and knockouts, tracker, resume from confirmed facts, review gate, with every stage recorded. Corrections become standing rules (profile dealbreakers). It never submits anything. See `docs/AGENT-UPGRADE.md` "Phase 2 progress" and `docs/PLAN.md` for what is verified and what is not (no run has reached "Ready" against the real review model yet). To release: `npx vercel@60.1.3 --prod --yes`, confirm migration 0019, press "Find 3 ready to apply" on the owner's account.

## September 30 simplification pass

Onboarding is three screens, roles get recommended resume lines (Keep, Edit, Drop), and the interface drops internal words. Signup to a downloaded resume went from 10 screens and 13 clicks (with an empty role) to 6 screens and 9 clicks (with two real lines). Details, the jargon table, and what was flagged: `docs/SIMPLIFY-AUDIT.md`. Commit `43766ef` is live as Ready production deployment `dpl_Cc53UAjWXJttyPAG5pTYAWtBY9wT` (no new migration). Live checks: home, /check, /privacy, /login, and /signup 200 with the new copy; signed-out My experience 307 to login; development login 404; no errors in the logs. The first deploy attempt returned "Not authorized" during upload and the retry with the same CLI (60.1.3) succeeded. Signed-in flows were checked on localhost with synthetic data and a stand-in for the review model, not on production. Testers should reload open tabs.

## September 30 owner's report (live)

The extension's "Couldn't reach Proofline", duplicate schools after a resume import, and the confusing Add some facts card (now Find more resume lines) are fixed and deployed (latest `dpl_8VajmD1FED1kDRjcWv8ebBt3n3ww`), along with posting-reading and resume-checker bugs found by walking a new account through import, fit, tailoring, and the answer kit, and Find jobs ranking, the LinkedIn kit, and the free check found on the owner's live account. Details and the posting-reading fixes found on the way are in `docs/PLAN.md` under "owner's report". Testers don't need a new extension zip; Try again on the badge (or reloading the job page) works. Duplicate schools already saved in an account stay until deleted on My facts.

## September 30 go-live setup

- **AI review works in production.** The owner prepaid Gemini credit. `/api/cron/ai-health` (daily 09:00 UTC, or `MSYS_NO_PATHCONV=1 npx vercel@60.1.3 crons run /api/cron/ai-health`) sent made-up data through both calls on deployment `ea0b852`: resume review passed the sample, fact wording answered, 1.2s. A failure is logged as `ai.health` and left as an alert on the owner page. Prepaid credit runs out; switching Google billing to Postpay or turning on auto-reload keeps downloads from stopping.
- **Find jobs is filled.** `vercel crons run /api/cron/refresh-feed` read all 96 boards (none failed), 18,812 postings, 1,516 listed.
- **Owner page** `/app/owner`, linked from Settings for accounts in `OWNER_EMAILS` (set to the owner's sign-in email): password-reset links waiting to be sent (copy or "Email it"), feedback, contact messages, alerts, "Check AI now", and "Send me a test email".
- **Password-reset email:** christianbrinkleync.com is verified in Resend and `EMAIL_FROM` is `Proofline <noreply@christianbrinkleync.com>`. `RESEND_API_KEY` was not yet on the proofline-beta project when this was written; the owner adds it, then redeploy and press "Send me a test email". Until then, reset links collect on the owner page. Agents must not create or enter the key.

## September 30 accessibility pass

WCAG 2.1 AA audit and fixes; see the accessibility section in `docs/PLAN.md`. Run `node scripts/a11y-audit.mjs` against the dev server before a release. The extension is now 0.3.1 (same features, readable gray text); testers replace the unzipped folder and press Reload again.

## September 30 release

Commit `1a1bc22` is live at https://proofline-beta.vercel.app as Ready production deployment `dpl_5HAXjPUUUKptZurA1pzmfXctQH3V`. It ships everything since the last release: Find jobs (spec 03), the answer kit and sent record (spec 04 v1), extension 0.3.0 with Greenhouse and Lever fill (spec 04 v2, zip at `/proofline-extension.zip`), and the resume fixes from the owner's line-by-line comparison. Live checks: home and /check 200, signed-out My facts and Find jobs 307 to login, development login 404, the feed cron 401 without its secret, and the first database request ran migrations 0017 and 0018 with no errors in the logs. The Find jobs pool stays empty until the first 10:00 UTC cron run, or until the owner presses Run on the refresh-feed cron in the Vercel dashboard. Signed-in flows were verified locally with synthetic data, not on production. The Gemini 402 billing blocker is unchanged.

## September 30 answer kit and assisted fill (spec 04, committed locally, not deployed)

`/app/jobs/[id]/kit` lists every common application field filled only from confirmed facts and saved details, with copy buttons and sources inline; fields with nothing behind them are blank and say what to add. "Mark submitted" saves the exact kit to `application.sent` (migration 0018) and the tracker shows "What you sent". Proofline never submits anything. Details in `docs/PLAN.md`.

v2 is also done locally: extension 0.3.0 fills Greenhouse and Lever forms (including Greenhouse embedded in career pages) from the kit, shows a review panel listing every field, and "I submitted it" keeps the kit as the sent record. It adds host permissions for `job-boards.greenhouse.io`, `boards.greenhouse.io`, and `jobs.lever.co`, so testers must download the new zip from the Connect page, replace the unzipped folder, and press Reload. An unpacked extension gets the new sites on Reload; a store version would ask people to accept them. Store publishing is still the owner's call.

## September 30 Find jobs feed (spec 03, committed locally, not deployed)

`/app/find` lists internships and early-career U.S. jobs from the 96 registry boards, scored with the same engine and knockouts as a pasted job, knockouts last. A daily cron (`/api/cron/refresh-feed`) refreshes the pool and closes postings that leave their board. Filters persist per person; save and dismiss move similar listings in the ranking but never change a score. Details and local evidence are in `docs/PLAN.md`. To release: deploy, then confirm migration 0017 ran and the pool fills after the first 10:00 UTC cron, or trigger the cron once with the secret. Until then the page shows an empty-pool message.

## September 29 new-task discovery across careers

The owner clarified that Add some facts should uncover different work, not repeat existing bullets, and must serve people beyond the owner's profile. Recall previously offered saved-fact method/result follow-ups with a ranking boost; those could dominate fresh duties. Recall now offers only new core occupational tasks. Confirmed facts and active bullets provide relevance context and exclusion evidence, never reframe cards. Old pending fact follow-ups are omitted and cannot be saved through stale tabs. Legacy bank behavior remains compatible.

Matching uses the shared O*NET catalog across occupations and work, volunteering, leadership and projects. Unfamiliar titles can use specific activity and occupation clues; selected software/web/reporting project clues supplement the general matcher. Tools or broad interests alone do not establish an occupation. Part-time/full-time/contract/seasonal/freelance labels no longer distort common-duty title matching. If no supported different tasks remain, the page requests more specific work or title details instead of recycling the bank. No owner's name, account or career is hardcoded; discovery makes no model request and sends no profile to Gemini.

Duplicate checks normalize tense, quantities and common synonyms, compare the subject of broad cues against specific saved work, and exclude accepted/rejected activities. This reduces repetition but is not an exhaustive semantic-paraphrase guarantee. The shared bank currently has 6,020 distinct usable common-duty cues; occupational core relevance remains population survey evidence, not an individual's probability. Occupational wording adapters remain proposals requiring confirmation. The XYZ composer, review receipts and explicit confirmation still govern every save.

Validation: 768 tests across 84 files, typecheck, lint and production build passed. Discovery checks cover the full 6,020-cue bank, 24 careers across four experience kinds, decorated titles, unfamiliar projects and specific gardening context, rejection, exhaustion and old pending cards. Synthetic localhost browser checks verified a new task replacing saved-line follow-ups, the correct part-time bookkeeping occupation, skip advancement, basic wording review with fresh confirmation, exact saved text, a different next card, pause/resume, project discovery and no console errors. At 375px the page and dialog had no horizontal overflow. Production credentials and real accounts were not used.

The known Gemini HTTP 402 billing blocker and broader career-product readiness gates remain open; these discovery checks do not prove real model recovery or universal coverage of every career and language.


Commit `1162262` is live at https://proofline-beta.vercel.app as Ready production deployment `dpl_Cvnuqhgt8jQqKoqYb3Qt2vCnd8ma`. The Vercel cloud build passed; public checks returned home 200, signed-out My facts 307 to login, and development login 404. Reload old tabs to use new-task discovery. Signed-in checks used synthetic local data; real provider recovery remains unverified.

## September 29 provider billing outage and recall recovery

The owner reported "The wording review could not finish safely" while saving a card. Bounded live logs show two recall requests returning HTTP 402. Google's current Gemini billing documentation says a zero prepaid balance stops requests with 402; the billing account itself has not been inspected. Gemini 3.5 Flash-Lite has a free tier, but a key on a paid/prepaid project does not automatically switch to it. See https://ai.google.dev/gemini-api/docs/billing and https://ai.google.dev/gemini-api/docs/pricing. The owner must inspect the key's project in AI Studio Billing and resolve its plan/balance; no payment, key or billing setting was changed by the agent.

Recall now distinguishes an unavailable provider from a rejected sentence or incomplete response. Errors no longer imply that the person's answers were unsafe. In an edited card, retry keeps all answers and no longer offers a destructive Load next question shortcut. Provider/quota outages offer an explicit basic wording check, which runs the shared composer and all number/timeframe/estimate/ownership/voice validation without an external call or model credit. Its draft is visibly labeled as not AI-reviewed, always clears confirmation, and cannot save until the person confirms that exact sentence. Unsafe model output and clarification do not silently fall back. Model and basic review receipts are cached separately; the receipt version is recall-wording.v2. The resume export review gate is unchanged and still needs the provider.

Verification: focused provider/service tests cover the production 402, no evidence on failure or basic review, no provider call/credit for explicit basic review, exact confirmation, and separate caches. The full suite passed 758 tests in 83 files; typecheck and lint passed. A local synthetic 402 provider reproduced the failure in the browser: retry kept X/Y/Z/result, basic review left the bank unchanged and confirmation unchecked, edit returned original answers, and explicit confirmation saved one exact line, advanced the card and persisted after reload. At 375px the page width remained 375px and no inputs or controls overflowed; browser console errors were empty. Production AI review remains blocked until the billing issue is resolved; local tests do not prove it recovered.

## September 29 readiness decision

Read [BETA-READINESS.md](../BETA-READINESS.md) before claiming the beta is fully ready. The owner wants career direction and follow-through, beyond resume generation. The audit records live-provider and real-document verification gaps, manual password recovery, capacity/usability gates, and the substantive career comparison/adaptation work still needed. Career plans and agent chat remain hidden; do not simply unhide them as a substitute for completing that journey. This audit changes documentation only.

Claude Code worked on Proofline through September 28 and is handing off here. Start with this file, then `docs/PLAN.md` (roadmap and what shipped), `docs/COMPETE-PLAN.md` (the approved competitive plan), and `docs/research/COMPETITORS.md` (the brief behind it).


## September 29 whole-sentence recall review and metric choices

The owner supplied a real awkward example: a marketing duty followed by "for booked 50 percent more appointments". Local composition now recognizes full quantitative actions and percentage comparisons in Y as outcomes, rather than appending them as units. Y offers a dropdown for a count/amount (with unit and optional timeframe), percentage change (value, direction, and what changed), frequency, or their own wording.

Save rereads all X/Y/Z answers together through the existing Gemini review service/key, with the owner's explicit approval to send only that card's answers. A dedicated prompt rewrites and rereads the complete sentence, removes occupational-template padding, preserves support/ownership, and asks for clarification rather than guessing. Numeric meaning (including currency and percent), timeframes, estimates, action openers, and voice rules are checked in code. Provider errors, unsafe output, and quota limits retain the answers and block saving. No configured model uses a visibly labeled basic local check.

If the reviewed sentence matches the confirmed preview, it saves. If wording changes, "Did you mean this?" displays the revision and clears confirmation; no evidence exists until the person confirms the exact revision. Edit my answers returns to the form. Server-held review receipts are scoped to account, card, exact raw answers, prompt version, and 30-minute expiry; stale clients cannot save without review. Unchanged reviews are cached so approval does not trigger another model call. Raw parts remain attached to the confirmed fact; old facts are not silently rewritten. No database migration is needed.

Local browser verification used synthetic insurance work and a local model test double, not a real provider key or production account. It reproduced the owner's free-text example, exercised count/frequency/percentage controls, verified the unchecked revision before save, returned to edit answers, saved exactly the reviewed sentence, advanced to the next card, and found no console errors. At 375px the dialog was 343.2px with every field inside the viewport; desktop also passed. The saved line was: "Booked 50 percent more appointments by developing insurance marketing strategies using an automation system I designed". This test double verifies the flow, not real model quality; a real signed-in provider request remains to be verified on beta. The privacy note and save guidance now disclose wording review through Gemini. Final validation passed: 754 tests in 83 files, typecheck, lint, and production build.

Commit `94dee68` is live on https://proofline-beta.vercel.app as Ready production deployment `dpl_C5H3UjsEhou6aB4XZAHnkSQFaJtU`. The cloud build and live public-route/login-boundary checks passed; the deployed privacy note includes Gemini wording review. CLI 61.0.0 returned Not authorized, but the prior CLI 60.1.3 recognized the existing account and deployed successfully without changing credentials. Use `npx vercel@60.1.3 --prod --yes` for this checkout until the CLI authentication difference is resolved. Reload old tabs before saving recall cards. Signed-in flow verification used synthetic local data and a model test double; a live signed-in Gemini request remains unverified.

## September 28 fluent XYZ bullets

The owner asked that filled X/Y/Z answers read as one polished bullet on every card. The shared composer now integrates quantities with the correct noun, uses real frequencies without parentheses, turns first-person/present-tense notes into past-tense actions, distinguishes tools from action methods, fixes parallel method tense, and leads with supplied outcomes when clear. Estimates, ranges, money, percentages, and original denominator values remain unchanged. An unexplained percentage or an uncountable task with a bare count asks for clarification; nothing is inferred. Supporting work stays supporting work.

The live preview and server use the same composer. Every save must contain the exact finished text the person reviewed, so a stale client or changed preview cannot silently confirm different wording. Editing clears the checkbox and inputs pause during a save. Raw structured answers stay alongside the confirmed fluent line for follow-ups; supplied results are not asked again. Existing confirmed lines are not bulk rewritten.

The full-bank regression audit covers 6,000 distinct usable templates and 24,000 compositions with method/result variants. Additional cases cover named units, passive-vs-active experience, singular counts, shorthand frequencies, percentage results, participation, preserved numbers, saved raw parts, and stale-preview rejection. Final checks passed: 741 tests in 82 files, typecheck, lint, and build. Local browser checks verified live wording, number changes clearing confirmation, exact preview/save text, next-card advancement, no console errors, and no phone overflow at 375px. Production credentials and accounts were not entered.

Commit `b15542b` is live on https://proofline-beta.vercel.app as Ready production deployment `dpl_CGJqn3VNeaC5B74imhWpbtppMCZf`. The cloud build passed. Live route checks returned 200 for the home page and /check, redirected signed-out My facts visitors to login, and returned 404 for development login. Signed-in wording and save checks used localhost with synthetic data. Reload any previously open tab before confirming a new card so its preview uses the deployed composer.

## Continuing fact cards (September 28)

The owner clarified that Proofline should help people recall work, build a large bullet bank, and select from it for each application. My facts now exposes Add some facts, with a role picker and continuing Yes/No cards; each role also has Suggest more facts. Onboarding shows the same questions immediately after a role is saved, even when no initial task lines were entered. This supersedes the old two-line minimum described below.

New occupational cards use O*NET core duties and stricter role/context matching. Core classification requires >=67% occupational relevance, which is a common-duty filter above the requested 50% threshold, not a personal likelihood estimate. Follow-ups ask about results and tools in the person's actual confirmed wording. Nothing becomes evidence until they edit/check the confirmation box and save. Rejections and unanswered cards persist; users can pause and return. No fabricated metrics or target bank size.

All recall recommendations now start with a strong action verb and show fill-in X-Y-Z parts. Counts, frequencies, percentages, methods, and optional results come from the person; server validation requires the checked confirmation and complete XYZ details. The catalog has 18,838 tasks across 1,016 occupations and 5,997 distinct usable common-duty prompts after wording/grammar filtering, before personal follow-ups. Legacy bank cards remain compatible.

Checks: 726 tests in 82 files, typecheck, lint, build, local phone/desktop browser flow, and a 121-line bank selecting a relevant late-added line for a job while retaining all 121 saved bullets.

Commit `3fb7590` is live on https://proofline-beta.vercel.app as Ready production deployment `dpl_EVtZiCoLmm1QDaXueHtzKjGKWUr6`. The cloud build passed; public pages return 200, My facts redirects signed-out visitors to login, and the development login remains unavailable on production. Signed-in feature checks used localhost and synthetic data.

## Codex continuation (September 28)

The active checkout is `C:\Users\chris\proofline`. The `work/` folder in the OneDrive workspace is an older copy. The owner authorized taking over the active checkout after Claude and Cursor stopped editing it.

The unfinished education/contact changes are now complete and verified locally. Multiple degrees, per-degree honors and coursework, checked imported details, resume email, LinkedIn, and website survive onboarding and tailoring. My facts provides Add education and Edit contact details. An unchecked "CPA candidate" line creates no fact; an imported one-line Front Desk role saves without a fabricated second line. Revoking an honor invalidates a resume that cites it even when it shares a line with GPA.

Checks passed: typecheck, lint without warnings, 705 tests in 80 files, production build, and the 200-profile/800-posting synthetic benchmark (zero failures). PDF and DOCX content checks and local phone/desktop browser checks passed. Migration `0016_contact_email.sql` is applied locally. Commits `8623e2d` and `d75791f` are deployed to the live beta as Ready deployment `dpl_4H2gu7aYhTCxv5meS7WdbEz7VXR3`.

The owner reported replacing the review API key with Cursor. Vercel confirms the production key is configured; no recent review-failure logs were found. A fresh model-backed review is still needed to verify the replacement. Do not enter credentials or bypass the review gate. On the live version, re-import or correct the education/contact facts, fix old pasted job metadata, rebuild the resume, and rerun the review. Compare the result with the owner's original PDF; the synthetic test is not that comparison.

## State right now

- **Live beta:** https://proofline-beta.vercel.app (Vercel project `proofline-beta`, Neon Postgres). Deploy with `npx vercel@60.1.3 --prod --yes` from this folder; migrations run on the first request (latest is `drizzle/0016_contact_email.sql`).
- **Sign-up is open to any email** (`BETA_EMAILS=*` in Vercel production; see `lib/beta-access.ts`). The owner wants a few more people trying it.
- **Everything is committed on `main`** (no Git remote). The last app deploy includes `94dee68` for whole-sentence review and metric choices, `b15542b` for fluent confirmed XYZ wording and `3fb7590` for continuing recall cards, plus `8623e2d` and `d75791f` for pasted job corrections and education/contact preservation.
- Checks: `npm run typecheck`, `npm run lint`, `npm test` (754 tests passing after the whole-sentence review update), `npm run build`.
- The owner (Christian) tested with his real resume and a real posting. His account is on production; the job is `/app/jobs/6eafe6cc-e1bc-4a6f-8429-40c22443000a`. His verdict: the generated resume "is way off and just does not look correct". The fixes below come from that test.

## Fix next, in this order

### 1. Review key replaced; fresh review pending

Earlier production logs showed a 401 authentication failure from the review model. The owner has since reported replacing `PROOFLINE_REVIEW_KEY` with Cursor. The Vercel CLI confirms the production secret is configured, and the latest app deployment is Ready. No recent `review.gate` logs were found; that does not prove a successful model call.

On the owner's saved job, correct or re-import the facts and posting details, rebuild the resume, then press Re-run review. If it fails, read the bounded logs with `npx vercel logs <deployment-url> --query review.gate --since 10m --limit 10 --no-follow`. The default model is `gemini-3.5-flash-lite` (`PROOFLINE_REVIEW_MODEL` overrides it). Agents must not enter API keys or create production test accounts.

### 2. Pasted-job details are wrong (done September 28)

His pasted posting became company "Pw" (the avatar initials of "Posted" and "weeks") and the line under the title read "Posted 3 weeks ago∙Apply by October 2, 2026 at 11:59 PM · Onsite, based in Alexandria, VA"; the browser tab title reads "… at Posted 3 weeks ago…". The production database URL is a Vercel secret, so the stored paste could not be read. The guesser was fixed against that header: `lib/jobs/guess-posting.ts` ignores "Posted … ago", "Apply by …", and similar board lines; rejects company guesses of one or two characters (a logo's "Pw"); and reduces "Onsite, based in Alexandria, VA" to Alexandria, VA (work mode still comes from the posting text). A pasted job's page has "Fix title, company, or place" (`updateJobDetails`). His existing job still has the bad values until he corrects them there or pastes again.

### 3. Multiple education entries and contact details (deployed September 28)

His resume lists a Master's (UNC Greensboro, Jan to Jun 2027) and a Bachelor's (Expected Dec 2026, 3.69 GPA, Dean's List, coursework including "Federal Tax Concepts (prepared tax returns, Grade A)"). Onboarding keeps only the first entry, so the tailored resume lost the Bachelor's, the GPA, Dean's List, and the coursework, which matter most for a tax internship. The fact base models education as single fields (`lib/facts/base.ts`, `saveEducation`, profile columns). Needed:

- More than one education entry, each with honors and coursework, in onboarding, My facts, and the tailoring engine (`lib/resume/tailor*.ts`, `lib/resume/document.ts`).
- LinkedIn and website fields in onboarding. `profile.linkedinUrl` and `portfolioUrl` exist; the import draft (`lib/onboarding/draft.ts`) doesn't map `parsed.links` yet. His header lost `christianbrinkleync.com` and his LinkedIn.
- The contact email comes from the account email. His resume uses `christianbrinkley4@gmail.com`, but the generated one shows `christianbrinkley04@gmail.com`. Check whether that's the address he signed up with, and let the resume email be edited.
- The parser drops an education line it can't classify ("CPA candidate"). Keep such lines as an education detail so the person can confirm or delete them.

### 4. Tense within one entry (deployed September 28)

Projects without dates came out as "Architect…/Track…" next to "Drove…/Booked…/Built…". Tense should be consistent within an entry: present for a current role or ongoing project, past otherwise. See `lib/resume/polish.ts` (`toPastTense`, `roleEnded`) and where tailoring applies it.

### 5. Smaller issues seen in the same test

- Every non-project role needs two lines (`saveRoleStepAction`). His Front Desk role had one on his resume, so import makes him write a second. Consider allowing one line for imported roles.
- Compare his hand-tailored resume (he has the PDF) with Proofline's output line by line once items 1 to 4 are fixed. Done September 30: see "owner's resume compared line by line" in `docs/PLAN.md`. Coursework and education detail now survive; the contact line, skill capitalization, and coursework order were fixed.

## What shipped on September 28 (all live)

The landing page leads with "The resume you can defend in the interview"; inline line editing on the tailored resume; cover letter and interview prep unhidden for testers; a LinkedIn profile kit (`/app/facts/linkedin`); a free public check at `/check`; spoken mock interviews with fact-checked feedback; "ways to earn" a missing skill; a browser extension (`extension/`, `/app/extension`, zip in `public/`); proof links (`/proof/[slug]`); three sourced guides at `/guides`; a sitemap and robots rules; open sign-up; resume import in onboarding (`/api/onboarding/resume-draft`); parser fixes for Word-made resumes (Symbol bullets, degree-first education, labeled skills, hyphen wraps); present-tense verbs accepted; 401(k) no longer counted as a claim; resume preview fonts fixed on the job page. Details are in `docs/PLAN.md` and the commit messages.

## Rules the owner cares about

- **No AI slop, ever.** Copy must be specific, plain, and true. No em dashes and no filler words (`lib/voice/rules.ts`; `tests/site-copy.test.ts` enforces this on site copy). Check every new screen at 375px and on desktop.
- **Only confirmed facts reach a resume.** The person ticks "This is true, and it's in my own words"; never tick it for them, and never write a claim, number, or reason for wanting a job on their behalf.
- **The fit score is not a hiring probability.** Never describe it as one.
- **Don't create accounts or enter passwords or API keys on production.** Use `/api/dev/login` and `/api/dev/seed` locally (development only). PGlite is single-process; see the README.
- **Commit style:** one finished slice per commit, a plain descriptive message, run all four checks first. Keep `docs/PLAN.md` current.
- **Decisions still the owner's:** pricing after the beta, a paid job-search provider, publishing the extension to the Chrome Web Store, and a career-center pilot. An email provider (Resend) is also worth adding so password resets reach testers; today reset links land in the `inbox_message` table for the owner.

## Slice done: one imported line (September 28)

`saveRoleStepAction` still asks for two lines on a role the person types. An imported role that already has one line, such as Front Desk, can be saved with that line. Onboarding does not write the second line and does not confirm it.

## Slice done: tense within one entry (September 28)

An entry with no dates is past tense. A current role or ongoing project (a start date and no end date, so the line says Present) is present tense. `polishBullet` changes only the opening verb, so "Architect" and "Track" no longer sit next to "Drove", "Booked", and "Built" in the same block.


Commit `9aa8953` is live at https://proofline-beta.vercel.app as Ready production deployment `dpl_8btrqyfTD94H1ub3NTqzoHBUecKY`. The Vercel cloud build passed. Post-deployment checks returned 200 for home, 307 for signed-out My facts, and 404 for development login. Signed-in recovery behavior was verified locally with a synthetic 402 provider; actual Gemini billing recovery has not been verified. No billing settings or credentials were changed.
