import schools from "./schools.json";
import onet from "@/lib/resume/onet-catalog.json";

export type ProfileOptionKind = "roles" | "schools" | "degrees" | "fields";
export type ProfileOption = { value: string; label: string };

const DEGREES = [
  "High school diploma", "GED", "Certificate", "Professional certificate", "Apprenticeship certificate",
  "Associate of Arts", "Associate of Science", "Associate in Applied Science", "Bachelor of Arts",
  "Bachelor of Science", "Bachelor of Business Administration", "Bachelor of Fine Arts",
  "Master of Arts", "Master of Science", "Master of Business Administration", "Master of Education",
  "Master of Public Health", "Doctor of Philosophy", "Doctor of Medicine", "Juris Doctor",
  "Trade diploma", "Other credential",
];
const FIELDS = [
  "Accounting", "Business Administration", "Computer Science", "Data Science", "Economics", "Education",
  "Electrical Engineering", "Finance", "Graphic Design", "Healthcare Administration", "Hospitality Management",
  "Human Resources", "Information Systems", "Marketing", "Mathematics", "Mechanical Engineering",
  "Nursing", "Political Science", "Psychology", "Public Health", "Social Work", "Supply Chain Management",
  "Welding", "Criminal Justice", "Biology", "Chemistry", "Communications", "Construction Management",
  "Culinary Arts", "Cybersecurity", "Early Childhood Education", "English", "Environmental Science",
  "Journalism", "Liberal Arts", "Medical Assisting", "Paralegal Studies", "Physics", "Sociology",
];
const COMMON_ROLES = [
  "Administrative assistant", "Bookkeeper", "Cashier", "Clinical data manager", "Customer service representative",
  "Data analyst", "Delivery driver", "Electrician apprentice", "Financial analyst", "Food service manager",
  "General manager", "Graphic designer", "Hotel operations manager", "Marketing coordinator", "Medical assistant",
  "Nursing assistant", "Project coordinator", "Receptionist", "Restaurant general manager", "Retail associate",
  "Sales associate", "Software engineer", "Staff accountant", "Teacher", "Warehouse associate",
];

const occupations = onet.occupations.map((occupation) => occupation.title);
const roleNames = [...new Set([...COMMON_ROLES, ...occupations])];

function rank(value: string, query: string): number {
  const lower = value.toLocaleLowerCase();
  if (lower === query) return 0;
  if (lower.startsWith(query)) return 1;
  if (lower.split(/[^a-z0-9]+/).some((word) => word.startsWith(query))) return 2;
  return lower.includes(query) ? 3 : 4;
}

/** Small offline search results; every form still accepts free text. */
export function searchProfileOptions(kind: ProfileOptionKind, input: string, limit = 8): ProfileOption[] {
  const query = input.trim().toLocaleLowerCase().slice(0, 80);
  const fold = (text: string) => text.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const max = Math.max(1, Math.min(12, limit));
  if (kind === "schools") {
    if (query.length < 2) return [];
    return schools
      .filter((school) => fold(`${school.name} ${school.city} ${school.state}`).includes(fold(query)))
      .sort((a, b) => rank(a.name, query) - rank(b.name, query) || a.name.localeCompare(b.name))
      .slice(0, max)
      .map((school) => ({ value: school.name, label: [school.name, [school.city, school.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ") }));
  }
  const source = kind === "roles" ? roleNames : kind === "degrees" ? DEGREES : FIELDS;
  const matches = query ? source.filter((value) => value.toLocaleLowerCase().includes(query)) : source.slice(0, kind === "roles" ? COMMON_ROLES.length : 12);
  return matches
    .sort((a, b) => rank(a, query) - rank(b, query) || a.localeCompare(b))
    .slice(0, max)
    .map((value) => ({ value, label: value }));
}
