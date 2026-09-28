import { z } from "zod";

/** Blank, or an address the person typed. Nothing is filled in for them. */
export const OptionalContactEmail = z
  .string()
  .trim()
  .max(254)
  .refine((value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Enter a full email address, or leave it blank.");

/**
 * The contact line on a resume or cover letter.
 * Only fields the person saved. A blank email stays off the page.
 */
export function resumeContactItems(
  profile:
    | {
        city?: string | null;
        region?: string | null;
        contactEmail?: string | null;
        phone?: string | null;
        linkedinUrl?: string | null;
        portfolioUrl?: string | null;
      }
    | null
    | undefined,
): string[] {
  if (!profile) return [];
  return [
    [profile.city, profile.region].filter(Boolean).join(", "),
    profile.contactEmail?.trim() ?? "",
    profile.phone?.trim() ?? "",
    profile.linkedinUrl?.trim() ?? "",
    profile.portfolioUrl?.trim() ?? "",
  ].filter(Boolean);
}
