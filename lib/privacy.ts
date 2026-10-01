/** The privacy note, shown on /privacy and in Settings. Keep it short and true. */
export const PRIVACY_POINTS = [
  {
    title: "What we keep",
    text: "What you tell us about yourself (including how you described each role), the jobs you paste, the resumes you build, and your applications. We also log a few steps (like signing up or downloading a resume) so we can see where the beta gets stuck. No ads, no third-party analytics.",
  },
  {
    title: "Who sees it",
    text: "You, and the small team running the beta when we need to fix something or read feedback you send. We don't sell it or share it with employers.",
  },
  {
    title: "AI review",
    text: "Recommended resume lines are drafted by Proofline's own rules from how you described a role. That description is saved with the role and isn't sent to an AI model. When you save a line from Ideas from similar roles, your answers on that card may be sent to Google Gemini to check the wording. You see any change before it is saved. Before a resume can be downloaded, its text, the posting's requirements, and what you confirmed may also be sent to Gemini for review.",
  },
  {
    title: "Share links",
    text: "Only if you make one. Anyone with the link sees that resume's lines and what you confirmed behind them, but not your email or phone. Stop sharing turns it off at once.",
  },
  {
    title: "Free resume check",
    text: "A resume or job you paste into the public check is read once to build your report, then dropped. It isn't saved or sent to an AI model.",
  },
  {
    title: "Browser extension",
    text: "On LinkedIn, Indeed, and Handshake job pages, it reads the posting's title, company, location, and description and sends them to Proofline to work out your fit score against what you already confirmed. The posting isn't stored unless you save the job. On a Greenhouse or Lever application, when you choose Fill, it reads the form's field labels to match them to your application answers and types in only answers from what you confirmed; the form's contents aren't sent to Proofline. It never submits. It never reads your messages, your profile on those sites, or your other tabs, and it does nothing on other sites until you click its toolbar button.",
  },
  {
    title: "Take it with you",
    text: "Download everything as one file from Settings at any time.",
  },
  {
    title: "Delete it",
    text: "Settings has a button that deletes your account and everything in it: your experience, jobs you pasted, resumes, applications, and feedback. You can also ask us to do it.",
  },
] as const;
