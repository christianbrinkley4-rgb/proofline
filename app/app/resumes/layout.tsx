import { resumeSans, resumeSerif } from "@/components/resume/fonts";

export default function ResumesLayout({ children }: LayoutProps<"/app/resumes">) {
  return <div className={`${resumeSerif.variable} ${resumeSans.variable}`}>{children}</div>;
}
