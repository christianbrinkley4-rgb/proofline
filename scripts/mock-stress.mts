import { randomUUID } from "node:crypto";

// Import the services only after forcing an isolated, in-memory test database.
delete process.env.DATABASE_URL;
delete process.env.PGLITE_DIR;
process.env.VITEST = "true";
delete process.env.ANTHROPIC_API_KEY;

const { db, dbReady, schema } = await import("../lib/db");
const { createExperience } = await import("../lib/kb/experiences");
const { addFact } = await import("../lib/kb/facts");
const { updateProfile } = await import("../lib/kb/profile");
const { requirementsOf, upsertJobs } = await import("../lib/jobs/store");
const { loadCandidate } = await import("../lib/fit/candidate");
const { scoreFit } = await import("../lib/fit/engine");
const { generateBullets } = await import("../lib/resume/bullets/service");
const { documentBullets } = await import("../lib/resume/document");
const { tailorResume } = await import("../lib/resume/tailor");
const { draftCoverLetter, packetView } = await import("../lib/packet/service");
const { jobDocumentImprovementSteps } = await import("../lib/jobs/coaching");

type Role = {
  target: string;
  history: string;
  kind: "work" | "project" | "volunteer";
  fact: string;
  second: string;
  key: string;
  gap: string;
};

const ROLES: Role[] = [
  { target: "Bookkeeper", history: "Bookkeeping assistant", kind: "work", fact: "Reconciled vendor accounts in QuickBooks each month", second: "Prepared monthly expense summaries for the office manager", key: "QuickBooks", gap: "CPA" },
  { target: "Warehouse associate", history: "Order picker", kind: "work", fact: "Counted inventory and reported stock discrepancies to the shift lead", second: "Picked customer orders with a handheld scanner", key: "inventory", gap: "forklift" },
  { target: "Retail associate", history: "Cashier", kind: "work", fact: "Processed customer payments and returns at a point-of-sale register", second: "Helped shoppers find products during busy shifts", key: "point-of-sale", gap: "Salesforce" },
  { target: "Dental receptionist", history: "Clinic receptionist", kind: "work", fact: "Scheduled patient appointments and confirmed visits by phone", second: "Updated patient contact records in the clinic system", key: "appointments", gap: "insurance claims" },
  { target: "Data analyst intern", history: "Survey analysis project", kind: "project", fact: "Cleaned survey responses with Python and checked missing values", second: "Built a chart to explain survey findings to classmates", key: "Python", gap: "SQL" },
  { target: "Junior software developer", history: "Web app contributor", kind: "project", fact: "Fixed form validation bugs in a React application", second: "Wrote unit tests for the login flow", key: "React", gap: "AWS" },
  { target: "Caregiver", history: "Family caregiver", kind: "volunteer", fact: "Assisted a relative with daily patient care routines", second: "Kept daily notes to share with family members", key: "patient care", gap: "nursing license" },
  { target: "Electrician apprentice", history: "Construction helper", kind: "work", fact: "Read blueprints with a supervisor to measure materials for a job site", second: "Organized tools and materials for the construction crew", key: "blueprints", gap: "electrical license" },
  { target: "Marketing intern", history: "Club marketing volunteer", kind: "volunteer", fact: "Reviewed event traffic in Google Analytics for a student club", second: "Scheduled social media posts for a club event", key: "Google Analytics", gap: "Google Ads" },
  { target: "Sales coordinator", history: "Sales assistant", kind: "work", fact: "Updated customer records and follow-up notes in Salesforce", second: "Prepared weekly account status summaries for the sales team", key: "Salesforce", gap: "HubSpot" },
  { target: "Operations assistant", history: "Office assistant", kind: "work", fact: "Tracked supply requests in Excel and shared updates with the office manager", second: "Coordinated delivery schedules with vendors", key: "Excel", gap: "SAP" },
  { target: "Medical records clerk", history: "Records volunteer", kind: "volunteer", fact: "Updated patient files in an electronic health records system", second: "Checked records for missing contact details", key: "electronic health records", gap: "CPA" },
  { target: "Tax preparation assistant", history: "Tax office helper", kind: "work", fact: "Prepared tax returns under a supervisor using client documents", second: "Checked filing documents for missing information", key: "tax returns", gap: "CPA" },
  { target: "Math tutor", history: "Volunteer tutor", kind: "volunteer", fact: "Explained algebra problems to high school students during weekly sessions", second: "Prepared practice questions for topics students found difficult", key: "algebra", gap: "teaching license" },
  { target: "Museum collections assistant", history: "Museum volunteer", kind: "volunteer", fact: "Cataloged artifacts and updated accession records for a local museum", second: "Prepared labels for a small exhibit", key: "artifacts", gap: "SQL" },
  { target: "Restaurant shift assistant", history: "Restaurant server", kind: "work", fact: "Resolved customer service problems during busy restaurant shifts", second: "Coordinated table assignments with the kitchen team", key: "customer service", gap: "QuickBooks" },
  { target: "Clinical data manager", history: "Clinical data specialist", kind: "work", fact: "Reviewed oncology clinical data in Medidata Rave", second: "Documented CDISC SDTM mappings for study datasets", key: "Medidata Rave", gap: "SAP" },
  { target: "Hotel front desk associate", history: "Hotel receptionist", kind: "work", fact: "Handled guest services and check-in questions during evening shifts", second: "Coordinated room assignments with housekeeping staff", key: "guest services", gap: "Salesforce" },
  { target: "Preschool teaching assistant", history: "Classroom aide", kind: "work", fact: "Prepared lesson plans with a lead teacher for preschool children", second: "Supported classroom routines and shared observations with families", key: "lesson plans", gap: "CPA" },
  { target: "Delivery driver", history: "Courier", kind: "work", fact: "Planned delivery routes and confirmed drop-offs with customers", second: "Checked vehicle safety items before daily routes", key: "delivery routes", gap: "forklift" },
];

let state = 0x5eed1234;
function random() {
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return (state >>> 0) / 2 ** 32;
}

const PROFILES = 200;
const POSTINGS_PER_PROFILE = 3;
const SETTINGS = ["small nonprofit", "regional office", "local clinic", "community program", "growing company", "public service team", "campus department", "family-run business", "distributed team", "busy branch", "neighborhood organization", "research group"];
const PRIORITIES = ["accurate records", "clear handoffs", "timely follow-through", "careful documentation", "consistent service", "practical problem solving"];
const CADENCES = ["each week", "during peak periods", "throughout the month", "at the end of each shift", "during project reviews", "before team meetings", "as requests arrive", "at monthly checkpoints"];
const failures: string[] = [];
const metrics = { profiles: 0, postings: 0, resumePass: 0, letterPass: 0, relevantResume: 0, relevantResumeLead: 0, relevantLetter: 0, relevantLetterLead: 0, gapPostings: 0, gapGuidance: 0, gapDocumentCoaching: 0, gapEvidenceSafe: 0, unsupportedLeaks: 0 };
const descriptions = new Set<string>();

await dbReady;
for (let i = 0; i < PROFILES; i++) {
  const role = ROLES[Math.floor(random() * ROLES.length)];
  const id = randomUUID();
  const email = `stress-${id}@example.invalid`;
  const name = `Mock Applicant ${i + 1}`;
  await db.insert(schema.user).values({ id, name, email });
  await updateProfile(id, { fullName: name, targetRoles: [role.target], city: ["Raleigh", "Detroit", "Austin", "Portland", "Phoenix"][i % 5] });
  const relevant = await createExperience(id, { kind: role.kind, org: `Mock ${role.history} Organization`, title: role.history, startDate: ["2023-09", "2024-06", "2025-01", "2025-09"][i % 4] });
  await addFact(id, { category: "experience", content: role.fact, experienceId: relevant.id, source: "user_stated" });
  if (random() > 0.3) await addFact(id, { category: "experience", content: role.second, experienceId: relevant.id, source: "user_stated" });
  await addFact(id, { category: "experience", content: `Earned ${role.gap}`, experienceId: relevant.id, source: "resume_parsed" });
  await generateBullets(id, relevant.id);

  const distractor = ROLES[Math.floor(random() * ROLES.length)];
  if (distractor !== role && !distractor.fact.toLowerCase().includes(role.gap.toLowerCase())) {
    const unrelated = await createExperience(id, { kind: distractor.kind, org: `Mock ${distractor.history} Organization`, title: distractor.history, startDate: "2026-01" });
    await addFact(id, { category: "experience", content: distractor.fact, experienceId: unrelated.id, source: "user_stated" });
    await generateBullets(id, unrelated.id);
  }
  metrics.profiles++;

  for (let variant = 0; variant < POSTINGS_PER_PROFILE; variant++) {
    const setting = SETTINGS[(i + variant) % SETTINGS.length];
    const priority = PRIORITIES[(Math.floor(i / SETTINGS.length) + variant * 2) % PRIORITIES.length];
    const cadence = CADENCES[(Math.floor(i / (SETTINGS.length * PRIORITIES.length)) + variant * 3) % CADENCES.length];
    const description = `Responsibilities\nWork with the team on ${role.key} and related ${role.target.toLowerCase()} tasks for a ${setting}. Keep ${priority} in view ${cadence}.\nQualifications\nExperience with ${role.key} required.\nPreferred\n${role.gap} preferred.`;
    descriptions.add(description);
    const [job] = (await upsertJobs([{ source: "link", sourceId: `${id}-${variant}`, company: `Mock Employer ${i + 1}`, title: role.target, location: null, mode: "unknown", level: "entry", url: `https://example.invalid/jobs/${id}/${variant}`, description, department: null, employmentType: null, payMin: null, payMax: null, payPeriod: null, postedAt: null }])).values();
    metrics.postings++;
    try {
      const resume = await tailorResume(id, { jobId: job.id, email, variant: (["experience", "skills", "ats"] as const)[variant] });
      const bullets = documentBullets(resume.document);
      const resumeText = bullets.map((bullet) => bullet.text).join(" ");
      if (!bullets.length || resume.checks.some((check) => check.blocking && check.status === "fail")) failures.push(`${i}/${variant} ${role.target}: resume blocked or empty`);
      else metrics.resumePass++;
      if (resumeText.toLowerCase().includes(role.key.toLowerCase())) metrics.relevantResume++;
      else failures.push(`${i}/${variant} ${role.target}: relevant work omitted from resume`);
      if (resume.why[0]?.text.toLowerCase().includes(role.key.toLowerCase())) metrics.relevantResumeLead++;
      else failures.push(`${i}/${variant} ${role.target}: strongest job match did not lead resume explanation (led with ${resume.why[0]?.text ?? "nothing"})`);
      if (resumeText.toLowerCase().includes(role.gap.toLowerCase())) {
        metrics.unsupportedLeaks++;
        failures.push(`${i}/${variant} ${role.target}: unconfirmed claim in resume`);
      }

      const letter = await draftCoverLetter(id, job.id, `I want to apply my ${role.target.toLowerCase()} experience on this team.`);
      const view = await packetView(id, job.id);
      const letterText = letter.paragraphs.map((paragraph) => paragraph.text).join(" ");
      if (view?.checks.some((check) => check.blocking && !check.ok)) failures.push(`${i}/${variant} ${role.target}: letter blocked`);
      else metrics.letterPass++;
      const evidenceParagraphs = letter.paragraphs.filter((paragraph) => paragraph.purpose === "evidence");
      if (evidenceParagraphs.some((paragraph) => paragraph.text.toLowerCase().includes(role.key.toLowerCase()))) metrics.relevantLetter++;
      else failures.push(`${i}/${variant} ${role.target}: relevant work omitted from letter`);
      if (evidenceParagraphs[0]?.text.toLowerCase().includes(role.key.toLowerCase())) metrics.relevantLetterLead++;
      else failures.push(`${i}/${variant} ${role.target}: strongest job match did not lead letter (led with ${evidenceParagraphs[0]?.text ?? "nothing"})`);
      if (letterText.toLowerCase().includes(role.gap.toLowerCase())) {
        metrics.unsupportedLeaks++;
        failures.push(`${i}/${variant} ${role.target}: unconfirmed claim in letter`);
      }
    } catch (error) {
      failures.push(`${i}/${variant} ${role.target}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // A distinct, harder outcome: this person has no confirmed SQL experience.
  const gapDescription = `Responsibilities\nWrite SQL queries for a ${SETTINGS[i % SETTINGS.length]} and report findings to colleagues. Keep ${PRIORITIES[Math.floor(i / SETTINGS.length) % PRIORITIES.length]} in view ${CADENCES[Math.floor(i / (SETTINGS.length * PRIORITIES.length)) % CADENCES.length]}.\nQualifications\nSQL required for this analyst role.`;
  descriptions.add(gapDescription);
  const [gapJob] = (await upsertJobs([{ source: "link", sourceId: `${id}-gap`, company: `Mock Analyst Team ${i + 1}`, title: "Data analyst", location: null, mode: "unknown", level: "entry", url: `https://example.invalid/jobs/${id}/gap`, description: gapDescription, department: null, employmentType: null, payMin: null, payMax: null, payPeriod: null, postedAt: null }])).values();
  metrics.postings++;
  metrics.gapPostings++;
  try {
    const candidate = await loadCandidate(id);
    const fit = scoreFit({ title: gapJob.title, location: gapJob.location, mode: gapJob.mode, level: gapJob.level, requirements: requirementsOf(gapJob) }, candidate);
    if (fit.details.requiredSkills.missing.includes("SQL") && fit.nextSteps.some((step) => /SQL|learn or practice/i.test(step))) metrics.gapGuidance++;
    else failures.push(`${i}/gap ${role.target}: missing SQL was not explained`);
    const resume = await tailorResume(id, { jobId: gapJob.id, email });
    const letter = await draftCoverLetter(id, gapJob.id, "I want to explore a data role and understand where I need more practice.");
    const coaching = jobDocumentImprovementSteps({
      jobId: gapJob.id, fit,
      resumeBullets: documentBullets(resume.document).map((bullet) => bullet.text),
      letterEvidence: letter.paragraphs.filter((paragraph) => paragraph.purpose === "evidence").map((paragraph) => paragraph.text),
    });
    if (coaching[0]?.id === "required-skill-gap" && coaching[0].title.includes("SQL") && /practice it|specific example/i.test(coaching[0].detail)) metrics.gapDocumentCoaching++;
    else failures.push(`${i}/gap ${role.target}: job-specific document coaching did not distinguish missing SQL`);
    const claimText = [
      ...documentBullets(resume.document).map((bullet) => bullet.text),
      ...letter.paragraphs.filter((paragraph) => paragraph.purpose === "evidence" || paragraph.purpose === "fit").map((paragraph) => paragraph.text),
    ].join(" ");
    if (!/\bSQL\b/i.test(claimText)) metrics.gapEvidenceSafe++;
    else failures.push(`${i}/gap ${role.target}: claimed SQL despite no confirmed experience`);
  } catch (error) {
    failures.push(`${i}/gap ${role.target}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (descriptions.size !== metrics.postings) failures.push(`Only ${descriptions.size} distinct descriptions were generated for ${metrics.postings} postings`);
process.stdout.write(`${JSON.stringify({ seed: "0x5eed1234", roleTemplates: ROLES.length, distinctDescriptions: descriptions.size, ...metrics, failures: failures.length }, null, 2)}\n`);
for (const failure of failures.slice(0, 20)) process.stderr.write(`${failure}\n`);
if (failures.length > 20) process.stderr.write(`...and ${failures.length - 20} more failures\n`);
if (failures.length) process.exitCode = 1;
