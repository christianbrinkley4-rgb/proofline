import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Proofline fills; the person submits. This holds for every script the extension ships,
// not only the fill: none of them may submit a form, press a button, or send a key.

const DIR = join(__dirname, "..", "extension");
const FILES = readdirSync(DIR).filter((name) => name.endsWith(".js"));

const FORBIDDEN: Array<[string, RegExp]> = [
  ["form.submit()", /\.submit\s*\(/],
  ["form.requestSubmit()", /requestSubmit/],
  ["element.click()", /\.click\s*\(\s*\)/],
  ["a submit event", /SubmitEvent|new Event\(\s*["']submit["']/],
  ["a synthetic key press", /KeyboardEvent/],
  ["looking up a submit button", /type\s*=\s*\\?["']?submit|\[type=.?submit/i],
];

describe("the extension never submits an application", () => {
  it("ships the fill scripts this test is meant to cover", () => {
    expect(FILES).toEqual(expect.arrayContaining(["kit-fill.js", "page-scripts.js", "popup.js", "sites.js", "background.js"]));
  });

  it.each(FILES)("%s has no way to submit, click, or press keys", (name) => {
    const source = readFileSync(join(DIR, name), "utf8");
    const found = FORBIDDEN.filter(([, pattern]) => pattern.test(source)).map(([label]) => label);
    expect(found).toEqual([]);
  });

  it("dispatches only input and change events, and mouse events nowhere", () => {
    for (const name of FILES) {
      const source = readFileSync(join(DIR, name), "utf8");
      const events = [...source.matchAll(/new (\w*Event)\(\s*["'](\w+)["']/g)].map((m) => `${m[1]}:${m[2]}`);
      for (const event of events) expect(["Event:input", "Event:change"]).toContain(event);
    }
  });
});
