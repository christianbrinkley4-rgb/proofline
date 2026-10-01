// Single source of truth for the product name and top-level links.
// Renaming the product should only require editing this file.
export const site = {
  name: "Proofline",
  tagline: "The job search, start to offer.",
  description:
    "Paste any job. Proofline checks for dealbreakers, shows how well you fit, and makes a one-page resume for it using only what you've confirmed.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://proofline.app",
  routes: {
    signUp: "/signup",
    signIn: "/login",
  },
} as const;
