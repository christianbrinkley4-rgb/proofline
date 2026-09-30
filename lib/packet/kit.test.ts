import { describe, expect, it } from "vitest";
import type { EducationRecord } from "@/lib/facts/base";
import { findVoiceIssues } from "@/lib/voice/rules";
import { numbersIn } from "@/lib/resume/verify";
import { ANSWER_YOURSELF, buildAnswerKit, kitFields, splitName, suggestFact, type KitInput, type KitRole } from "./kit";

const edu = (id: string, over: Partial<EducationRecord> = {}): EducationRecord => ({
  id, school: "UNC Greensboro", degree: "Bachelor of Science", major: "Accounting", gradDate: "Dec 2026", gradMonth: "2026-12",
  gpa: "3.69", honors: "Dean's List", coursework: "Relevant coursework: Federal Tax Concepts",
  extras: [], factIds: { school: `${id}-school`, degree: `${id}-degree`, major: `${id}-major`, grad: `${id}-grad`, gpa: `${id}-gpa`, honors: [`${id}-honors`], coursework: `${id}-course`, extras: [] },
  ...over,
});

function eduFacts(r: EducationRecord): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (r.factIds.school) out.push([r.factIds.school, r.school]);
  if (r.factIds.degree) out.push([r.factIds.degree, r.degree]);
  if (r.factIds.major) out.push([r.factIds.major, r.major]);
  if (r.factIds.grad) out.push([r.factIds.grad, r.gradDate]);
  if (r.factIds.gpa) out.push([r.factIds.gpa, r.gpa]);
  r.factIds.honors.forEach((id) => out.push([id, r.honors]));
  if (r.factIds.coursework) out.push([r.factIds.coursework, r.coursework]);
  return out;
}

const role = (id: string, org: string, title: string, lines: string[], dates: { start: string | null; end: string | null } | null = { start: "2025-06", end: null }): { role: KitRole; facts: Array<[string, string]> } => {
  const facts: Array<[string, string]> = [[`${id}-org`, org], [`${id}-title`, title]];
  if (dates) facts.push([`${id}-dates`, "dates"]);
  const kitLines = lines.map((text, i) => {
    facts.push([`${id}-l${i}`, text]);
    return { text, factIds: [`${id}-l${i}`] };
  });
  return {
    role: {
      experienceId: id,
      org: { text: org, factId: `${id}-org` },
      title: { text: title, factId: `${id}-title` },
      location: null,
      dates: dates ? { ...dates, factId: `${id}-dates` } : null,
      lines: kitLines,
    },
    facts,
  };
};

type Case = { name: string; input: KitInput };

function makeCase(n: number): Case {
  const full = n % 3 !== 2;
  const education = n % 4 === 3 ? [] : [edu(`e${n}`, n % 2 ? { gpa: "", factIds: { ...edu(`e${n}`).factIds, gpa: undefined } } : {})];
  const roles = [
    role(`r${n}a`, "Oakwood Family Dental", "Front Desk Associate", ["Reconciled 40+ vendor accounts each month in QuickBooks Online", "Booked 25 patient appointments a day"], { start: "2024-01", end: n % 2 ? "2025-05" : null }),
    ...(n % 2 ? [role(`r${n}b`, "NC State Bookstores", "Inventory Clerk", ["Cut month-end counts from 2 days to 6 hours with an Excel tracker"], n === 5 ? null : { start: "2023-02", end: "2023-12" })] : []),
  ];
  const skills = full ? [{ id: `s${n}1`, text: "Excel" }, { id: `s${n}2`, text: "QuickBooks Online" }] : [];
  const factText = new Map<string, string>([
    ...education.flatMap(eduFacts),
    ...roles.flatMap((r) => r.facts),
    ...skills.map((s): [string, string] => [s.id, s.text]),
    [`q${n}`, "Built a cash report that pulls bank and QuickBooks data into one sheet"],
  ]);
  return {
    name: `profile ${n}`,
    input: {
      job: { id: "00000000-0000-4000-8000-000000000001", company: "Northwind", title: "Tax Intern", asksCitizenship: n % 5 === 0 },
      profile: {
        fullName: n === 7 ? "Cher" : "Jordan Avery Lee",
        contactEmail: full ? "jordan@example.com" : null,
        phone: n % 2 ? "555-0100" : null,
        city: "Greensboro", region: "NC",
        linkedinUrl: full ? "linkedin.com/in/jordan" : null,
        portfolioUrl: null,
        workAuthorization: ["us_citizen", "permanent_resident", "authorized", "needs_sponsorship", null][n % 5],
        availableFrom: n % 2 ? "2027-06" : null,
        openToRelocate: [true, false, null][n % 3],
      },
      education,
      roles: roles.map((r) => r.role),
      skills,
      licenses: [],
      resume: n % 2 ? { id: "res", fileName: "Jordan-Lee-Northwind-Resume.pdf", label: "Your resume for this job (Experience first, version 1)" } : null,
      letter: n % 3 === 0 ? { text: "Dear Hiring Team,\n\nAt Oakwood Family Dental, I reconciled 40+ vendor accounts each month.\n\nSincerely,\nJordan Avery Lee", factIds: [`r${n}a-l0`], usesOwnWords: false, status: "ready", blocked: false } : null,
      answers: [
        { id: "a1", question: "What experience do you have with QuickBooks?", answer: "At Oakwood Family Dental, I built a cash report that pulls bank and QuickBooks data into one sheet.", factIds: [`q${n}`], sourcesChanged: false, ownWords: false },
        { id: "a2", question: "Describe a time you handled a conflict with a coworker.", answer: "[Pick a real example from your experience. Proofline didn't find confirmed evidence that matches this question yet; add it to your profile first.]", factIds: [], sourcesChanged: false, ownWords: false },
      ],
      factText,
    },
  };
}

const CASES = Array.from({ length: 10 }, (_, i) => makeCase(i));

describe("answer kit", () => {
  it.each(CASES.map((c) => [c.name, c]))("%s: every filled line traces to a confirmed fact or the person's own saved answer", (_name, c) => {
    const kit = buildAnswerKit(c.input);
    const p = c.input.profile!;
    const profileValues = new Set([p.fullName, ...p.fullName!.split(" "), p.contactEmail, p.phone, `${p.city}, ${p.region}`, p.linkedinUrl, p.portfolioUrl].filter(Boolean) as string[]);
    for (const f of kitFields(kit)) {
      if (!f.value) {
        expect(f.blank, `${f.key} is empty but not flagged`).toBeDefined();
        continue;
      }
      expect(f.blank).toBeUndefined();
      expect(f.sources.length, `${f.key} has no source`).toBeGreaterThan(0);
      for (const s of f.sources) if (s.kind === "fact") expect(c.input.factText.get(s.id)).toBe(s.text);
      const factTexts = f.sources.flatMap((s) => (s.kind === "fact" ? [s.text] : []));
      if (f.sources.every((s) => s.kind === "fact")) {
        // Every number in the value appears in the facts it cites.
        const numbers = new Set(factTexts.flatMap(numbersIn));
        for (const num of numbersIn(f.value.replace(/\b(19|20)\d{2}\b/g, ""))) expect(numbers.has(num), `${f.key}: ${num} not in its facts`).toBe(true);
      }
      if (f.key.startsWith("contact.")) expect(profileValues.has(f.value), `${f.key}: ${f.value}`).toBe(true);
      if (f.key.startsWith("eligibility.") && !f.key.endsWith(".start")) expect(["Yes", "No"]).toContain(f.value);
    }
  });

  it("leaves fields blank and says why when there is no confirmed fact", () => {
    const kit = buildAnswerKit(CASES[2].input);
    const byKey = new Map(kitFields(kit).map((f) => [f.key, f]));
    expect(byKey.get("contact.email")?.value).toBe("");
    expect(byKey.get("contact.email")?.blank?.kind).toBe("no_fact");
    expect(byKey.get("contact.phone")?.blank?.reason).toMatch(/No phone number saved/);
    expect(byKey.get("skills.list")?.blank?.kind).toBe("no_fact");
    expect(kit.blankCount).toBe(kitFields(kit).filter((f) => f.blank?.kind === "no_fact").length);
    expect(kit.blankCount).toBeGreaterThan(0);
  });

  it("does not count unbuilt documents as missing facts", () => {
    const kit = buildAnswerKit(CASES[2].input);
    const resume = kitFields(kit).find((f) => f.key === "documents.resume");
    expect(resume?.blank?.kind).toBe("not_built");
    expect(resume?.blank?.fix.href).toBe(`/app/jobs/${CASES[2].input.job.id}?tab=tailor`);
  });

  it("drops a role line whose fact is no longer confirmed, or whose number isn't in its fact", () => {
    const input = CASES[0].input;
    const facts = new Map(input.factText);
    facts.delete("r0a-l1");
    const roles = input.roles.map((r) => ({ ...r, lines: [...r.lines, { text: "Reconciled 90 vendor accounts", factIds: ["r0a-l0"] }] }));
    const kit = buildAnswerKit({ ...input, factText: facts, roles });
    const description = kitFields(kit).find((f) => f.key === "work.r0a.description")!;
    expect(description.value).toBe("• Reconciled 40+ vendor accounts each month in QuickBooks Online");
  });

  it("holds back an answer whose fact changed, and flags one no fact supports with a suggestion", () => {
    const input = CASES[0].input;
    const kit = buildAnswerKit({ ...input, answers: [{ ...input.answers[0], sourcesChanged: true }, input.answers[1]] });
    const [changed, none] = kit.groups.find((g) => g.key === "questions")!.entries.map((e) => e.fields[0]);
    expect(changed.value).toBe("");
    expect(changed.blank?.kind).toBe("changed");
    expect(none.value).toBe("");
    expect(none.blank?.kind).toBe("no_fact");
    expect(none.blank?.reason).toMatch(/You could add a fact about the example this question asks for/);
  });

  it("cites the facts behind a drafted answer", () => {
    const kit = buildAnswerKit(CASES[0].input);
    const answer = kit.groups.find((g) => g.key === "questions")!.entries[0].fields[0];
    expect(answer.sources).toEqual([{ kind: "fact", id: "q0", text: "Built a cash report that pulls bank and QuickBooks data into one sheet" }]);
  });

  it("answers work authorization only from what the person said", () => {
    const answers = (auth: string | null) => {
      const kit = buildAnswerKit({ ...CASES[0].input, job: { ...CASES[0].input.job, asksCitizenship: true }, profile: { ...CASES[0].input.profile!, workAuthorization: auth } });
      const f = new Map(kitFields(kit).map((x) => [x.key, x.value]));
      return [f.get("eligibility.authorized"), f.get("eligibility.sponsorship"), f.get("eligibility.citizen")];
    };
    expect(answers("us_citizen")).toEqual(["Yes", "No", "Yes"]);
    expect(answers("permanent_resident")).toEqual(["Yes", "No", "No"]);
    expect(answers("authorized")).toEqual(["Yes", "No", "No"]);
    expect(answers("needs_sponsorship")).toEqual(["", "Yes", "No"]);
    expect(answers(null)).toEqual(["", "", ""]);
  });

  it("asks about citizenship only when the posting does", () => {
    const keys = (asks: boolean) => kitFields(buildAnswerKit({ ...CASES[1].input, job: { ...CASES[1].input.job, asksCitizenship: asks } })).map((f) => f.key);
    expect(keys(true)).toContain("eligibility.citizen");
    expect(keys(false)).not.toContain("eligibility.citizen");
  });

  it("lists roles with current work marked Present", () => {
    const kit = buildAnswerKit(CASES[0].input);
    const f = new Map(kitFields(kit).map((x) => [x.key, x.value]));
    expect(f.get("work.r0a.start")).toBe("Jan 2024");
    expect(f.get("work.r0a.end")).toBe("Present (I currently work here)");
    const undated = new Map(kitFields(buildAnswerKit(CASES[5].input)).map((x) => [x.key, x]));
    expect(undated.get("work.r5b.start")?.blank?.kind).toBe("no_fact");
  });

  it("keeps a different digest for different content, and the same one for the same", () => {
    const a = buildAnswerKit(CASES[1].input);
    expect(buildAnswerKit(CASES[1].input).digest).toBe(a.digest);
    const b = buildAnswerKit({ ...CASES[1].input, profile: { ...CASES[1].input.profile!, phone: "555-0199" } });
    expect(b.digest).not.toBe(a.digest);
    expect(a.digest).toMatch(/^[0-9a-f]{32}$/);
  });

  it("splits names without guessing a missing last name", () => {
    expect(splitName("Jordan Avery Lee")).toEqual({ first: "Jordan", last: "Lee" });
    expect(splitName("Juan Carlos de la Cruz")).toEqual({ first: "Juan", last: "de la Cruz" });
    expect(splitName("Cher")).toEqual({ first: "Cher", last: "" });
    expect(splitName(null)).toEqual({ first: "", last: "" });
  });

  it("suggests a fact from the question itself", () => {
    expect(suggestFact("What experience do you have with Excel?")).toMatch(/Excel/);
    expect(suggestFact("Tell us something about yourself")).toMatch(/in your own words/);
  });

  it("writes its own copy in plain words", () => {
    const kit = buildAnswerKit(CASES[2].input);
    const copy = [
      ...kit.groups.flatMap((g) => [g.title, g.note ?? ""]),
      ...kitFields(kit).flatMap((f) => [f.label, f.blank?.reason ?? "", f.blank?.fix.label ?? "", f.unfinished ?? ""]),
      ...ANSWER_YOURSELF.flatMap((a) => [a.label, a.why]),
    ].join("\n");
    expect(findVoiceIssues(copy)).toEqual([]);
  });
});
