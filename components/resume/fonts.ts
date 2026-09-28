import { Arimo, Tinos } from "next/font/google";

// Metric twins of Times New Roman and Arial: the preview breaks lines exactly where the PDF does.
// PagePreview applies these itself, so the page it's on doesn't have to load them.
export const resumeSerif = Tinos({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-resume-serif" });
export const resumeSans = Arimo({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-resume-sans" });
