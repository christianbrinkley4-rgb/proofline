// Single source of truth for the product name and top-level links.
// Renaming the product should only require editing this file.
export const site = {
  name: "Proofline",
  tagline: "The job search, start to offer.",
  description:
    "Proofline finds internships and entry-level jobs that fit you, scores each one with the math shown, and writes a one-page resume for every application using only facts you've confirmed.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://proofline.app",
  contactEmail: "hello@proofline.app",
  routes: {
    signUp: "/signup",
    signIn: "/login",
  },
} as const;
