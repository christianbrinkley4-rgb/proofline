import { Arimo, Tinos } from "next/font/google";

// Metric twins of Times New Roman and Arial: the preview breaks lines exactly where the PDF does.
const serif = Tinos({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-resume-serif" });
const sans = Arimo({ subsets: ["latin"], weight: ["400", "700"], style: ["normal", "italic"], variable: "--font-resume-sans" });

export default function ResumesLayout({ children }: LayoutProps<"/app/resumes">) {
  return <div className={`${serif.variable} ${sans.variable}`}>{children}</div>;
}
