// The Chrome Web Store screenshots (1280 by 800), taken with the real extension on a
// made-up posting (docs/extension-store/source/posting.html), so no real employer or
// job site's branding appears in the listing.
//
//   node scripts/store-screenshots.mjs [--base http://localhost:3000]
//
// Needs `npm run dev` on localhost:3000 and `npm run extension:build` first. The score
// comes from the development login's synthetic profile.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
const base = args.base ?? "http://localhost:3000";
const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const out = join(root, "docs", "extension-store");
const extension = join(root, "extension");
const posting = readFileSync(join(out, "source", "posting.html"), "utf8");

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "proofline-store-")), {
  headless: true,
  channel: "chromium",
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
});
await context.route("https://proofline-beta.vercel.app/**", (route) => route.abort());
// The badge runs only on the three job sites, so the made-up page is served at a job-site address.
await context.route("https://www.indeed.com/**", (route) =>
  route.request().resourceType() === "document" ? route.fulfill({ contentType: "text/html", body: posting }) : route.fulfill({ status: 404, body: "" }),
);

const page = await context.newPage();

async function badge(pattern) {
  for (let i = 0; i < 60; i += 1) {
    const cdp = await context.newCDPSession(page);
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    await cdp.detach();
    const hit = nodes.find((n) => !n.ignored && n.role?.value === "button" && pattern.test(n.name?.value ?? ""));
    if (hit) return hit;
    await page.waitForTimeout(100);
  }
  throw new Error(`No badge matching ${pattern}`);
}

async function open(url, pattern) {
  await page.goto(url);
  const hit = await badge(pattern);
  await page.waitForTimeout(300);
  return hit;
}

async function click(hit) {
  const cdp = await context.newCDPSession(page);
  const { model } = await cdp.send("DOM.getBoxModel", { backendNodeId: hit.backendDOMNodeId });
  await cdp.detach();
  const [x1, y1, , , x3, y3] = model.border;
  await page.mouse.click((x1 + x3) / 2, (y1 + y3) / 2);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(300);
}

const FIT = "https://www.indeed.com/viewjob?jk=cedar1&job=fit";
const KNOCKOUT = "https://www.indeed.com/viewjob?jk=lindgren1&job=knockout";

await open(FIT, /Sign in to Proofline/);
await page.screenshot({ path: join(out, "4-signed-out.png") });

const app = await context.newPage();
await app.goto(`${base}/api/dev/login?next=/app/extension`);
await app.getByRole("button", { name: "Connect this browser" }).click();
await app.getByText("This browser is connected.").waitFor({ timeout: 8000 });
await app.close();

const fit = await open(FIT, /Proofline fit score \d+/);
await page.screenshot({ path: join(out, "1-badge.png") });
await click(fit);
await page.screenshot({ path: join(out, "2-panel.png") });
await page.emulateMedia({ colorScheme: "dark" });
await page.screenshot({ path: join(out, "5-panel-dark.png") });
await page.emulateMedia({ colorScheme: "light" });

await click(await open(KNOCKOUT, /Proofline fit score \d+/));
await page.screenshot({ path: join(out, "3-knockout.png") });

await context.close();
for (const old of ["3-signed-out.png", "4-panel-dark.png"]) rmSync(join(out, old), { force: true });
console.log(`Store screenshots saved to ${out}`);
