// Drives the unpacked extension's own popup code against synthetic Greenhouse and Lever
// application pages, with a real answer kit from the local dev server: the Greenhouse form
// sits in a cross-origin frame the way company career sites embed it. Checks the fill reaches
// the frame, the review panel appears on the page, nothing is submitted, and "I submitted it"
// keeps the kit as what was sent.
//
//   node scripts/check-kit-extension.mjs --job <job id on the dev account> [--base http://localhost:3000] [--out .data/shots/kit-extension]
//
// Needs `npm run dev`. Signs in with the development login and connects like a person does.
// The popup is opened as a tab and pointed at the job tab, because a headless browser can't
// click the toolbar button; everything after that is the popup's own code.
import { mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
const base = args.base ?? "http://localhost:3000";
const out = args.out ?? ".data/shots/kit-extension";
const jobId = args.job;
if (!jobId) throw new Error("Pass --job <id> for a job on the development account.");
const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const fixture = (name) => readFileSync(join(root, "tests", "fixtures", "application-forms", name), "utf8");
mkdirSync(out, { recursive: true });

const GH_PAGE = "https://boards.greenhouse.io/northwind/jobs/5550001";
const GH_FRAME = "https://job-boards.greenhouse.io/embed/job_app?for=northwind&token=5550001";
const LEVER_PAGE = "https://jobs.lever.co/northwind/0b0c0d0e-0000-4000-8000-000000000001/apply";
const WRAPPER = `<!doctype html><html><head><meta charset="utf-8"><title>Tax Intern at Northwind Tax</title></head>
<body style="font:15px system-ui;margin:0"><header style="padding:16px 24px;border-bottom:1px solid #ddd"><b>Northwind Tax careers</b></header>
<main style="padding:0 24px"><h1>Tax Intern</h1><iframe id="grnhse_iframe" src="${GH_FRAME}" style="width:100%;height:1900px;border:0"></iframe></main></body></html>`;

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "proofline-kit-")), {
  channel: "chromium",
  headless: true,
  viewport: { width: 1280, height: 860 },
  args: [`--disable-extensions-except=${join(root, "extension")}`, `--load-extension=${join(root, "extension")}`, "--no-first-run"],
});
await context.route("https://proofline-beta.vercel.app/**", (route) => route.abort());
const posts = [];
for (const [host, pages] of [
  ["https://boards.greenhouse.io/**", { [GH_PAGE]: WRAPPER }],
  ["https://job-boards.greenhouse.io/**", { [GH_FRAME]: fixture("greenhouse-apply.html") }],
  ["https://jobs.lever.co/**", { [LEVER_PAGE]: fixture("lever-apply.html") }],
]) {
  await context.route(host, (route) => {
    const request = route.request();
    if (request.method() !== "GET") {
      posts.push(request.url());
      return route.abort();
    }
    const body = pages[request.url()];
    return body ? route.fulfill({ contentType: "text/html", body }) : route.fulfill({ status: 404, body: "" });
  });
}

const problems = [];
const check = (ok, message) => {
  if (!ok) problems.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

// Connect, the way a person does.
const app = await context.newPage();
await app.goto(`${base}/api/dev/login?next=/app/extension`);
await app.getByRole("button", { name: "Connect this browser" }).click();
check(await app.getByText("This browser is connected.").waitFor({ timeout: 8000 }).then(() => true, () => false), "Connected this browser");
await app.close();

let worker = context.serviceWorkers()[0];
if (!worker) worker = await context.waitForEvent("serviceworker");
const extensionId = new URL(worker.url()).host;

async function fillFromPopup(pageUrl) {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  const status = await popup.evaluate(async ([pageUrl, jobId]) => {
    const [target] = await chrome.tabs.query({ url: pageUrl.split("?")[0] + "*" });
    tab = target;
    const jobs = (await chrome.storage.local.get("jobs")).jobs || {};
    jobs[target.url] = jobId;
    await chrome.storage.local.set({ jobs });
    await onFill();
    return document.getElementById("status").textContent;
  }, [pageUrl, jobId]);
  return { popup, status };
}

// Greenhouse, with the form in a cross-origin frame.
const gh = await context.newPage();
await gh.goto(GH_PAGE);
const frame = gh.frameLocator("#grnhse_iframe");
await frame.locator("#first_name").waitFor();
const ghRun = await fillFromPopup(GH_PAGE);
console.log(`  popup said: ${ghRun.status}`);
await ghRun.popup.close();
await gh.bringToFront();
await gh.waitForTimeout(300);
const inFrame = await frame.locator("body").evaluate(() => ({
  first: document.getElementById("first_name").value,
  email: document.getElementById("email").value,
  pronouns: document.getElementById("question_3").value,
  submitted: window.__submitted,
  outlined: document.querySelectorAll("[data-proofline-filled]").length,
}));
check(/^Filled \d+ fields? from your answer kit/.test(ghRun.status), "Greenhouse: popup reports a fill from the answer kit");
check(inFrame.first.length > 0 && inFrame.email.length >= 0 && inFrame.outlined > 0, `Greenhouse: fields filled inside the embedded frame (${inFrame.outlined} outlined)`);
check(inFrame.pronouns === "", "Greenhouse: pronouns untouched");
check(await gh.locator("proofline-review").count() === 1, "Greenhouse: the review panel is on the page, outside the frame");
check(inFrame.submitted === false, "Greenhouse: nothing submitted");
await gh.screenshot({ path: join(out, "greenhouse-embedded.png") });

// Lever, then "I submitted it".
const lever = await context.newPage();
await lever.goto(LEVER_PAGE);
const leverRun = await fillFromPopup(LEVER_PAGE);
console.log(`  popup said: ${leverRun.status}`);
const leverState = await lever.evaluate(() => ({ name: document.querySelector("input[name=name]").value, submitted: window.__submitted }));
check(leverState.name.length > 0 && !leverState.submitted, "Lever: filled and not submitted");
check(await lever.locator("proofline-review").count() === 1, "Lever: review panel shown");
await lever.screenshot({ path: join(out, "lever.png") });
const applied = await leverRun.popup.evaluate(async () => {
  await onApplied();
  return document.getElementById("status").textContent;
});
console.log(`  popup said: ${applied}`);
await leverRun.popup.setViewportSize({ width: 360, height: 520 });
await leverRun.popup.screenshot({ path: join(out, "popup.png") });
check(/saved the answer kit you filled from as what you sent|already|Marked Applied/.test(applied), "Lever: I submitted it marks Applied and keeps the kit");
check(posts.length === 0, `No request was sent to the employer's site (${posts.length})`);

await context.close();
console.log(problems.length ? `\n${problems.length} failed.` : `\nAll checks passed. Screenshots in ${out}.`);
process.exit(problems.length ? 1 : 0);
