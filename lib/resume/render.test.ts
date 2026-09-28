import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { findVoiceIssues, findWeakOpener } from "@/lib/voice/rules";
import { documentBullets } from "./document";
import { SAMPLE_RESUME } from "./fixtures/sample";
import { layoutResume, sanitize } from "./layout";
import { renderDocx, renderPdf } from "./render";
import { runQualityGate } from "./quality";
import { TEMPLATES } from "./templates";

const sample = SAMPLE_RESUME;

describe("layout", () => {
  it.each(Object.values(TEMPLATES))("fits the sample on one page with the $label template", async (template) => {
    const layout = await layoutResume(sample, template);
    expect(layout.overflow).toBe(false);
    expect(layout.remaining).toBeGreaterThan(0);
  });

  it("reports overflow when content runs past one page", async () => {
    const long = structuredClone(sample);
    const exp = long.sections[1];
    if (exp.kind === "entries") for (const e of exp.entries) for (let i = 0; i < 10; i++) e.bullets.push({ ...e.bullets[0], id: `${e.experienceId}-${i}` });
    expect((await layoutResume(long, TEMPLATES.classic)).overflow).toBe(true);
  });

  it("keeps text the PDF fonts can encode", () => {
    expect(sanitize("Café → growth ✓ “quoted” — dash")).toBe("Café -> growth  “quoted” — dash");
  });
});

describe("renderers", () => {
  it("produces a one-page PDF", async () => {
    const bytes = await renderPdf(sample, TEMPLATES.classic, "Resume");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("Resume");
  });

  it("reuses a precomputed layout for PDF and DOCX", async () => {
    const layout = await layoutResume(sample, TEMPLATES.classic);
    const bytes = await renderPdf(sample, TEMPLATES.classic, "Resume", layout);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    const buffer = await renderDocx(sample, TEMPLATES.classic, layout);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
  });

  it("produces a DOCX", async () => {
    const buffer = await renderDocx(sample, TEMPLATES.technical);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    expect(buffer.length).toBeGreaterThan(4000);
  });
});

describe("generated resume content", () => {
  const bullets = documentBullets(sample);

  it("has no em dashes, filler, or weak openers", () => {
    for (const b of bullets) {
      expect(findVoiceIssues(b.text)).toEqual([]);
      expect(findWeakOpener(b.text)).toBeNull();
    }
  });

  it("passes the quality gate when every bullet is backed by a fact", async () => {
    const layout = await layoutResume(sample, TEMPLATES.classic);
    const facts = new Map(bullets.map((b) => [`f-${b.id}`, b.text]));
    const checks = runQualityGate(sample, layout, facts, new Set(bullets.map((b) => b.id)));
    expect(checks.filter((c) => c.status !== "pass")).toEqual([]);
  });

  it("blocks a number-free bullet when its cited fact was revoked", async () => {
    const doc = structuredClone(sample);
    const bullet = documentBullets(doc)[0];
    bullet.text = "Managed vendor accounts";
    const layout = await layoutResume(doc, TEMPLATES.classic);
    const facts = new Map(documentBullets(doc).map((b) => [`f-${b.id}`, b.text]));
    facts.delete(bullet.factIds[0]);
    const checks = runQualityGate(doc, layout, facts, new Set(documentBullets(doc).map((b) => b.id)));
    expect(checks.find((c) => c.id === "facts")).toMatchObject({ status: "fail", blocking: true });
  });

  it("blocks export when a bullet's number isn't confirmed", async () => {
    const layout = await layoutResume(sample, TEMPLATES.classic);
    const facts = new Map(bullets.map((b) => [`f-${b.id}`, b.text.replace(/\d+/g, "some")]));
    const checks = runQualityGate(sample, layout, facts, new Set(bullets.map((b) => b.id)));
    expect(checks.find((c) => c.id === "facts")).toMatchObject({ status: "fail", blocking: true });
  });
});
