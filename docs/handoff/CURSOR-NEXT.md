# Handoff to Cursor (September 28, 2026)

Claude Code worked on Proofline through September 28 and is handing off here. Start with this file, then `docs/PLAN.md` (roadmap and what shipped), `docs/COMPETE-PLAN.md` (the approved competitive plan), and `docs/research/COMPETITORS.md` (the brief behind it).

## State right now

- **Live beta:** https://proofline-beta.vercel.app (Vercel project `proofline-beta`, Neon Postgres). Deploy with `npx vercel --prod --yes` from this folder; migrations run on the first request (latest is `drizzle/0015_resume_share.sql`, already applied).
- **Sign-up is open to any email** (`BETA_EMAILS=*` in Vercel production; see `lib/beta-access.ts`). The owner wants a few more people trying it.
- **Everything is committed on `main`** (no Git remote). The last deploy includes every commit up to "Load the resume fonts wherever the preview renders, and log review failures".
- Checks: `npm run typecheck`, `npm run lint`, `npm test` (681 tests passing at handoff), `npm run build`.
- The owner (Christian) tested with his real resume and a real posting. His account is on production; the job is `/app/jobs/6eafe6cc-e1bc-4a6f-8429-40c22443000a`. His verdict: the generated resume "is way off and just does not look correct". The fixes below come from that test.

## Fix next, in this order

### 1. The AI review key is invalid (owner action, blocks every download)

Production logs show: `[review.gate] failed: Review model gemini-3.5-flash-lite returned 401 ... UNAUTHENTICATED ... Expected OAuth 2 access token`. The saved `PROOFLINE_REVIEW_KEY` is not a working Gemini API key. Until it is, no resume passes review, so nothing can be downloaded, and the cover letter link and proof links never appear.

The owner must create a key at https://aistudio.google.com/app/apikey (it starts with `AIza`), then replace it himself. Agents must not enter API keys:

```bash
npx vercel env rm PROOFLINE_REVIEW_KEY production --yes
npx vercel env add PROOFLINE_REVIEW_KEY production
npx vercel --prod --yes
```

Then press Re-run review on his job and read `npx vercel logs <deployment-url> --since 10m | grep review.gate` if it still fails. The default model is `gemini-3.5-flash-lite` (`PROOFLINE_REVIEW_MODEL` overrides it).

### 2. Pasted-job details are wrong

His pasted posting became company "Pw" and location "Posted 3 weeks ago∙Apply by October 2, 2026 at 11:59 PM · Onsite, based in Alexandria, VA"; the browser tab title reads "… at Posted 3 weeks ago…". Fix the guesser in `lib/jobs/guess-posting.ts` (tests in `guess-posting.test.ts`): ignore "Posted … ago", "Apply by …", and similar job-board lines; reject one- or two-letter company guesses such as a logo's initials; reduce "Onsite, based in Alexandria, VA" to the place and the work mode. Read the stored description of that job to get his exact paste. Also let the person correct company, title, and location on the job page.

### 3. Beta onboarding holds only one education entry, and no links

His resume lists a Master's (UNC Greensboro, Jan to Jun 2027) and a Bachelor's (Expected Dec 2026, 3.69 GPA, Dean's List, coursework including "Federal Tax Concepts (prepared tax returns, Grade A)"). Onboarding keeps only the first entry, so the tailored resume lost the Bachelor's, the GPA, Dean's List, and the coursework, which matter most for a tax internship. The fact base models education as single fields (`lib/facts/base.ts`, `saveEducation`, profile columns). Needed:

- More than one education entry, each with honors and coursework, in onboarding, My facts, and the tailoring engine (`lib/resume/tailor*.ts`, `lib/resume/document.ts`).
- LinkedIn and website fields in onboarding. `profile.linkedinUrl` and `portfolioUrl` exist; the import draft (`lib/onboarding/draft.ts`) doesn't map `parsed.links` yet. His header lost `christianbrinkleync.com` and his LinkedIn.
- The contact email comes from the account email. His resume uses `christianbrinkley4@gmail.com`, but the generated one shows `christianbrinkley04@gmail.com`. Check whether that's the address he signed up with, and let the resume email be edited.
- The parser drops an education line it can't classify ("CPA candidate"). Keep such lines as an education detail so the person can confirm or delete them.

### 4. Tense within one entry is mixed

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
