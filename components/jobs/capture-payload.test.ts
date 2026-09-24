import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { jobCaptureBookmarklet, readCaptureFragment } from "./capture-payload";

describe("browser job capture", () => {
  it("brings structured job details to the review form without saving them", () => {
    const posting = {
      "@type": "JobPosting",
      title: "Customer Service Associate",
      description: "<p>Help customers with orders and returns.</p>",
      hiringOrganization: { name: "Acme" },
      jobLocation: { address: { addressLocality: "Charlotte", addressRegion: "NC" } },
    };
    const location = { href: "https://jobs.example.com/role/42" };
    const document = {
      title: "Customer Service Associate | Acme",
      querySelectorAll: () => [{ textContent: JSON.stringify(posting) }],
      querySelector: () => null,
      createElement: () => ({
        set innerHTML(value: string) { this.textContent = value.replace(/<[^>]*>/g, ""); },
        textContent: "",
      }),
    };

    const bookmarklet = jobCaptureBookmarklet("https://proofline.app");
    runInNewContext(bookmarklet.slice("javascript:".length), { document, location, window: { getSelection: () => "" }, JSON, encodeURIComponent });

    const destination = new URL(location.href);
    expect(destination.origin + destination.pathname).toBe("https://proofline.app/app/jobs");
    expect(destination.searchParams.get("capture")).toBe("1");
    expect(readCaptureFragment(destination.hash)).toEqual({
      url: "https://jobs.example.com/role/42",
      company: "Acme",
      title: "Customer Service Associate",
      location: "Charlotte, NC",
      description: "Help customers with orders and returns.",
    });
  });

  it("ignores invalid or dangerous incoming fragments", () => {
    expect(readCaptureFragment("#capture=%7Bbroken")).toBeNull();
    expect(readCaptureFragment(`#capture=${encodeURIComponent(JSON.stringify({ url: "javascript:alert(1)" }))}`)).toBeNull();
    expect(readCaptureFragment(`#capture=${"a".repeat(60_001)}`)).toBeNull();
  });

  it("keeps a long visible selection within the URL limit", () => {
    const location = { href: "https://example.com/jobs/long" };
    const document = {
      title: "Long posting",
      querySelectorAll: () => [],
      querySelector: () => null,
      createElement: () => ({ innerHTML: "", textContent: "" }),
    };
    const bookmarklet = jobCaptureBookmarklet("https://proofline.app");
    runInNewContext(bookmarklet.slice("javascript:".length), {
      document, location, window: { getSelection: () => "🧰 ".repeat(6000) }, JSON, encodeURIComponent,
    });
    const destination = new URL(location.href);
    expect(destination.hash.length).toBeLessThan(60_000);
    expect(readCaptureFragment(destination.hash)?.description.length).toBeGreaterThan(200);
  });
});
