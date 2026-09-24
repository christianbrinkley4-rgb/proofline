# Resume standards

The rules Proofline's templates, bullet scorer, and quality gate enforce, and the evidence behind each one. When a rule changes, change it here first, then in `lib/resume/`.

## What recruiters actually do

- **They skim first.** Ladders' 2018 eye-tracking study measured an average initial screen of 7.4 seconds. Recruiters looked at current title and company, then the previous one, then dates on the right, then education. Resumes with simple layouts, clear headings, bold titles, and bulleted accomplishments held attention. Clutter, multiple columns, missing headers, and long sentences lost it.
- **Skills and evidence beat grades.** NACE's 2026 Job Outlook reports only 42% of employers plan to screen on GPA, down from 73% in 2019. About 70% use skills-based hiring for entry-level roles. Between two equal candidates, employers overwhelmingly pick the one with internship experience. Teamwork, problem-solving, and communication top the list, shown through examples.
- **They spot AI writing.** In 2026 surveys, about half of hiring managers say unnatural phrasing gives AI resumes away. Other tells: corporate buzzwords, every bullet built the same way, and suspiciously round numbers.

## Page and layout

| Rule | Standard | Why |
|---|---|---|
| Length | One page for students and new grads | Career centers agree. The skim is 7 seconds. |
| Columns | Single column | Parses reliably everywhere. Multi-column layouts lost recruiter attention in eye-tracking. |
| Tables, text boxes, graphics, photos | None | ATS parsers read left to right and scramble tables. Photos are not expected in the US. |
| Headers and footers | Keep contact info in the body | Some ATS skip header and footer regions. |
| Fonts | One family, standard (Arial/Helvetica, Calibri, Georgia, Times New Roman, Garamond) | Renders and parses everywhere. |
| Body size | 10.5 to 12 pt; name 14 to 20 pt | Career center guidance; no more than two sizes besides the name. |
| Margins | 0.5 to 1 in | Below 0.5 in looks crammed. |
| File | Text-based PDF by default, DOCX when a portal asks | Workday, Greenhouse, Lever, Ashby, and iCIMS parse text PDFs as well as DOCX, and PDF keeps formatting intact. |
| Order | Reverse chronological | Matches the recruiter's scan path. |

## Sections

For students and grads within about a year of graduation:

1. **Header:** name, city and state, email, phone, LinkedIn, and a portfolio or GitHub for technical roles.
2. **Education** first: school, degree and major, expected graduation, GPA if 3.0 or higher, honors, relevant coursework only when experience is thin. For accounting: note "150-credit requirement on track" or "CPA eligible" only when true.
3. **Experience:** reverse chronological.
4. **Leadership and activities** or **Projects:** clubs, case competitions, research, technical projects.
5. **Skills:** grouped by type (Technical, Tools, Languages, Certifications). No skill bars or self-ratings.

No objective statement. A summary is optional and usually wasted space for students.

## Bullets

Each bullet is a phrase, not a sentence, and earns its place.

| Rule | Standard |
|---|---|
| Structure | Result, measure, and method. Google's X-Y-Z: "Accomplished X as measured by Y by doing Z." Harvard calls it action plus context plus result. |
| Opener | A strong past-tense action verb (present tense allowed for a current role, used consistently). Never "Responsible for," "Helped," "Worked on," "Ran," "Made." |
| Length | One to two lines. Roughly 70 to 200 characters. |
| Count | 3 to 5 for the most relevant or recent role, 1 to 3 for older ones. |
| Numbers | Real and specific. Every number must be defensible in an interview. Avoid invented round numbers. |
| Voice | No pronouns (I, my, we), no filler, no buzzwords, no passive voice, no em dashes. |
| Variety | No action verb more than twice on a page. Not every bullet in the same shape. |
| Relevance | Ordered by relevance to the target job, most relevant first within each role. |

## Templates we ship

Only templates that pass every rule above. Both are single column with standard headings, text-based PDF plus DOCX, and one page.

1. **Classic**: serif (Times/Garamond family), centered name, small-caps section headings with a hairline rule. Based on the Harvard career-services format. Default for accounting, finance, consulting, and business.
2. **Technical**: sans (Helvetica/Arial family), left-aligned header with links, bold organization, right-aligned dates, italic role and location. Based on "Jake's Resume," the most recommended template in student software-engineering communities. Default for tech roles.

We don't ship creative, multi-column, or graphic templates. They look good in builders and do worse with both parsers and recruiters.

## How Proofline applies this

- `lib/resume/verbs.ts`: action verb library by category, plus weak and overused openers.
- `lib/resume/bullet-score.ts`: scores every bullet 0 to 100 against the table above, with a reason for each point lost.
- `lib/resume/templates.ts`: the two templates as layout specs.
- `lib/resume/layout.ts`: measures text with real font metrics so "one page" is exact, not a guess, and cuts the weakest bullets when content overflows.
- `lib/voice/rules.ts`: em dashes, filler, weak openers, and the resume buzzwords recruiters complain about most (results-oriented, detail-oriented, team player, hard-working, proven track record). Shared with the export quality gate.
- `lib/resume/polish.ts`: fixes that change form, never claims. Tailoring puts past roles in past tense ("Manage" to "Managed"), tidies spacing and capitals, merges repeated skills ("Excel (pivot tables, XLOOKUP)" and "Excel (pivot tables, VLOOKUP)"), and keeps soft skills off the Skills line so bullets prove them instead.
- `lib/resume/quality.ts`: the quality gate. Blocking: every line traces to a confirmed fact, and it fits one page. Warnings, shown as "N of 12 checks passed" on every tailored resume: action-verb openers, varied verbs, no em dashes, plain language, no pronouns, email and phone and LinkedIn in the header, at least half the bullets carry a number, consistent tense, proofreading (doubled words, stray spacing, lowercase starts, unclosed parentheses, a skill listed twice), and how many of the posting's requirements the page visibly shows.
- `lib/fit/gaps.ts`: the requirements a page doesn't show become questions; answers become confirmed facts and new bullets.

### Deliberate choices against common advice

- **No summary for students.** Popular advice says a 40 to 60 word summary helps. Harvard's student format has none, and for a candidate with under two years of experience the space does more work as one more quantified bullet. A summary may come later for experienced users.
- **Keyword mirroring only where true.** "Copy the posting's exact words" is right when the student has done the thing. The keyword-match version uses the posting's terms for confirmed skills; it never adds a term the student hasn't backed.
- **ATS statistics.** Claims like "ATS can't read columns" and "99% of Fortune 500 companies auto-reject" are overstated: modern parsers read most single-column PDFs and humans still make most decisions. The single-column, standard-heading rules stand because they are safe everywhere, not because of those figures.

## Sources

- [Harvard FAS: Create a strong resume](https://careerservices.fas.harvard.edu/resources/create-a-strong-resume)
- [Teal on the X-Y-Z formula](https://www.tealhq.com/post/xyz-resume), [Inc. on Google recruiters' tips](https://www.inc.com/bill-murphy-jr/google-recruiters-say-these-5-resume-tips-including-x-y-z-formula-will-improve-your-odds-of-getting-hired-at-google.html)
- [Ladders 2018 eye-tracking study](https://www.theladders.com/static/images/basicSite/pdfs/TheLadders-EyeTracking-StudyC2.pdf), [HR Dive summary](https://www.hrdive.com/news/eye-tracking-study-shows-recruiters-look-at-resumes-for-7-seconds/541582/)
- [Jobscan on tables and columns](https://www.jobscan.co/blog/resume-tables-columns-ats/), [RecruitBPM on columns](https://recruitbpm.com/blog/resume-columns-and-ats-compatibility)
- [Jake's Resume on Overleaf](https://www.overleaf.com/latex/templates/jakes-resume/syzfjbzwjncs)
- [UCLA formatting checklist](https://career.ucla.edu/resources/resume-formatting-tips-checklist/), [USC format guidelines](https://careers.usc.edu/resources/resume-format-guidelines/), [Georgetown formatting tips](https://careercenter.georgetown.edu/major-career-guides/resumes-cover-letters/resume-formatting-tips/)
- [NACE 2026 Job Outlook](https://www.naceweb.org/research/reports/job-outlook/2026/), [UF summary of NACE 2026](https://careerhub.ufl.edu/blog/2026/06/30/breaking-down-the-data-2026-nace-job-outlook-spring-update/), [NACE on internships](https://www.naceweb.org/talent-acquisition/candidate-selection/internship-experience-often-the-deciding-factor-between-equal-candidates)
- [Prosple on Big 4 tax and audit](https://prosple.com/applying/big-4-tax-audit-how-to-break-in-as-a-student), [Enhancv Big 4 auditor examples](https://enhancv.com/resume-examples/big-4-auditor/)
- [Resume Geni on AI detection](https://resumegeni.com/blog/how-employers-detect-ai-generated-resumes-2026), [ResuFit survey summary](https://resufit.com/blog/can-recruiters-tell-if-you-used-ai-to-write-your-resume/)
