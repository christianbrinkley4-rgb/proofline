# Competitive landscape

Reviewed September 24, 2026 against each company's public product pages and the current Proofline code. Feature and scale numbers on vendor pages are claims, not independent results.

## Where other products are ahead

| Product | What it already does well | Proofline gap |
| --- | --- | --- |
| [Handshake](https://support.joinhandshake.com/hc/en-us/articles/38856960612631-About-AI-powered-features-in-Handshake-for-students) | For students, conversational job search, ranked recommendations from profile and activity, and a job-specific assistant that suggests profile and resume improvements. Its campus and employer relationships add a distribution channel Proofline does not have. | Our agent and fit breakdown are useful once a job is found, but we have fewer sources and little guided exploration for an undecided student. |
| [Jobright](https://jobright.ai/ai-job-match) | Personalized recommendations use resume, experience, seniority, goals, location, and pay; its match view explains skills and gaps. It claims a very large index, which we have not independently verified. | Our source inventory is smaller and concentrated in selected company boards and fields. We need a repeatable coverage and relevance benchmark. |
| [Simplify](https://help.simplify.jobs/articles/2415391-using-copilot-to-autofill-applications) | Browser extension reuses profile data and saved answers to autofill application forms and track applications. | Proofline prepares documents and answers but leaves form entry and tracker updates largely manual. |
| [Huntr](https://help.huntr.co/en/articles/14367332-application-hub-and-packets) | Application hub keeps tailored resumes, cover letters, and other files together; [its extension](https://help.huntr.co/en/articles/9859408-the-huntr-chrome-extension) captures jobs from browser pages. | Proofline has a grounded packet and tracker, but browser capture and reusable application workflow are missing. |
| [Teal](https://www.tealhq.com/tools/resume-builder) | Mature resume editor: imports from a resume or LinkedIn, drag-and-drop sections, many versions and templates, and live job-description checks. | Proofline offers three strategies and verified exports but less control over layout, sections, and live editing. |
| [Jobscan](https://www.jobscan.co/resume-scanner) | Detailed comparison of an existing resume against a posting, including formatting and keyword checks. It explicitly says its score is a scanner estimate, not an ATS score. | Proofline's scoring is for person-to-job evidence. It should also test the exact exported file against the posting and explain document-level issues. |
| [LinkedIn](https://www.linkedin.com/help/linkedin/answer/a6217425) and [Careerflow](https://www.careerflow.ai/faq) | LinkedIn has career insights and learning paths; Careerflow offers profile tools and interview practice as well as tracking. | Proofline has text interview prep, but limited career exploration, guided skill building, and practice. |

## What Proofline actually has

A living profile with confirmed source facts; resume import; editable experiences; natural-language live search; six-part fit breakdown; three per-job resume strategies; PDF and DOCX export checks; a grounded cover letter and application answers; interview story prep; a tracker with reminders and watched searches; an agent; and a bring-your-own-AI connector. Users submit applications themselves. Fit is an explanation of evidence against a posting. It is **not** the probability of an interview or offer.

The defensible difference is source traceability: users can see which facts support a recommendation or written claim, and exports reject unsupported claims. We have not measured whether this produces better hiring outcomes than the products above.

## Build priorities

1. **Prove search quality.** Benchmark the same student, career changer, and non-college searches across Proofline, Handshake, Jobright, and LinkedIn. Count relevant, fresh, unique, eligible roles, not raw listings. Expand sources based on measured misses.
2. **Help people choose a direction.** Ask what they have done and what they want from work, then show a short set of plausible role families with the evidence for each suggestion. Keep internships and first jobs prominent for students. Let users explore without already knowing job titles.
3. **Reduce form work.** Build a reviewable browser helper that captures postings, reuses confirmed answers, and prepares fields for the person to inspect before submission. Measure minutes saved and field errors on common ATS sites.
4. **Give concrete improvement plans.** Separate missing evidence from a missing skill or credential. Suggest a profile edit when the experience already exists; suggest a realistic project, course, credential, or experience when it does not. Avoid generic advice.
5. **Calibrate outcomes before giving odds.** Track applications, interviews, and offers with consent. Only show a probability when sample size and calibration support it; otherwise show fit, uncertainty, and actionable gaps. Never label a deterministic fit score as a hiring chance.
6. **Test document quality and interview practice.** Compare exact exported resumes and cover letters against competitors on readability, truthfulness, relevance, and time to apply. Add interactive practice if users find it useful.

The first four priorities matter for the student product and also make it usable by someone without a degree or with years of work. Student needs remain the default in examples and discovery; education is optional unless a particular job requires it.
