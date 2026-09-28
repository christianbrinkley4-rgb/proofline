/** The privacy note, shown on /privacy and in Settings. Keep it short and true. */
export const PRIVACY_POINTS = [
  {
    title: "What we keep",
    text: "What you tell us about yourself, the jobs you paste, the resumes you build, and your tracker. We also log a few steps (like signing up or downloading a resume) so we can see where the beta gets stuck. No ads, no third-party analytics.",
  },
  {
    title: "Who sees it",
    text: "You, and the small team running the private beta when we need to fix something or read feedback you send. We don't sell it or share it with employers.",
  },
  {
    title: "AI review",
    text: "Before a resume can be downloaded, its text, the posting's requirements, and your confirmed facts may be sent to one AI model for a single review. That's the only time your data leaves our database.",
  },
  {
    title: "Proof links",
    text: "Only if you create one. Anyone with the link sees that resume's lines and the facts you confirmed behind them, but not your email or phone. Stop sharing turns it off at once.",
  },
  {
    title: "Free resume check",
    text: "A resume or job you paste into the public check is read once to build your report, then dropped. It isn't saved or sent to an AI model.",
  },
  {
    title: "Take it with you",
    text: "Download everything as one file from Settings at any time.",
  },
  {
    title: "Delete it",
    text: "Settings has a button that deletes your account and everything in it: facts, jobs you pasted, resumes, applications, and feedback. You can also ask us to do it.",
  },
] as const;
