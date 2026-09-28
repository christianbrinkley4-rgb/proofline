import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { db, dbReady, schema } from "@/lib/db";
import { addFact, listFacts } from "@/lib/kb/facts";
import { getProfile, updateProfile } from "@/lib/kb/profile";
import { addEducationEntry, addManualFact, deleteEducationEntry, deleteFact, ensureFactBase, fieldOf, loadFactBase, saveEducation, saveRole } from "@/lib/facts/base";
import { draftFromResume, confirmedEducationDetails } from "@/lib/onboarding/draft";
import { tailorResume } from "@/lib/resume/tailor";
import { runQualityGate } from "@/lib/resume/quality";
import { renderDocx, renderPdf } from "@/lib/resume/render";
import { resumeToText } from "@/lib/resume/parse";
import { parseResumeText } from "@/lib/resume/parse/rules";

const SOURCE = `Casey Morgan
Durham, NC | 919.555.0101 | casey.resume@example.invalid | linkedin.com/in/casey-morgan | caseymorgan.com
EDUCATION
Master of Science in Accounting, UNC Greensboro | January 2027 to June 2027
Bachelor of Science in Accounting, UNC Greensboro | Expected December 2026 | 3.69 GPA | Dean's List
Relevant coursework: Federal Tax Concepts (prepared tax returns, Grade A), Auditing
CPA candidate
EXPERIENCE
Front Desk | City Clinic
January 2024 to June 2024
• Scheduled appointments for 3 dentists`;

beforeAll(async () => { await dbReady; }, 60_000);

async function student() {
  const id = randomUUID();
  await db.insert(schema.user).values({ id, name: "Casey Morgan", email: `signin-${id}@example.invalid` });
  return id;
}

describe("two degrees from import to tailored resume", () => {
  it("keeps both degrees, GPA, honors, coursework and separate contact details in PDF and DOCX", async () => {
    const id = await student();
    const draft = draftFromResume(parseResumeText(SOURCE));
    expect(draft.education).toHaveLength(2);
    expect(draft.education[1].details).toEqual(["CPA candidate"]);
    const { fullName, phone, city, region, contactEmail, linkedinUrl, portfolioUrl } = draft.basics;
    await updateProfile(id, { fullName, phone, city, region, contactEmail, linkedinUrl, portfolioUrl });
    await saveEducation(id, draft.education);
    const role = await saveRole(id, { ...draft.roles[0], kind: "work" });
    expect(role).toBeDefined();
    await addFact(id, { category: "education", content: "Won an unconfirmed scholarship", source: "resume_parsed" });

    const result = await tailorResume(id, { email: `signin-${id}@example.invalid` });
    const edu = result.document.sections.find((section) => section.kind === "education")!;
    expect(edu.kind).toBe("education");
    if (edu.kind !== "education") throw new Error("Missing education");
    expect(edu.entries.map((entry) => entry.degreeLine)).toEqual(["Master of Science in Accounting", "Bachelor of Science in Accounting"]);
    expect(edu.entries[0].details).toEqual([]);
    expect(edu.entries[1].details.join("\n")).toContain("GPA: 3.69/4.0");
    expect(edu.entries[1].details.join("\n")).toContain("Honors: Dean's List");
    expect(edu.entries[1].details.join("\n")).toContain("Federal Tax Concepts (prepared tax returns, Grade A)");
    expect(edu.entries[1].details).toContain("CPA candidate");
    expect(result.document.header.contact).toContain("casey.resume@example.invalid");
    expect(result.document.header.contact).toContain("caseymorgan.com");
    expect(result.document.header.contact).toContain("linkedin.com/in/casey-morgan");
    expect(result.document.header.contact.join(" ")).not.toContain("signin-");
    expect(JSON.stringify(result.document)).not.toContain("unconfirmed scholarship");
    expect(result.layout.overflow).toBe(false);
    const confirmed = await listFacts(id, { states: ["confirmed"] });
    const honors = confirmed.find((fact) => fieldOf(fact) === "honors")!;
    expect(result.document.sourceFactIds).toContain(honors.id);

    const pdf = await renderPdf(result.document, result.template, "Casey Morgan Resume");
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
    const docx = await renderDocx(result.document, result.template);
    for (const [name, bytes, type] of [["resume.pdf", pdf, "application/pdf"], ["resume.docx", docx, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]] as const) {
      const text = await resumeToText({ name, bytes: new Uint8Array(bytes), type });
      expect(text).toContain("Master of Science in Accounting");
      expect(text).toContain("Bachelor of Science in Accounting");
      expect(text).toContain("Dean's List");
      expect(text).toContain("Federal Tax Concepts");
      expect(text).toContain("casey.resume@example.invalid");
    }
    await deleteFact(id, honors.id);
    const current = await listFacts(id, { states: ["confirmed"] });
    const bullets = result.document.sections.flatMap((s) => s.kind === "entries" ? s.entries.flatMap((e) => e.bullets) : []);
    const checks = runQualityGate(result.document, result.layout, new Map(current.map((fact) => [fact.id, fact.content])), new Set(bullets.map((bullet) => bullet.id)));
    expect(checks.find((check) => check.id === "facts")?.status).toBe("fail");
  });

  it("saves no unchecked detail, including a candidate credential", () => {
    const draft = draftFromResume(parseResumeText(SOURCE));
    expect(confirmedEducationDetails(draft.education[1].details.map((text) => ({ text, confirmed: false })))).toEqual([]);
    expect(confirmedEducationDetails([{ text: "CPA candidate", confirmed: true }])).toEqual(["CPA candidate"]);
  });

  it("adds a second degree without removing legacy coursework or recreating cleared GPA", async () => {
    const id = await student();
    await updateProfile(id, { school: "State University", degree: "BS", gradDate: "2026-12", gpa: 3.69 });
    await ensureFactBase(id);
    const [legacy] = (await loadFactBase(id)).educationEntries!;
    await addManualFact(id, { group: "education", entryId: legacy.id, eduField: "detail", text: "CPA candidate" });
    await addEducationEntry(id, { school: "State University", degree: "MS", gradDate: "2027-06" });
    let base = await loadFactBase(id);
    expect(base.educationEntries).toHaveLength(2);
    const bachelor = base.educationEntries!.find((entry) => entry.degree === "BS")!;
    expect(bachelor.extras).toContain("CPA candidate");
    await deleteFact(id, bachelor.factIds.gpa!);
    await ensureFactBase(id);
    base = await loadFactBase(id);
    expect(base.education.filter((fact) => fact.field === "gpa")).toEqual([]);
    expect(base.educationEntries).toHaveLength(2);
    await deleteEducationEntry(id, base.educationEntries![0].id);
    expect((await getProfile(id))?.degree).toBe("BS");
    expect((await loadFactBase(id)).educationEntries).toHaveLength(1);
  });

  it("rejects another person's entry id and duplicate entries before changing facts", async () => {
    const id = await student();
    const other = await student();
    await saveEducation(id, [{ school: "My University", degree: "BS" }]);
    const [mine] = (await loadFactBase(id)).educationEntries!;
    const input = { entryId: mine.id, school: mine.school, degree: mine.degree };
    await expect(saveEducation(other, [input])).rejects.toThrow("education entry changed");
    await expect(saveEducation(id, [input, input])).rejects.toThrow("own id");
    expect((await loadFactBase(id)).educationEntries).toHaveLength(1);
    expect((await loadFactBase(other)).educationEntries).toHaveLength(0);
  });
});
