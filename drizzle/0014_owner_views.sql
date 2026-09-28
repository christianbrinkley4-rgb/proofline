-- Read-only views that give the owner the private-beta data model by its spec names.
-- The app writes to the underlying tables; these only rename and filter.

-- Confirmed, current facts: the fact base every resume claim must trace to.
CREATE OR REPLACE VIEW "facts" AS
SELECT
  f.id,
  f.user_id,
  CASE
    WHEN f.category IN ('education') THEN 'education'
    WHEN f.category IN ('project') THEN 'project'
    WHEN f.category IN ('skill', 'tool') THEN 'skill'
    WHEN f.category IN ('certification') THEN 'license'
    WHEN f.category IN ('metric') THEN 'number'
    ELSE 'experience'
  END AS category,
  f.content AS claim_exact_text,
  f.source,
  f.confirmed_at AS verified_at
FROM "fact" f
WHERE f.superseded_at IS NULL AND f.verification_state = 'confirmed';
--> statement-breakpoint

-- Postings each person ingested or saved, with the keyword phrases read from them.
CREATE OR REPLACE VIEW "jobs" AS
SELECT
  j.id,
  m.user_id,
  j.title,
  j.company,
  j.location,
  j.url,
  j.description AS jd_text,
  j.keywords AS jd_keywords,
  m.created_at
FROM "job_match" m
JOIN "job" j ON j.id = m.job_id
WHERE m.status <> 'dismissed';
--> statement-breakpoint

CREATE OR REPLACE VIEW "applications" AS
SELECT
  a.id,
  a.user_id,
  a.job_id,
  a.resume_id AS resume_version_id,
  CASE a.stage
    WHEN 'saved' THEN 'Saved'
    WHEN 'applied' THEN 'Applied'
    WHEN 'assessment' THEN 'Assessment'
    WHEN 'interview' THEN 'Interview'
    WHEN 'offer' THEN 'Offer'
    ELSE 'Rejected'
  END AS status,
  a.applied_at AS submitted_at,
  a.confirmation_ref,
  a.next_follow_up_at AS followup_due,
  a.follow_up_sent_at AS followup_sent_at
FROM "application" a;
--> statement-breakpoint

-- The funnel events, one row each: where testers stall.
CREATE OR REPLACE VIEW "event_log" AS
SELECT e.user_id, e.type AS event, e.created_at
FROM "agent_event" e
WHERE e.type IN ('signup', 'job_ingested', 'score_viewed', 'tailor_completed', 'gate_passed', 'gate_failed', 'exported');
