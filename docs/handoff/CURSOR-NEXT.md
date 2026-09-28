# Handoff to Cursor (September 28, 2026)

Claude Code worked on Proofline through September 28 and is handing off here. Start with this file, then `docs/PLAN.md` (roadmap and what shipped), `docs/COMPETE-PLAN.md` (the approved competitive plan), and `docs/research/COMPETITORS.md` (the brief behind it).

## Continuing fact cards (September 28)

The owner clarified that Proofline should help people recall work, build a large bullet bank, and select from it for each application. My facts now exposes Add some facts, with a role picker and continuing Yes/No cards; each role also has Suggest more facts. Onboarding shows the same questions immediately after a role is saved, even when no initial task lines were entered. This supersedes the old two-line minimum described below.

New occupational cards use O*NET core duties and stricter role/context matching. Core classification requires >=67% occupational relevance, which is a common-duty filter above the requested 50% threshold, not a personal likelihood estimate. Follow-ups ask about results and tools in the person's actual confirmed wording. Nothing becomes evidence until they edit/check the confirmation box and save. Rejections and unanswered cards persist; users can pause and return. No fabricated metrics or target bank size.

All recall recommendations now start with a strong action verb and show fill-in X-Y-Z parts. Counts, frequencies, percentages, methods, and optional results come from the person; server validation requires the checked confirmation and complete XYZ details. The catalog has 18,838 tasks across 1,016 occupations and 5,997 distinct usable common-duty prompts after wording/grammar filtering, before personal follow-ups. Legacy bank cards remain compatible.

Checks: 726 tests in 82 files, typecheck, lint, build, local phone/desktop browser flow, and a 121-line bank selecting a relevant late-added line for a job while retaining all 121 saved bullets.

## Codex continuation (September 28)

The active checkout is `C:\Users\chris\proofline`. The `work/` folder in the OneDrive workspace is an older copy. The owner authorized taking over the active checkout after Claude and Cursor stopped editing it.

The unfinished education/contact changes are now complete and verified locally. Multiple degrees, per-degree honors and coursework, checked imported details, resume email, LinkedIn, and website survive onboarding and tailoring. My facts provides Add education and Edit contact details. An unchecked "CPA candidate" line creates no fact; an imported one-line Front Desk role saves without a fabricated second line. Revoking an honor invalidates a resume that cites it even when it shares a line with GPA.

Checks passed: typecheck, lint without warnings, 705 tests in 80 files, production build, and the 200-profile/800-posting synthetic benchmark (zero failures). PDF and DOCX content checks and local phone/desktop browser checks passed. Migration `0016_contact_email.sql` is applied locally. Commits `8623e2d` and `d75791f` are deployed to the live beta as Ready deployment `dpl_4H2gu7aYhTCxv5meS7WdbEz7VXR3`.

The owner reported replacing the review API key with Cursor. Vercel confirms the production key is configured; no recent review-failure logs were found. A fresh model-backed review is still needed to verify the replacement. Do not enter credentials or bypass the review gate. On the live version, re-import or correct the education/contact facts, fix old pasted job metadata, rebuild the resume, and rerun the review. Compare the result with the owner's original PDF; the synthetic test is not that comparison.

## State right now

- **Live beta:** https://proofline-beta.vercel.app (Vercel project `proofline-beta`, Neon Postgres). Deploy with `npx vercel --prod --yes` from this folder; migrations run on the first request (latest is `drizzle/0016_contact_email.sql`).
- **Sign-up is open to any email** (`BETA_EMAILS=*` in Vercel production; see `lib/beta-access.ts`). The owner wants a few more people trying it.
- **Everything is committed on `main`** (no Git remote). The last app deploy includes commits `8623e2d` and `d75791f` for pasted job corrections and education/contact preservation.
- Checks: `npm run typecheck`, `npm run lint`, `npm test` (681 tests passing at handoff), `npm run build`.
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
- Compare his hand-tailored resume (he has the PDF) with Proofline's output line by line once items 1 to 4 are fixed. His version keeps coursework and education detail that Proofline currently drops.

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
