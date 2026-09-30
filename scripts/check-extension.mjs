// Drives the unpacked extension in Chromium against synthetic job-site pages and a
// local dev server: signed out, connect, the badge on each site, the panel, a
// LinkedIn job switch without a reload, the unreadable fallback, and Open in Proofline.
//
//   node scripts/check-extension.mjs [--out .data/shots/extension] [--base http://localhost:3000]
//
// Needs `npm run dev` on localhost:3000 and `npm run extension:build` first (for the
// icons). Uses Playwright's own Chromium, because branded Chrome and Edge no longer
// load unpacked extensions from the command line. Signs in with the development login.
import { mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
const base = args.base ?? "http://localhost:3000";
const out = args.out ?? ".data/shots/extension";
const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const extension = join(root, "extension");
const fixture = (name) => readFileSync(join(root, "tests", "fixtures", "job-sites", name), "utf8");
mkdirSync(out, { recursive: true });

const PAGES = {
  "https://www.linkedin.com/jobs/search/": "linkedin-search.html",
  "https://www.linkedin.com/jobs/view/": "linkedin-guest.html",
  "https://www.indeed.com/viewjob": "indeed-viewjob.html",
  "https://www.indeed.com/jobs": "indeed-2026.html",
  "https://www.indeed.com/m/viewjob": "unreadable.html",
  "https://app.joinhandshake.com/jobs/": "handshake-job.html",
};

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "proofline-ext-")), {
  headless: true,
  channel: "chromium",
  viewport: { width: 1280, height: 860 },
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
// The first-install tab points at the live beta; keep this run local.
await context.route("https://proofline-beta.vercel.app/**", (route) => route.abort());
for (const host of ["https://www.linkedin.com/**", "https://www.indeed.com/**", "https://app.joinhandshake.com/**"]) {
  await context.route(host, (route) => {
    const url = route.request().url();
    const match = Object.keys(PAGES).find((prefix) => url.startsWith(prefix));
    if (match && route.request().resourceType() === "document") return route.fulfill({ contentType: "text/html", body: fixture(PAGES[match]) });
    return route.fulfill({ status: 404, body: "" });
  });
}

// Every posting the extension sends for scoring, to check what it read.
const sent = [];
await context.route(`${base}/api/extension/score`, (route) => {
  sent.push(JSON.parse(route.request().postData() || "{}"));
  return route.continue();
});

const problems = [];
const results = [];
const check = (ok, message) => {
  if (!ok) problems.push(message);
  return ok;
};

/** The badge lives in a closed shadow root, so read it the way assistive tech does. */
async function axNames(page) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  await cdp.detach();
  return nodes.filter((n) => !n.ignored).map((n) => ({ role: n.role?.value, name: n.name?.value ?? "", node: n.backendDOMNodeId }));
}

/** Everything the panel says, read from its dialog node down. */
async function panelText(page) {
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  await cdp.detach();
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));
  const dialog = nodes.find((n) => n.role?.value === "dialog");
  const text = [];
  const walk = (n) => {
    if (!n) return;
    if (n.role?.value === "StaticText") text.push(n.name?.value ?? "");
    for (const id of n.childIds ?? []) walk(byId.get(id));
  };
  walk(dialog);
  return text.join(" ");
}

/** Clicks the element with this accessible role and name, wherever it lives. */
async function clickAx(page, role, pattern) {
  const hit = (await axNames(page)).find((n) => n.role === role && pattern.test(n.name));
  if (!hit) return false;
  const cdp = await page.context().newCDPSession(page);
  const { model } = await cdp.send("DOM.getBoxModel", { backendNodeId: hit.node });
  await cdp.detach();
  const [x1, y1, , , x3, y3] = model.border;
  await page.mouse.click((x1 + x3) / 2, (y1 + y3) / 2);
  return true;
}

async function waitForBadge(page, pattern, timeout = 9000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const hit = (await axNames(page)).find((n) => n.role === "button" && pattern.test(n.name));
    if (hit) return { name: hit.name, ms: Date.now() - start };
    await page.waitForTimeout(100);
  }
  return null;
}

const pill = (page) => clickAx(page, "button", /^(Proofline|Sign in to Proofline)/);

// 1. Signed out.
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
await page.goto("https://www.linkedin.com/jobs/view/marketing-coordinator-at-northwind-4033333333/");
const signedOut = await waitForBadge(page, /Sign in to Proofline/);
check(signedOut, "Signed out: no 'Sign in to see your fit' badge");
await page.screenshot({ path: join(out, "signed-out.png") });
const [login] = await Promise.all([context.waitForEvent("page"), pill(page)]);
await login.waitForLoadState();
check(login.url().includes("/login?next=%2Fapp%2Fextension") || login.url().includes("/app/extension"), `Signed out: badge opened ${login.url()}`);
await login.close();

// 2. Connect, the way a person does: sign in, open the Connect page, press the button.
const app = await context.newPage();
await app.goto(`${base}/api/dev/login?next=/app/extension`);
await app.getByRole("button", { name: "Connect this browser" }).click();
check(await app.getByText("This browser is connected.").waitFor({ timeout: 8000 }).then(() => true, () => false), "Connect: the page never said connected");
await app.close();

// 3. The badge on each site, timed from navigation.
const SITES = [
  ["LinkedIn signed-in search", "https://www.linkedin.com/jobs/search/?currentJobId=4011111111&keywords=accounting", "linkedin"],
  ["LinkedIn public job page", "https://www.linkedin.com/jobs/view/marketing-coordinator-at-northwind-4033333333/", "linkedin-guest"],
  ["Indeed job page", "https://www.indeed.com/viewjob?jk=abc123def456", "indeed"],
  ["Indeed 2026 search pane", "https://www.indeed.com/jobs?q=staff+accountant&l=Raleigh%2C+NC&vjk=aaa111bbb222", "indeed-2026"],
  ["Handshake job page", "https://app.joinhandshake.com/jobs/9876543", "handshake"],
];
for (const [label, url, shot] of SITES) {
  const start = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const badge = await waitForBadge(page, /Proofline fit score \d+/);
  const ms = Date.now() - start;
  if (check(badge, `${label}: no score badge`)) {
    results.push(`${label}: "${badge.name}" in ${ms}ms`);
    check(ms < 2000, `${label}: score took ${ms}ms`);
  }
  await page.screenshot({ path: join(out, `${shot}-badge.png`) });
}

// 4. The panel, in order: knockouts, the math, then the deep link.
await page.goto(SITES[0][1]);
await waitForBadge(page, /Proofline fit score \d+/);
await pill(page);
await page.waitForTimeout(150);
const reading = await panelText(page);
const order = ["Knockout", "How the score adds up", "Open in Proofline"].map((text) => reading.indexOf(text));
check(order.every((i) => i >= 0) && order[0] < order[1] && order[1] < order[2], `Panel order wrong: ${order.join(", ")}`);
await page.screenshot({ path: join(out, "panel-light.png") });
await page.emulateMedia({ colorScheme: "dark" });
await page.screenshot({ path: join(out, "panel-dark.png") });
await page.emulateMedia({ colorScheme: "light" });
await page.keyboard.press("Escape");

// 5. LinkedIn switches jobs without a reload; the badge follows.
const before = (await waitForBadge(page, /Proofline fit score \d+/))?.name;
await page.getByText("Tax Associate Intern · Birch & Pine LLP").click();
const switchStart = Date.now();
let after = null;
while (Date.now() - switchStart < 5000) {
  await pill(page);
  await page.waitForTimeout(120);
  const text = await panelText(page);
  if (text.includes("Tax Associate Intern") && text.includes("Graduation date")) {
    after = (await axNames(page)).find((n) => /^\d+$/.test(n.name))?.name ?? "?";
    break;
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}
check(after, `LinkedIn switch: the panel never showed the new job and its knockout (before: ${before})`);
results.push(`LinkedIn switch: "${before}", then Tax Associate Intern with its graduation knockout (score ${after}) after ${Date.now() - switchStart}ms`);
await page.screenshot({ path: join(out, "linkedin-switch-panel.png") });
await page.keyboard.press("Escape");

// 6. A page that never shows a description gets the fallback, not a wrong score.
await page.goto("https://www.indeed.com/m/viewjob?jk=zzz999");
const unreadable = await waitForBadge(page, /couldn't read this posting/i, 10000);
check(unreadable, "Unreadable: no fallback badge");
await pill(page);
await page.waitForTimeout(150);
check((await axNames(page)).some((n) => n.name === "Paste it in Proofline"), "Unreadable: no paste fallback");
await page.screenshot({ path: join(out, "unreadable-panel.png") });

// What each site's badge read. Indeed's 2026 pane must stop at the description, before "Explore other jobs".
const pane = sent.find((p) => p.company === "Pinecrest Holdings");
check(pane && pane.title === "Staff Accountant" && pane.location === "Raleigh, NC", `Indeed 2026: read ${JSON.stringify(pane && { title: pane.title, company: pane.company, location: pane.location })}`);
check(pane && pane.description.startsWith("Record journal entries") && !pane.description.includes("Explore other jobs"), "Indeed 2026: description wrong or includes other jobs");
for (const p of sent) check(p.title && p.company && p.description.length >= 200, `Incomplete posting sent: ${JSON.stringify({ title: p.title, company: p.company })}`);
results.push(`Read: ${[...new Map(sent.map((p) => [p.title, `${p.title} · ${p.company} · ${p.location || "no place"} (${p.description.length} chars)`])).values()].join("; ")}`);

// Cache: a second visit asks Proofline nothing; visiting Proofline (where facts change) clears it.
const cacheUrl = SITES[2][1];
await page.goto(cacheUrl);
await waitForBadge(page, /Proofline fit score \d+/);
const beforeRevisit = sent.length;
await page.goto(cacheUrl);
const cached = await waitForBadge(page, /Proofline fit score \d+/);
check(cached && sent.length === beforeRevisit, `Cache: revisit sent ${sent.length - beforeRevisit} request(s)`);
results.push(`Cache: revisit answered in ${cached?.ms}ms with no request`);
const facts = await context.newPage();
await facts.goto(`${base}/app/facts`);
await facts.waitForTimeout(500);
await facts.close();
await page.goto(cacheUrl);
await waitForBadge(page, /Proofline fit score \d+/);
check(sent.length === beforeRevisit + 1, `Cache: after visiting Proofline, expected a fresh score request, saw ${sent.length - beforeRevisit}`);

// 7. Open in Proofline saves the job and opens its page.
await page.goto(SITES[2][1]);
await waitForBadge(page, /Proofline fit score \d+/);
await pill(page);
await page.waitForTimeout(150);
const [jobTab] = await Promise.all([context.waitForEvent("page", { timeout: 8000 }).catch(() => null), clickAx(page, "button", /^Open in Proofline$/)]);
if (!jobTab) results.push(`Open in Proofline: the panel said "${await panelText(page)}"`);
if (check(jobTab, "Open in Proofline: no tab opened")) {
  await jobTab.waitForLoadState();
  check(/\/app\/jobs\/[0-9a-f-]{36}/.test(jobTab.url()), `Open in Proofline opened ${jobTab.url()}`);
  results.push(`Open in Proofline: ${jobTab.url().replace(base, "")}`);
  await jobTab.screenshot({ path: join(out, "opened-job.png") });
}

check(!pageErrors.length, `Page errors: ${pageErrors.join("; ")}`);
await context.close();

console.log(results.join("\n"));
console.log(problems.length ? `\n${problems.length} problem(s):\n${problems.join("\n")}` : "\nAll extension checks passed.");
console.log(`Screenshots in ${out}`);
process.exit(problems.length ? 1 : 0);
