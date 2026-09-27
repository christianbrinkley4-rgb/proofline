# Mock applicant benchmark

Run `npm run eval:stress` when changing bullet generation, job relevance, resume tailoring, cover letters, fit guidance, or job-specific coaching.

The runner uses seed `0x5eed1234` with an isolated in-memory database. It creates 200 fictional profiles from 20 role templates and 800 distinct fictional job descriptions. Each profile gets three matched postings and one SQL-required posting without confirmed SQL experience. Profiles can contain an unconfirmed imported claim and a newer unrelated experience. The runner exercises the actual service functions without calling a model, sending an application, or touching user records.

The baseline run passed all 600 matched resume and cover-letter checks. The relevant confirmed fact appeared and led the checked resume explanation and letter evidence in all 600. All 200 SQL-gap postings produced missing-skill guidance and job-specific document coaching, and their drafts did not claim SQL experience. No unconfirmed imported claim appeared in the checked resume or letter text. The run reported zero failures.

These are synthetic consistency checks, not observed hiring outcomes. The 800 descriptions reuse 20 role templates and do not represent 800 independently sourced employers. The assertions check factual support, relevance ordering, and actionable gap guidance. They do not measure layout appeal, human persuasiveness, screening acceptance, or interview rates. Model-backed source selection needs separate recorded runs and human review. Any learning from real application outcomes should require user consent and a snapshot of the exact job description and documents, kept separate from online self-reports.

## Occupational question catalog

Proofline includes O*NET 31.0 task data, licensed CC BY 4.0 by the National Center for O*NET Development ([source](https://www.onetcenter.org/database.html), [license](https://www.onetcenter.org/license_db.html)). It contains 18,838 tasks across 1,016 occupations. The voice and safety filters currently yield 7,051 base questions, with two optional method/result follow-ups after a task is confirmed (21,153 potential prompts). The agent can retrieve a small set for a person's actual experience, ranked to a supplied posting. These are questions, never resume claims or verified hiring outcomes.
