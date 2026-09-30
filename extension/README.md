# Proofline browser extension

A Manifest V3 extension for Chrome and Edge. On LinkedIn, Indeed, and Handshake job postings it shows the person's fit score in a small badge. From the toolbar popup a person can save the posting they're viewing, fill an application's basic fields from their Proofline profile, and mark the job Applied. It outlines every field it fills and never submits a form.

## The fit badge

`sites.js` is the only script that runs on job sites (`www.linkedin.com`, `*.indeed.com`, `*.joinhandshake.com`). It acts only on job pages: LinkedIn `/jobs/...` (a posting or the search pane with `currentJobId`), Indeed `viewjob` and search results with a selected job (`jk`/`vjk`), and Handshake `/jobs/<id>` or `/job-search/<id>`. LinkedIn is matched site-wide because it moves to Jobs without reloading the page; off `/jobs` the script does nothing.

- It reads the title, company, location, and description, each from several selectors (newest first), then the block under a heading like "About the job", then the page's JobPosting data. If it still can't find a title and 200 characters of description after 6 seconds, the badge says "Couldn't read this posting" and offers to paste it into Proofline. It never throws on the page.
- It reads once when the page loads, then after the page settles (300ms quiet, at most 1.2s), and scores again only when a different job opens. A cheap look at the address, title, and description size decides that without laying out the page, so scrolling or a list loading more results doesn't trigger a request. On live LinkedIn search, 25 seconds of scrolling and five job switches cost 17ms of the extension's own script.
- `background.js` makes the request (`POST /api/extension/score`, 150 per account per 10 minutes), so the token never enters the job site's page, and caches each job's score for the browser session for up to 15 minutes. `connect.js` runs on every Proofline app page and tells the worker whenever you open or leave one, which drops cached scores, since that's where facts change; coming back to a job tab asks again. Connecting a new account clears the cache too.
- The score comes from `lib/extension/score.ts`, which calls the same `scoreFit` and `checkKnockouts` as a saved job and stores nothing. "Open in Proofline" is the only thing that saves the posting (through `/api/extension/jobs`), then opens its job page.
- Signed out (no token, or a revoked one), the badge says "Sign in to see your fit" and opens `/login?next=/app/extension`.
- The badge and panel live in a closed shadow root with the design tokens copied in, and follow the device's light or dark setting.

Selectors are checked against the synthetic pages in `tests/fixtures/job-sites/` by `node scripts/check-extension.mjs` (needs `npm run dev`). Indeed's 2026 layout (`vj-job-title`, `company-info-metadata`, the "Full job description" heading) and LinkedIn's public job pages were checked live on September 29. These sites change often, so rerun the check and look at a live page after a redesign.

## How it connects

1. The person opens `/app/extension` while signed in. `connect.js` (a content script on Proofline's app pages) tells the page the extension is installed.
2. Connect this browser calls `connectExtensionAction`, which creates a personal access token named "Browser extension" (at most three browsers; connecting a fourth retires the oldest).
3. The page hands the token to `connect.js`, which passes it to `background.js`. The background worker accepts it only from Proofline's own origins and stores it in `chrome.storage.local`. The token is never shown on screen.
4. The popup calls `/api/extension/profile`, `/api/extension/jobs`, and `/api/extension/applied` with that token. Disconnect all on the Connect page revokes every browser's token.

The extension can send requests only to the origins in `host_permissions` (the beta and `localhost:3000`). Beyond the three job sites' postings, it reads a page only when the person clicks an action in the popup (`activeTab`). `storage` holds the connection and the session score cache; `scripting` runs the popup's save and fill actions on the tab the person clicked it on.

## What autofill will and won't do

`page-scripts.js` fills empty, visible text fields whose label matches a known field: name, email, phone, city and state, LinkedIn, website, school, degree, major, GPA, and graduation date. It skips work authorization, demographic, salary, referral, and similar questions, fields that name someone else (a reference, a manager) or a company, and anything already filled. Forms inside a cross-site frame aren't reachable; the popup says so.

## Develop

- Load `extension/` unpacked from `chrome://extensions` with Developer mode on. Tick "Use a local dev server" in the popup to connect to `localhost:3000`.
- Manual form check: serve `tests/fixtures/extension-form.html`, run `page-scripts.js` in its console, call `extractPosting()` and `fillForm(profile)`. Expect 7 fields filled and the company, employer, GitHub, sponsorship, gender, prefilled, and hidden fields left alone.
- After changing anything here, run `npm run extension:build`. It renders the icons from `app/icon.svg` and rebuilds `public/proofline-extension.zip`, which the Connect page offers for download.

## Not done yet

Publishing to the Chrome Web Store is the owner's call; the listing copy and screenshots are in `docs/extension-store/`. Until then, testers install it unpacked from the zip. Firefox isn't supported yet.
