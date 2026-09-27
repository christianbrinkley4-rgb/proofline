# Small beta sharing handoff

Status: **small beta live** at https://proofline-beta.vercel.app. The founder authorized deployment after release checks. Share this link with a few testers; signup is open to anyone with the link.

## What is working locally

- Resume and cover-letter drafts use confirmed profile evidence. Empty or unsupported documents fail quality checks; missing posting requirements become questions or practice steps.
- A general resume path remains available. A pasted or saved job description drives job-specific tailoring and coaching.
- Career goals can use a saved posting as a benchmark or start with exploration. Check-ins retain evidence counts, reflections, and completed exploration steps. The next exploration step advances after a completion.
- The agent can read the career plan, reflections, completed steps, profile, job fit, and application tracker through guarded tools. Its offline path works without a model key.
- Account-owned ratings for resumes, letters, job coaching, and career plans now have a validated backend path. Feedback can guide that person's later revisions; optional consent is required before any future cross-user product review. The optional feedback control is present on resume, cover-letter, and career-plan pages; it keeps improvement consent unchecked by default.
- After Claude Code's second UI pass and backend integration, the checkout passed 557 tests across 62 files, typecheck, lint with zero errors or warnings, and a production build. The deterministic evaluation also passed after the requirement-grouping fix. A later targeted check passed the final coordinated-negation rule and cover-letter export cases.
- The deterministic evaluation exercised 200 fictional profiles and 800 fictional postings from 20 role templates: 600 matched-document cases and 200 missing-skill cases passed, with zero unsupported claims in the checked output. Local browser journeys created general resumes, three job-specific resumes, and cover letters from fictional receptionist and restaurant-manager profiles. It found and fixed duplicated profile facts, a false phone match, sparse-resume quality scoring, mislabeled preferred requirements, and an unrelated O*NET gap suggestion. This is a regression benchmark, not proof of employer acceptance or interview success.

## Prepared infrastructure

- Vercel project: proofline-beta in christianbrinkley4-5140s-projects, linked to this checkout. Production deployment dpl_Eko4ryDsBVzFondEE4XWsnhFQW2V reported READY and is aliased to https://proofline-beta.vercel.app.
- Neon project: Proofline beta on the Free plan, production branch in AWS us-east-2. Hosted migrations through 0012 are applied. The career tables, completion column, and shared model-budget table were verified.
- Vercel production settings include DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, NEXT_PUBLIC_SITE_URL, and CRON_SECRET.
- The founder chose an independent rules-based first beta. Vercel production has PROOFLINE_AI_MODE=rules, so no external model call runs even if a key is later present. No Anthropic key is configured or needed for this beta. Per-account and platform-wide model credit ceilings remain implemented for a future optional model mode; the platform setting is 80 credits per UTC day, but credits are request reservations, not a dollar budget.

Secrets are in ignored local files and Vercel environment settings. Never commit or paste them into docs, issues, or chat.

## Release verification and current limits

- Public landing and signup returned HTTP 200. A synthetic account signed up, authenticated `/app`, signed out, signed back in, and retained the same account ID. Signed-out access to `/app` redirected to login.
- Production `/api/dev/login`, `/api/dev/seed`, and `/api/dev/sample-resume` returned 404. Unauthenticated `/api/mcp` and resume exports returned 401.
- Local browser journeys covered onboarding, imported evidence, a general resume, three tailored variants, a cover letter, a saved gap answer, and a career check-in. The local authenticated resume PDF and DOCX endpoints returned attachment headers and valid `%PDF` and ZIP/DOCX bytes. Cover-letter PDF and DOCX renderer tests check signatures; long PDF letters now paginate. The in-app browser did not surface a download event, so a phone download has not been directly observed.
- Rules mode is the production setting. Testers need no API key. No model-backed drafting or hiring outcome guarantee is implied by the deterministic benchmark.
- GitHub's student-benefit account status was not verified: the browser approval service hit its usage limit when opening the education benefits page. This checkout has no Git remote, so GitHub Actions and student offers are not connected yet. The Vercel and Neon beta setup works independently.
- Two synthetic hosted smoke accounts were created during release verification. They contain no personal resume data.

After launch, collect consent-based feedback about usefulness, factual accuracy, and application outcomes. Synthetic checks cannot establish employer acceptance or interview success. The wider life-coach vision remains a future phase beyond this career-focused beta. A forwarded link could increase usage, though rules mode makes no external model calls. Each tester should use their own account.

## Questions for testers

- Could you complete a profile and make a resume for a real posting without help?
- Which question or recommendation was useful? Which felt wrong or generic?
- Did any resume bullet or cover-letter claim something you never did?
- Did the career plan give you one realistic next step? What did you learn after trying it?
- Would you use the exported document for an application after reviewing it? Why or why not?

The account menu has a Share feedback link with prompts. Ask for a screenshot or job URL only if the tester is comfortable sharing it. Keep real resumes in each tester's account rather than collecting them by email.