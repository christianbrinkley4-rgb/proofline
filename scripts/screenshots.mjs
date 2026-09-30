// Full-page screenshots of Proofline pages in light and dark, desktop and phone.
//
//   node scripts/screenshots.mjs --out .data/shots/after [--routes /,/app] [--themes light,dark] [--sizes desktop,phone]
//
// Needs `npm run dev` on localhost:3000 and a local Chrome or Edge. Signs in with the
// development login, so it only works against a local dev server.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
const base = args.base ?? "http://localhost:3000";
const out = args.out ?? ".data/shots";
const DEFAULT_ROUTES = ["/", "/check", "/login", "/app", "/app/jobs", "/app/facts", "/app/tracker", "/app/settings", "/app/onboarding"];
const routes = args.routes ? args.routes.split(",") : DEFAULT_ROUTES;
const themes = (args.themes ?? "light,dark").split(",");
const SIZES = { desktop: { width: 1280, height: 860 }, phone: { width: 390, height: 844 } };
const sizes = (args.sizes ?? "desktop,phone").split(",");

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].filter(Boolean);

const browser = await chromium.launch({ executablePath: CANDIDATES[0], args: ["--hide-scrollbars"] }).catch(async () => {
  for (const path of CANDIDATES.slice(1)) {
    try {
      return await chromium.launch({ executablePath: path, args: ["--hide-scrollbars"] });
    } catch {}
  }
  throw new Error("No Chrome or Edge found. Set CHROME_PATH.");
});

mkdirSync(out, { recursive: true });
const problems = [];
for (const theme of themes) {
  for (const sizeName of sizes) {
    const context = await browser.newContext({ viewport: SIZES[sizeName], deviceScaleFactor: 1, colorScheme: theme === "dark" ? "dark" : "light" });
    // next-themes reads this key before first paint.
    await context.addInitScript((t) => {
      try {
        localStorage.setItem("theme", t);
      } catch {}
    }, theme);
    const page = await context.newPage();
    page.on("pageerror", (err) => problems.push(`${theme}/${sizeName}: page error ${err.message}`));
    await page.goto(`${base}/api/dev/login?next=/app`, { waitUntil: "networkidle" });
    for (const route of routes) {
      const url = `${base}${route}`;
      await page.goto(url, { waitUntil: "networkidle" }).catch((err) => problems.push(`${route}: ${err.message}`));
      // Let entrance motion finish so the shot shows the settled page.
      await page.waitForTimeout(900);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 1) problems.push(`${theme}/${sizeName} ${route}: ${overflow}px horizontal overflow`);
      const name = `${(route === "/" ? "home" : route.slice(1).replace(/[/?=&]+/g, "_"))}.${sizeName}.${theme}.png`;
      await page.screenshot({ path: join(out, name), fullPage: true });
    }
    await context.close();
  }
}
await browser.close();
console.log(problems.length ? problems.join("\n") : "No overflow or page errors.");
console.log(`Saved to ${out}`);
