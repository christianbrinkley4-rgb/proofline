# Simplification audit (September 30, 2026)

Written before any code changed. The question: what does a first-time student hit between "I want an entry-level job" and "I have a tailored resume"?

## The journey as it stood

| # | Screen | Route | What it asks |
| --- | --- | --- | --- |
| 1 | Landing | `/` | Get started |
| 2 | Sign up | `/signup` | Name, email, password, Create account |
| 3 | Education (1 of 5) | `/app/onboarding` | Optional resume upload. Then 15 fields: name, phone, resume email, LinkedIn, website, city, state, school, degree, major, graduation, GPA, honors, coursework. Tick "This is true". Continue |
| 4 | Experience (2 of 5) | same | Kind, company, title, start, end, up to 4 blank "what you remember doing" boxes. Tick "This is true". Save this role. Then optional task cards, one at a time, each with a three-part form (how much, how, what changed) and another tick. Continue |
| 5 | Projects (3 of 5) | same | Same form for projects, or Skip |
| 6 | Skills and licenses (4 of 5) | same | Chip inputs, tick if changed, Continue or Skip |
| 7 | Where and when you can work (5 of 5) | same | Work authorization, places, setups, relocation, start month. Continue or Skip |
| 8 | Paste your first job | same | Link or whole posting, check title and company, Check my fit |
| 9 | Job: Fit score | `/app/jobs/[id]` | Knockouts panel, score breakdown, Strengths, Gaps, What this role rewards, Across your saved roles, then "Tailor my resume for this job" at the bottom of the sidebar |
| 10 | Job: Tailor | `/app/jobs/[id]?tab=tailor` | Builds and reviews automatically. PDF, DOCX, Re-run review, Track with this resume, cover letter banner, proof link card, and Review / Why this works / What I cut tabs with BLOCKING, WARN, and INFO tags |

Elsewhere: Today (`/app`), Find jobs (`/app/find`), Jobs (`/app/jobs`), My facts (`/app/facts`), LinkedIn kit (`/app/facts/linkedin`), Application packet (`/app/jobs/[id]/packet`), Answer kit (`/app/jobs/[id]/kit`), Tracker (`/app/tracker`), Settings (`/app/settings`), Resumes (`/app/resumes`).

**Signup to downloaded resume, before:** 10 screens and 13 clicks on the shortest path (plus 9 typed fields). That shortest path saves the role with no lines, so the resume has an empty role. Getting two real lines onto it took about 8 more clicks through the task cards: roughly 21 clicks in practice.

## Top 10 friction points

1. **Five sub-screens before the first job.** Onboarding shows a three-step progress bar, then "Step 1 · Education (1 of 5)" inside it. A student fills out projects, skills, licenses, visa status, relocation, and a start month before seeing anything happen. Only education and one role are required.
2. **The first screen is a 15-field form.** Only school and graduation month are required, but phone, resume email, LinkedIn, website, city, state, GPA, honors, and coursework all sit open on the first screen.
3. **The blank box.** The role form gives four empty "what you remember doing" boxes. The alternative is a task card that asks for the line in three parts (how much, how, what changed). Either way, the student has to word their own resume line, which is the exact thing they came for help with.
4. **A role can be saved with no lines.** The minimum path makes a resume with a job title and nothing under it, and nothing tells the student that's what happened.
5. **A checkbox on every screen.** "This is true, and it's in my own words" sits under the name and school the student just typed, and the Continue button stays grey until it's ticked, with no hint why. The resume import's confirm box has the same label, so a single tick can't mean "I checked every line".
6. **Internal words in the interface.** My facts, confirmed facts, fact, knockouts, Tailor, Application packet, Answer kit, proof link, evidence, strategy, BLOCKING, WARN, INFO, and "AI review: PASS". None of these is how a student talks.
7. **The job page hides its next step.** "Tailor my resume for this job" sits at the bottom of the sidebar under four cards. On a phone it's below the whole score breakdown.
8. **Too many equal choices at the finish line.** Once the resume passes, PDF and DOCX are small buttons next to Re-run review and Track with this resume, followed by a cover letter banner and a proof link card. Nothing says "this is the one to press".
9. **Unclear navigation.** Six items: Today, Find jobs, Jobs, My facts, Tracker, Settings. "Jobs" next to "Find jobs" doesn't say which is which, and "Today" doesn't say it's home.
10. **Dead ends and front-loaded questions.** The experience screen swaps its Continue button for grey text until a role is saved. "Where and when can you work" is asked up front even though it only powers warnings, and every warning already links to the question when it matters. My facts opens with a recall exercise and contact details before the student's own roles.

Smaller things seen on the way: the knockout panel spends four boxes saying "fine" when nothing is wrong, and skipping the paste step lands on Today with nothing new to do.

## What changed

**Signup to downloaded resume, after:** 6 screens and 9 clicks, and that count includes keeping two real resume lines. Landing (Get started), Sign up (Create account), About you (Save and continue), Your experience (Save and draft my lines, Keep, Keep, Continue), A job you want (Make my resume), Your resume (Download PDF). Before: 10 screens and 13 clicks with an empty role, about 21 clicks with two lines.

### Recommended lines (the addendum)

- `lib/resume/draft-bullets.ts` turns "what did you do there?" into 2 to 4 lines: drops "I" and "responsible for", sets the tense (past for a finished role, present for a current one, past kept for a finished result), leads with a result when the person named one, and never adds a number, result, or tool. Fewer than two duties means fewer lines, not padding.
- A line with no number gets one optional question ("About how many guests?"). Only the answer can add a number.
- `components/facts/draft-lines.tsx` shows each draft as a card: Keep, Edit, Drop. Keep and Edit call `keepLineAction` (`app/app/facts/draft-actions.ts`), which is the only way a draft becomes a confirmed fact. The server refuses a kept draft with a number the person never typed. Drop removes it from the page; nothing was saved. Kept lines can be undone. "Write my own line instead" stays available.
- Lines read from an uploaded resume show as the same cards, so each one is kept or dropped on its own.
- My experience has "Get recommended lines" on every role. The description is saved on the role (`experience.raw_notes`) so it can be drafted again; it never appears on a resume.

### Removed or merged (nothing deleted)

- Onboarding went from six screens to three. Projects merged into Your experience (Project is one of the kinds). Skills and licenses moved into "More details" on About you. "Where and when can you work" left the first run; every must-have the job page can't check links straight to it, and it returns you to the job.
- Phone, resume email, LinkedIn, website, city, state, GPA, honors, coursework, and extra schools sit in "More details (optional)". It opens on its own when anything in it is already filled, so nothing is saved unseen.
- The "This is true" checkbox is gone from screens where the person typed everything themselves; the save button says what saving means. Lines from an uploaded resume still need their own Keep or tick.
- The first pasted job opens straight on its resume, which builds and checks itself. Later jobs open on the fit score, with "Make my resume for this job" right under the score instead of at the bottom of the sidebar.
- The must-haves panel is one line when nothing is wrong.
- The resume screen has one big Download PDF button. "Check it again" appears only when downloads are locked. Tracking, cover letter and prep, and the share link moved under "What's next (optional)".
- My experience lists roles first. The task-card exercise moved from the top of the page to each role ("Ideas from similar roles"). Contact details fold into one line at the bottom. Adding a role uses the same screen as onboarding, so it gets recommended lines too.

Flagged for a later decision: `AddRole` in `components/facts/fact-list.tsx` and `linesForRoleForm`/`roleStepHint` in `components/onboarding/role-step.ts` are no longer used by any screen (the helpers keep their tests). They can be deleted once nobody wants the old blank-box role form back.

### Words replaced

| Before | After |
| --- | --- |
| My facts, facts, confirmed facts | My experience, what you confirmed |
| Knockouts, knockout | Must-haves, dealbreaker |
| Tailor (tab), Tailor my resume | Your resume, Make my resume for this job |
| Fit score (tab) | Your fit |
| Application packet | Cover letter and prep |
| Answer kit | Application answers |
| Proof link | Share link |
| BLOCKING, WARN, INFO | Must fix, Worth a look, Note |
| AI review: PASS or FAIL | Final read-through: passed or found lines to fix |
| Re-run review | Check it again |
| Review / Why this works / What I cut | Checks / Why each line / Left off |
| evidence | what you did, what to lead with |
| Today, Jobs, Tracker (nav) | Home, My jobs, Applications |

### Checks

Typecheck, lint, 1,327 tests in 98 files, and the production build pass. New tests: `lib/resume/draft-bullets.test.ts` (16, including no invented numbers on seven student descriptions) and `app/app/facts/draft-actions.test.ts` (5, including the server refusing a number the person never typed). `tests/site-copy.test.ts` now covers the facts, jobs, onboarding, tracker, packet, and settings components, and fails on any em dash in source, comments included. The few files that need to detect an em dash build it from its code point (`EM_DASH` in `lib/voice/rules.ts`).

Browser check on localhost with synthetic data and a local stand-in for the review model (not the real one): a fresh account went through all three screens, got drafts from a cashier description, answered the number question ("Answered about 40 phone calls a shift"), kept two, edited one, dropped one, pasted a posting, and landed on a finished resume with downloads on. PDF and DOCX both returned 200. At 375px the resume screen had no sideways scroll. Not walked in the browser: the resume-upload path through the new cards, and the experience step at 375px.
