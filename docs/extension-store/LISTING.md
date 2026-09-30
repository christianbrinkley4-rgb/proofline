# Chrome Web Store listing (draft)

Publishing is the owner's decision. This is the copy to paste when that happens. The same text works for the Edge Add-ons store; the extension passes the full check in Microsoft Edge 154 (`node scripts/check-extension.mjs --browser edge`).

## Name

Proofline

## Summary (132 characters max)

Your fit score on LinkedIn, Indeed, and Handshake jobs, from facts you confirmed in Proofline. Save jobs and fill basic fields.

## Category

Productivity

## Description

Open a job on LinkedIn, Indeed, or Handshake and Proofline shows your fit score right on the page. Click it to see:

- Knockouts first: a graduation window you're outside of, work authorization, location, or a start date that doesn't work. These are shown on their own and never hidden inside the score.
- How the score adds up: required skills, experience, education, preferred skills, the posting's keywords, and location, each with the arithmetic.
- Open in Proofline: saves the job to your account and opens the full breakdown and a resume tailored to it.

From the toolbar button you can also save any posting, fill your name, contact details, school, and degree into an application form, and mark a job Applied on your tracker. Every field it fills is outlined so you can check it. It never submits a form for you.

What it reads, and what it doesn't:

- On LinkedIn, Indeed, and Handshake it reads only the job posting on screen: the title, company, location, and description.
- It never reads your messages, your profile on those sites, or your other tabs.
- Your score is worked out from facts you already confirmed in Proofline. Nothing new is collected, and postings you only look at aren't stored.
- On other sites it does nothing until you click the toolbar button.

You need a Proofline account. The fit score compares your confirmed facts with what the posting asks for. It isn't a prediction of whether you'll be hired.

## Permission justifications

- Host access to www.linkedin.com, indeed.com, and joinhandshake.com: to read the job posting on screen and show the fit badge. It acts only on job pages.
- activeTab: to save a posting or fill a form on the tab where you click the toolbar button.
- scripting: to run that save or fill action on that tab.
- storage: to keep this browser's connection to your Proofline account, and each job's score for the rest of your browsing session.
- Host access to proofline-beta.vercel.app: to send the posting to your Proofline account for scoring.

## Single purpose

Help job seekers judge and apply to postings using facts they confirmed in their Proofline account.

## Data use disclosures

- Collects: website content (the job posting text on LinkedIn, Indeed, and Handshake job pages), sent to Proofline to compute a score. Not stored unless the person saves the job.
- Does not sell data, use it for credit or lending, or use it for anything unrelated to the extension's purpose.

## Privacy policy URL

https://proofline-beta.vercel.app/privacy (its "Browser extension" section covers what the extension reads).

## Screenshots (1280 by 800, in this folder)

1. `1-badge.png`: a job posting with the badge showing a score.
2. `2-panel.png`: the open panel: knockouts, then the score math, then Open in Proofline.
3. `3-knockout.png`: a posting for 2026 graduates, with the graduation knockout listed first.
4. `4-signed-out.png`: the "Sign in to see your fit" badge.
5. `5-panel-dark.png`: the panel following the device's dark mode.

They use the real extension on a made-up posting (`source/posting.html`): fictional employers, and a plain layout with no real job site's name or branding. Scores come from a synthetic development profile. Retake them with `node scripts/store-screenshots.mjs` (needs `npm run dev`) after changing the badge or panel.
