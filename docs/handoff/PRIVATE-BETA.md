# Private beta runbook (2 to 5 testers)

What testers get: sign up (allowlist only), a three-step onboarding, knockouts and a fit score for any pasted job, one tailored resume behind a review gate, PDF/DOCX download, and a tracker. Everything else in the codebase (agent chat, MCP connector, career plans, cover-letter packets, live search, the old profile tools) is hidden by `PRIVATE_BETA` in `lib/beta.ts`.

## Before you invite anyone

Set these in Vercel (Production), then redeploy. Migrations 0013 and 0014 run on the first request after deploy.

| Variable | Needed? | What it does |
|---|---|---|
| `BETA_EMAILS` | Yes | Comma-separated tester emails. Only these can create accounts. Unset means nobody can sign up. |
| `PROOFLINE_REVIEW_KEY` | Yes | A Gemini API key (Google AI Studio). The only model key. Without it, AI review says "temporarily unavailable" and new resumes can't pass the gate, so they can't be downloaded. |
| `PROOFLINE_REVIEW_MODEL` | No | Defaults to `gemini-2.5-flash-lite`. Change it if Google retires that model. |
| `RESEND_API_KEY`, `EMAIL_FROM` | No | Emails password-reset links. Without them, links land in the database for you to forward (see below) and last 3 days. |
| `PROOFLINE_DAILY_MODEL_CREDITS` | No | Per-user model calls per day. Default 50. |
| `PROOFLINE_DAILY_PLATFORM_MODEL_CREDITS` | No | All users combined. Default 250. |
| `PROOFLINE_AI_MODE` | No | Leave unset or `rules`. Legacy drafting only runs with `anthropic`. |

Then: sign up yourself with an allowlisted address, run one job end to end, and download the PDF.

## Reading what testers do (Neon SQL editor)

Feedback (the always-visible button), newest first:

```sql
select created_at, email, page, message from inbox_message where kind = 'feedback' order by created_at desc;
```

Contact form (the public "Talk to us"):

```sql
select created_at, name, email, message from inbox_message where kind = 'contact' order by created_at desc;
```

Password resets waiting on you (only when no email provider is set). Send the link to that address yourself:

```sql
select created_at, email, message from inbox_message where kind = 'password_reset' order by created_at desc;
```

Where testers stall, as a funnel:

```sql
select u.email, e.event, count(*) as times, min(e.created_at) as first, max(e.created_at) as last
from event_log e join "user" u on u.id = e.user_id
group by u.email, e.event order by u.email, first;
```

Events logged: `signup`, `job_ingested`, `score_viewed`, `tailor_completed`, `gate_passed`, `gate_failed`, `exported`.

The spec's data model, as views over the real tables: `facts` (id, user_id, category, claim_exact_text, source, verified_at), `jobs` (id, user_id, title, company, location, url, jd_text, jd_keywords, created_at), `applications` (id, user_id, job_id, resume_version_id, status, submitted_at, confirmation_ref, followup_due, followup_sent_at), `event_log` (user_id, event, created_at).

## How the gate works

1. The linter (`lib/review/linter.ts`) runs 16 checks on the resume text. Four are blocking: one page, no em dashes, every claim matches a confirmed fact, and no banned content. A failing check must quote the exact text from the resume; one that can't quote it passes.
2. Only when every blocking check passes, one model call (`lib/review/model.ts`) reviews the resume against the posting's requirements and the tester's facts. The contact line is not sent. Issues that don't quote the resume verbatim, or whose fix adds an unconfirmed number, are dropped in code.
3. Export (`/api/resumes/[id]/[format]`) re-runs the linter and requires the stored model PASS to match this exact resume text, facts, and posting (a fingerprint). Editing a fact invalidates it.

## Deleting a tester's data

Testers can do it themselves: Settings, "Delete my account and all my data". It removes the user row and everything tied to it, plus job postings that only they had. To do it for someone, sign in as them or delete the `user` row; the schema cascades.

## Known limits

- The review was verified locally against a stub of the Gemini endpoint, not the real model. Run one real job after setting the key.
- Without an email provider, password resets need you to forward the link by hand.
- Fit scores explain alignment with a posting. They are not a hiring probability.
