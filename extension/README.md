# Proofline browser extension

A Manifest V3 extension for Chrome and Edge. From the toolbar popup a person can save the posting they're viewing, fill an application's basic fields from their Proofline profile, and mark the job Applied. It outlines every field it fills and never submits a form.

## How it connects

1. The person opens `/app/extension` while signed in. `connect.js` (a content script on that page only) tells the page the extension is installed.
2. Connect this browser calls `connectExtensionAction`, which creates a personal access token named "Browser extension" (at most three browsers; connecting a fourth retires the oldest).
3. The page hands the token to `connect.js`, which passes it to `background.js`. The background worker accepts it only from Proofline's own origins and stores it in `chrome.storage.local`. The token is never shown on screen.
4. The popup calls `/api/extension/profile`, `/api/extension/jobs`, and `/api/extension/applied` with that token. Disconnect all on the Connect page revokes every browser's token.

The extension can reach only the origins in `host_permissions` (the beta and `localhost:3000`). It reads a job site only when the person clicks an action in the popup (`activeTab`).

## What autofill will and won't do

`page-scripts.js` fills empty, visible text fields whose label matches a known field: name, email, phone, city and state, LinkedIn, website, school, degree, major, GPA, and graduation date. It skips work authorization, demographic, salary, referral, and similar questions, fields that name someone else (a reference, a manager) or a company, and anything already filled. Forms inside a cross-site frame aren't reachable; the popup says so.

## Develop

- Load `extension/` unpacked from `chrome://extensions` with Developer mode on. Tick "Use a local dev server" in the popup to connect to `localhost:3000`.
- Manual form check: serve `tests/fixtures/extension-form.html`, run `page-scripts.js` in its console, call `extractPosting()` and `fillForm(profile)`. Expect 7 fields filled and the company, employer, GitHub, sponsorship, gender, prefilled, and hidden fields left alone.
- After changing anything here, run `npm run extension:build`. It renders the icons from `app/icon.svg` and rebuilds `public/proofline-extension.zip`, which the Connect page offers for download.

## Not done yet

Publishing to the Chrome Web Store is the owner's call. Until then, testers install it unpacked from the zip.
