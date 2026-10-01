// Playwright check for the month picker (components/ui/month-input.tsx), on the first
// onboarding screen's "Graduation month", at desktop width and at 390px with touch.
//
//   node scripts/check-month-picker.mjs [--base http://localhost:3000] [--shots folder]
//
// Needs `npm run dev` and a local Chrome or Edge (set CHROME_PATH otherwise). It signs in a
// brand-new synthetic student with the development login, so it only works on localhost.
// A click or a tap on a month must select it, visibly, the first time. Exits 1 if anything fails.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => (arg.startsWith("--") ? [...pairs, [arg.slice(2), all[i + 1]]] : pairs), []),
);
const base = args.base ?? "http://localhost:3000";
const shots = args.shots;
if (shots) mkdirSync(shots, { recursive: true });

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

const SIZES = {
  desktop: { viewport: { width: 1280, height: 860 } },
  "mobile 390px": { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
};

let failures = 0;
const check = (ok, what) => {
  console.log(`${ok ? "pass" : "FAIL"}  ${what}`);
  if (!ok) failures++;
};

const browser = await launch();
for (const [name, options] of Object.entries(SIZES)) {
  console.log(`\n${name}`);
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const press = (locator) => (options.hasTouch ? locator.tap() : locator.click());

  await page.goto(`${base}/api/dev/login?fresh=1&next=/app/onboarding`, { waitUntil: "networkidle" });
  const field = page.locator("#gradDate-0");
  await field.waitFor();
  // The school is required too, so fill it and leave the month as the only thing missing.
  await page.locator("#school-0").fill("Test University");
  const value = () => field.getAttribute("data-value");
  const panel = page.getByRole("group", { name: "Choose a month" });

  check((await value()) === "", "starts empty");
  check(await page.evaluate(() => !document.querySelector("form")?.checkValidity()), "the form will not submit without a graduation month");

  // One click on a month selects it, shows it, and closes the picker.
  await press(field);
  check(await panel.isVisible(), "opens when pressed");
  await press(page.getByRole("button", { name: /^June \d{4}$/ }));
  check(/^\d{4}-06$/.test((await value()) ?? ""), `a click on June stuck on the first try (${await value()})`);
  check((await field.innerText()).startsWith("June "), `the field shows it ("${(await field.innerText()).trim()}")`);
  check(!(await panel.isVisible()), "closes after choosing");
  check(await page.evaluate(() => document.querySelector("form")?.checkValidity()), "the form can submit once a month is chosen");

  // A typed year is kept digit by digit, and the months follow it.
  await press(field);
  const year = page.getByRole("textbox", { name: "Year" });
  await year.fill("");
  await year.pressSequentially("2027");
  check((await year.inputValue()) === "2027", "all four typed year digits stay");
  await press(page.getByRole("button", { name: "May 2027" }));
  check((await value()) === "2027-05", `a month in a typed year stuck (${await value()})`);

  // The arrows step the year, and picking again replaces the earlier choice.
  await press(field);
  await press(page.getByRole("button", { name: "Previous year" }));
  check((await year.inputValue()) === "2026", "the previous-year arrow steps back one year");
  await press(page.getByRole("button", { name: "January 2026" }));
  check((await value()) === "2026-01", `choosing again replaced it (${await value()})`);
  check((await field.innerText()).trim().startsWith("January 2026"), "the field shows the new choice");

  // Reopened, the chosen month is marked.
  await press(field);
  check((await page.getByRole("button", { name: "January 2026" }).getAttribute("aria-pressed")) === "true", "the chosen month is marked when reopened");
  if (shots) await page.screenshot({ path: `${shots}/month-picker-${name.replace(/\W+/g, "-")}.png` });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no sideways scroll");

  check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join("; ")}` : ""}`);
  await context.close();
}
await browser.close();
if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log("\nAll checks passed.");
