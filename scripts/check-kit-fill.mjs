// Runs the extension's answer-kit fill (extension/kit-fill.js) in Chromium against
// synthetic Greenhouse and Lever application pages and checks every field: what it
// fills, what it leaves for the person, and that nothing is ever submitted.
//
//   node scripts/check-kit-fill.mjs [--out .data/shots/kit-fill] [--live]
//
// The fill plan comes from the real kit code (tests/fixtures/application-forms/sample-plan.ts).
// --live also fills a live Greenhouse embed and a live Lever form in a throwaway browser with
// every non-GET request blocked, then closes it: nothing can be sent to the employer.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : ".data/shots/kit-fill";
const live = args.includes("--live");
const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
mkdirSync(out, { recursive: true });

const tsx = join(root, "node_modules", "tsx", "dist", "cli.mjs");
const plan = JSON.parse(execFileSync(process.execPath, [tsx, "tests/fixtures/application-forms/sample-plan.ts"], { cwd: root, encoding: "utf8" }));
const fixture = (name) => readFileSync(join(root, "tests", "fixtures", "application-forms", name), "utf8");
const fillScript = join(root, "extension", "kit-fill.js");

const browser = await chromium.launch({ channel: "chromium", headless: true });
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`${ok ? "ok  " : "FAIL"} ${message}`);
};

async function run(name, url, html, theme = "light") {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: theme });
  const page = await context.newPage();
  const sent = [];
  await page.route("**/*", (route) => {
    const request = route.request();
    if (request.method() !== "GET") {
      sent.push(`${request.method()} ${request.url()}`);
      return route.abort();
    }
    if (html && request.url() === url) return route.fulfill({ contentType: "text/html", body: html });
    return html ? route.abort() : route.continue();
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  if (!html) await page.waitForSelector("form", { timeout: 20000 });
  await page.addScriptTag({ path: fillScript });
  const report = await page.evaluate((p) => fillFromKit(p), plan);
  await page.evaluate(([p, r]) => showFillPanel(p, [r]), [plan, report]);
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(out, `${name}.${theme}.png`) });
  const submitted = await page.evaluate(() => window.__submitted === true);
  const snapshot = await page.evaluate(() => {
    const value = (sel) => document.querySelector(sel)?.value ?? null;
    const checked = (name) => [...document.querySelectorAll(`input[name="${name}"]`)].filter((i) => i.checked).map((i) => i.value);
    return {
      value,
      gh: {
        first: value("#first_name"), last: value("#last_name"), email: value("#email"), phone: value("#phone"), linkedin: value("#question_1"),
        website: value("#question_2"), pronouns: value("#question_3"), excel: value("#question_7"), canada: value("#question_8"), start: value("#question_10"),
        location: value("#candidate-location"), authorized: value("#question_5"),
      },
      lever: {
        name: value("input[name=name]"), email: value("input[name=email]"), phone: value("input[name=phone]"), location: value("input[name=location]"),
        org: value("input[name=org]"), linkedin: value("input[name='urls[LinkedIn]']"), github: value("input[name='urls[GitHub]']"), portfolio: value("input[name='urls[Portfolio]']"),
        authorized: checked("cards[a1][field0]"), sponsorship: value("select[name='cards[a2][field0]']"), relocate: checked("cards[a3][field0]"),
        excel: value("textarea[name='cards[a4][field0]']"), singapore: checked("cards[a5][field0]"), why: value("textarea[name='cards[a6][field0]']"),
        comments: value("textarea[name=comments]"), gender: value("select[name='eeo[gender]']"), pronouns: checked("pronouns"),
      },
    };
  });
  await context.close();
  return { report, submitted, sent, snapshot };
}

const excel = plan.answers.find((a) => a.key.startsWith("questions.")).value;

// Greenhouse
{
  const { report, submitted, sent, snapshot: s } = await run("greenhouse", "https://job-boards.greenhouse.io/embed/job_app?for=northwind&token=5550001", fixture("greenhouse-apply.html"));
  const gh = s.gh;
  check(gh.first === "Jordan" && gh.last === "Lee", "Greenhouse: first and last name from the saved name");
  check(gh.email === "jordan.lee@example.com" && gh.phone === "(336) 555-0142", "Greenhouse: resume email and phone");
  check(gh.linkedin === "linkedin.com/in/jordan-lee-example", "Greenhouse: LinkedIn question");
  check(gh.excel === excel, "Greenhouse: the form's Excel question gets the kit's drafted answer");
  check(gh.website === "" && report.blank.some((b) => b.label === "Website or GitHub"), "Greenhouse: no website saved, so it stays blank and the panel says why");
  check(gh.start === "" && report.blank.some((b) => b.label === "Earliest start date"), "Greenhouse: no start date saved, blank and flagged");
  check(gh.pronouns === "" && gh.canada === "", "Greenhouse: pronouns and an open sponsorship question are left alone");
  check(gh.location === "" && gh.authorized === "", "Greenhouse: comboboxes are never typed into");
  const choose = Object.fromEntries(report.choose.map((c) => [c.label, c.value]));
  check(choose["Location (City)"] === "Greensboro, NC", "Greenhouse: the place picker is listed with the saved city");
  check(choose["Are you legally authorized to work in the United States?"] === "Yes" && choose["Will you now or in the future require sponsorship for employment visa status?"] === "No", "Greenhouse: Yes/No menus are listed with the person's answers");
  check(!report.choose.some((c) => /gender|veteran|hear about|consent/i.test(c.label)), "Greenhouse: demographic, referral, and consent questions are never suggested");
  check(report.files.join("|") === "Resume/CV|Cover Letter", "Greenhouse: resume and cover letter listed to attach");
  check(report.stillEmpty.includes("How did you hear about us?"), "Greenhouse: required questions left for the person are listed");
  check(report.filled.length === 6, `Greenhouse: 6 fields filled (got ${report.filled.length})`);
  check(!submitted && sent.length === 0, "Greenhouse: nothing submitted or sent");
}

// Lever
for (const theme of ["light", "dark"]) {
  const { report, submitted, sent, snapshot: s } = await run("lever", "https://jobs.lever.co/northwind/0b0c0d0e-0000-4000-8000-000000000001/apply", fixture("lever-apply.html"), theme);
  if (theme === "dark") {
    check(!submitted && sent.length === 0, "Lever (dark): nothing submitted or sent");
    continue;
  }
  const lv = s.lever;
  check(lv.name === "Jordan Lee" && lv.email === "jordan.lee@example.com" && lv.phone === "(336) 555-0142", "Lever: full name, email, phone");
  check(lv.location === "Greensboro, NC", "Lever: current location");
  check(lv.org === "Oakwood Family Dental", "Lever: current company from the ongoing role");
  check(lv.linkedin === "linkedin.com/in/jordan-lee-example" && lv.github === "", "Lever: LinkedIn filled, GitHub left alone");
  check(lv.portfolio === "" && report.blank.some((b) => b.label === "Portfolio URL"), "Lever: no website saved, portfolio blank and flagged");
  check(lv.authorized.join() === "Yes", "Lever: work authorization radio set to Yes");
  check(lv.sponsorship === "No", "Lever: sponsorship select set to No");
  check(lv.relocate.join() === "Yes, I'm willing to relocate", "Lever: relocation checkbox from the saved answer");
  check(lv.excel === excel, "Lever: custom Excel question answered from the kit");
  check(lv.singapore.length === 0, "Lever: a question about Singapore is left alone");
  check(lv.why === "" && lv.comments === "", "Lever: why-this-company and additional information are left for the person");
  check(lv.gender === "" && lv.pronouns.length === 0, "Lever: EEO and pronouns untouched");
  check(report.files.join() === "Resume/CV", "Lever: resume listed to attach");
  check(!submitted && sent.length === 0, "Lever: nothing submitted or sent");
}

if (live) {
  for (const [name, url] of [
    ["live-greenhouse", "https://job-boards.greenhouse.io/embed/job_app?for=brex&token=8721806002"],
    ["live-lever", "https://jobs.lever.co/anchorage/09b2b0d1-fb52-431c-b617-2fb74b595b1d/apply"],
  ]) {
    try {
      const { report, submitted, sent } = await run(name, url, null);
      console.log(`\n${name}: filled ${report.filled.map((f) => f.label).join("; ")}`);
      console.log(`  choose: ${report.choose.map((c) => `${c.label} = ${c.value}`).join("; ")}`);
      console.log(`  blank: ${report.blank.map((b) => b.label).join("; ")}`);
      console.log(`  files: ${report.files.join("; ")}`);
      console.log(`  still empty: ${report.stillEmpty.join("; ")}`);
      check(!submitted && report.filled.length > 0, `${name}: filled ${report.filled.length} fields, submitted nothing (${sent.length} outgoing requests blocked)`);
    } catch (error) {
      console.log(`skip ${name}: ${error.message.split("\n")[0]}`);
    }
  }
}

await browser.close();
console.log(failures.length ? `\n${failures.length} failed.` : `\nAll checks passed. Screenshots in ${out}.`);
process.exit(failures.length ? 1 : 0);
