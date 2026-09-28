import { z } from "zod";

/** What we pull out of an uploaded resume. Everything here is a proposal until the user confirms it. */
export const ParsedEntrySchema = z.object({
  section: z.enum(["experience", "leadership", "project", "volunteer", "research"]),
  org: z.string(),
  title: z.string().nullable(),
  location: z.string().nullable(),
  /** YYYY-MM when a month is known, YYYY otherwise. */
  startDate: z.string().nullable(),
  /** null means current. */
  endDate: z.string().nullable(),
  bullets: z.array(z.string()),
});

export const ParsedEducationSchema = z.object({
  school: z.string(),
  degree: z.string().nullable(),
  major: z.string().nullable(),
  minor: z.string().nullable(),
  gradDate: z.string().nullable(),
  gpa: z.number().nullable(),
  honors: z.array(z.string()),
  coursework: z.array(z.string()),
  /** Lines under Education that are not a school, degree, date, GPA, honor, or course. The person confirms or deletes each one. */
  details: z.array(z.string()).default([]),
});

export const ParsedResumeSchema = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  links: z.array(z.string()),
  education: z.array(ParsedEducationSchema),
  entries: z.array(ParsedEntrySchema),
  skills: z.array(z.string()),
  certifications: z.array(z.string()),
});

export type ParsedResume = z.infer<typeof ParsedResumeSchema>;
export type ParsedEntry = z.infer<typeof ParsedEntrySchema>;
export type ParsedEducation = z.infer<typeof ParsedEducationSchema>;
