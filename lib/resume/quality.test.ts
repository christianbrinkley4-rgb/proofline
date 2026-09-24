import { describe, expect, it } from "vitest";
import type { Requirements } from "@/lib/fit/requirements";
import type { ResumeDocument } from "./document";
import type { LayoutResult } from "./layout";
import { runQualityGate } from "./quality";

const layout: LayoutResult = { ops: [], overflow: false, remaining: 72 };

function doc(bullets: string[], opts: { dates?: string; contact?: string[] } = {}): ResumeDocument {
  return {
    header: { name: "Jordan Reyes", contact: opts.contact ?? ["Raleigh, NC", "jordan@example.com", "(919) 555-0142", "linkedin.com/in/jordanreyes"] },
    sections: [
      {
        kind: "entries",
        title: "Experience",
        entries: [
          { experienceId: "e1", org: "Oakwood Family Dental", title: "Bookkeeping Assistant", location: null, dates: opts.dates ?? "May 2024 – Aug 2024", bullets: bullets.map((text, i) => ({ id: `b${i}`, text, factIds: [`f${i}`] })) },
        ],
      },
    ],
  };
}

function gate(d: ResumeDocument, requirements?: Requirements) {
  const facts = new Map(documentFacts(d));
  const active = new Set(facts.keys()).size ? new Set(d.sections.flatMap((s) => (s.kind === "entries" ? s.entries.flatMap((e) => e.bullets.map((b) => b.id)) : []))) : new Set<string>();
  return Object.fromEntries(runQualityGate(d, layout, facts, active, requirements).map((c) => [c.id, c]));
}

/** Each bullet cites a fact with the same text, so the facts check passes and the new checks are what's tested. */
function documentFacts(d: ResumeDocument): Array<[string, string]> {
  return d.sections.flatMap((s) => (s.kind === "entries" ? s.entries.flatMap((e) => e.bullets.map((b, i) => [`f${i}`, b.text] as [string, string])) : []));
}

describe("career-center checks in the quality gate", () => {
  it("passes a clean, measured, past-tense resume with full contact details", () => {
    const checks = gate(doc(["Reconciled 40 vendor accounts each month in QuickBooks", "Caught $3,200 in duplicate payments"]));
    for (const id of ["contact", "numbers", "tense", "proofread"]) expect(checks[id].status, id).toBe("pass");
  });

  it("flags missing contact details, unmeasured bullets, present tense in a past role, and typos", () => {
    const checks = gate(doc(["Manage the the front desk", "Answer patient calls", "Reconciled 40 accounts"], { contact: ["jordan@example.com"] }));
    expect(checks.contact.detail).toContain("phone, LinkedIn URL");
    expect(checks.numbers.status).toBe("warn");
    expect(checks.tense.detail).toContain("Manage");
    expect(checks.proofread.detail).toContain('"the the"');
    expect(Object.values(checks).every((c) => !c.blocking || c.id === "facts" || c.id === "one-page")).toBe(true);
  });

  it("allows present tense for a current role", () => {
    expect(gate(doc(["Manage 40 vendor accounts"], { dates: "May 2025 – Present" })).tense.status).toBe("pass");
  });

  it("reports which posting requirements the page doesn't show", () => {
    const requirements = { required: ["Excel", "Journal entries"], requiredGroups: [["Excel"], ["Journal entries"]], preferred: [], preferredGroups: [], mentioned: ["Excel", "Journal entries"] } as unknown as Requirements;
    const checks = gate(doc(["Built weekly reports in Excel for 12 managers"]), requirements);
    expect(checks.requirements.status).toBe("warn");
    expect(checks.requirements.detail).toContain("1 of 2");
  });

  it("flags recruiter buzzwords", () => {
    expect(gate(doc(["Detail-oriented team player who reconciled 40 accounts"])).filler.detail).toMatch(/detail-oriented|team player/);
  });
});
