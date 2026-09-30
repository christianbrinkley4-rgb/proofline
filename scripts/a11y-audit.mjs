// Accessibility audit of every Proofline page: axe-core (WCAG 2.1 A and AA),
// keyboard focus visibility, small tap targets, and horizontal overflow, in
// light and dark, desktop and phone.
//
//   node scripts/a11y-audit.mjs [--routes /,/app] [--themes light,dark] [--sizes desktop,phone,narrow] [--json out.json]
//
// "narrow" is 320px wide, the reflow width in WCAG 1.4.10 (400% zoom on a 1280px screen).
//
// Needs `npm run dev` on localhost:3000 and a local Chrome or Edge. Signs in with the
// development login and finds a real job, resume, and guide to open, so run
// /api/dev/seed and add one job first. Exits 1 if anything is found.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
const base = args.base ?? "http://localhost:3000";
const themes = (args.themes ?? "light,dark").split(",");
const SIZES = { desktop: { width: 1280, height: 860 }, phone: { width: 375, height: 812 }, narrow: { width: 320, height: 640 } };
const sizes = (args.sizes ?? "desktop,phone").split(",");

const PUBLIC = ["/", "/check", "/login", "/signup", "/forgot-password", "/privacy", "/contact", "/guides"];
const SIGNED_IN = ["/app", "/app/find", "/app/jobs", "/app/facts", "/app/facts/linkedin", "/app/tracker", "/app/settings", "/app/extension", "/app/onboarding", "/app/resumes"];

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].filter(Boolean);

async function launch() {
  for (const path of CANDIDATES) {
    try {
      return await chromium.launch({ executablePath: path });
    } catch {}
  }
  throw new Error("No Chrome or Edge found. Set CHROME_PATH.");
}

/** Pages whose address depends on this account's data. */
async function discover(page) {
  const found = [];
  const firstHref = async (route, pattern) => {
    await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    return hrefs.find((href) => href && pattern.test(href)) ?? null;
  };
  const job = await firstHref("/app/jobs", /^\/app\/jobs\/[0-9a-f-]{36}$/);
  if (job) found.push(job, `${job}/kit`, `${job}/packet`);
  const resume = await firstHref("/app/resumes", /^\/app\/resumes\/[0-9a-f-]{36}$/);
  if (resume) found.push(resume);
  const guide = await firstHref("/guides", /^\/guides\/[a-z0-9-]+$/);
  if (guide) found.push(guide);
  return found;
}

async function audit(page) {
  await page.addScriptTag({ content: AXE });
  const axe = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } });
    return result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 6).map((n) => ({ target: n.target.join(" "), summary: n.failureSummary?.split("\n").slice(0, 3).join(" ") })) }));
  });
  const extra = await page.evaluate(() => {
    const out = { overflow: document.documentElement.scrollWidth - window.innerWidth, smallTargets: [] };
    for (const el of document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=checkbox], [role=switch]")) {
      const style = getComputedStyle(el);
      // Visually hidden until focused (the skip link), so there is nothing to tap yet.
      if (style.clip === "rect(0px, 0px, 0px, 0px)" || style.clipPath === "inset(50%)") {
        if (el.tagName !== "INPUT") continue;
      }
      // A checkbox or radio inside its label is tapped anywhere on the label.
      const target = el.tagName === "INPUT" && el.closest("label") ? el.closest("label") : el;
      const r = target.getBoundingClientRect();
      if (!r.width || !r.height || style.visibility === "hidden") continue;
      // Links inside a sentence are exempt (WCAG 2.5.8 inline exception).
      if (el.tagName === "A" && style.display === "inline" && el.parentElement && /\S/.test((el.parentElement.textContent ?? "").replace(el.textContent ?? "", ""))) continue;
      if (r.width < 24 || r.height < 24) out.smallTargets.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || "").trim().slice(0, 40)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
  // Keyboard: every tab stop must show a visible change when focused.
  const unfocused = [];
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null));
  const seen = new Set();
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      // The Next.js dev overlay is not part of the product.
      if (el.tagName.toLowerCase() === "nextjs-portal") return { label: "dev overlay", ring: true, key: "dev-overlay" };
      const s = getComputedStyle(el);
      let ring = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none");
      if (!ring) {
        // A wrapper can draw the ring with :focus-within; compare it focused and blurred.
        const chain = [];
        for (let a = el.parentElement, i = 0; a && i < 3; a = a.parentElement, i++) chain.push(a);
        const look = () => chain.map((a) => { const cs = getComputedStyle(a); return `${cs.boxShadow}|${cs.borderColor}|${cs.outlineStyle}`; }).join(";");
        const focused = look();
        el.blur();
        const blurred = look();
        el.focus();
        ring = focused !== blurred;
      }
      const label = `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || el.getAttribute("name") || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 40)}"`;
      const r = el.getBoundingClientRect();
      return { label, ring, key: `${label}@${Math.round(r.x)},${Math.round(r.y + window.scrollY)}` };
    });
    if (!info) break;
    if (seen.has(info.key)) break;
    seen.add(info.key);
    if (!info.ring) unfocused.push(info.label);
  }
  return { axe, ...extra, unfocused, tabStops: seen.size };
}

const browser = await launch();
const report = [];
const only = args.routes ? args.routes.split(",") : null;
let signedInRoutes = null;
// Public pages signed out (the sign-in pages redirect a signed-in visitor), app pages signed in.
for (const theme of themes) {
  for (const sizeName of sizes) {
    for (const signedIn of [false, true]) {
    const context = await browser.newContext({ viewport: SIZES[sizeName], colorScheme: theme === "dark" ? "dark" : "light", reducedMotion: "reduce" });
    await context.addInitScript((t) => {
      try {
        localStorage.setItem("theme", t);
      } catch {}
    }, theme);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    let routes;
    if (signedIn) {
      await page.goto(`${base}/api/dev/login?next=/app`, { waitUntil: "networkidle" });
      signedInRoutes ??= [...SIGNED_IN, ...(await discover(page))];
      routes = only ? only.filter((r) => !PUBLIC.includes(r)) : signedInRoutes;
    } else routes = only ? only.filter((r) => PUBLIC.includes(r)) : PUBLIC;
    for (const route of routes) {
      errors.length = 0;
      const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle" }).catch((err) => ({ status: () => err.message }));
      await page.waitForTimeout(400);
      const result = await audit(page).catch((err) => ({ failed: String(err) }));
      report.push({ route, theme, size: sizeName, status: response?.status?.(), finalUrl: page.url().replace(base, ""), errors: [...errors], ...result });
      const r = report[report.length - 1];
      const count = (r.axe?.length ?? 0) + (r.unfocused?.length ?? 0) + (r.smallTargets?.length ?? 0) + (r.overflow > 1 ? 1 : 0) + r.errors.length;
      console.log(`${theme}/${sizeName} ${route} -> ${r.finalUrl} [${r.status}] ${count ? `${count} issue(s)` : "clean"}${r.failed ? ` FAILED ${r.failed}` : ""}`);
    }
    await context.close();
    }
  }
}
await browser.close();

// Summary grouped by rule, so one component bug shows once with every page it hits.
const byRule = new Map();
const add = (key, where, detail) => {
  const entry = byRule.get(key) ?? { where: new Set(), details: new Set() };
  entry.where.add(where);
  if (detail) entry.details.add(detail);
  byRule.set(key, entry);
};
for (const r of report) {
  const where = `${r.route} (${r.theme}/${r.size})`;
  for (const v of r.axe ?? []) for (const n of v.nodes) add(`axe ${v.id} [${v.impact}]: ${v.help}`, where, `${n.target} :: ${n.summary ?? ""}`);
  for (const u of r.unfocused ?? []) add("focus: no visible focus indicator", where, u);
  for (const t of r.smallTargets ?? []) add("target: smaller than 24x24", where, t);
  if (r.overflow > 1) add("layout: horizontal overflow", where, `${r.overflow}px`);
  for (const e of r.errors) add("page error", where, e);
}
for (const [key, entry] of byRule) {
  console.log(`\n## ${key}\n  pages (${entry.where.size}): ${[...entry.where].slice(0, 8).join(", ")}${entry.where.size > 8 ? " ..." : ""}`);
  for (const d of [...entry.details].slice(0, 12)) console.log(`  - ${d}`);
}
if (args.json) writeFileSync(args.json, JSON.stringify(report, null, 1));
console.log(byRule.size ? `\n${byRule.size} kinds of issue.` : "\nNo issues found.");
process.exit(byRule.size ? 1 : 0);
