import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import { getLlm } from "@/lib/llm/provider";
import { RESUME_PARSE_V1 } from "@/lib/llm/prompts/resume-parse.v1";
import { docxHtmlLines, pdfPageLines } from "./layout-text";
import { parseResumeText } from "./rules";
import { ParsedResumeSchema, type ParsedResume } from "./types";

export type ResumeFile = { name: string; type: string; bytes: Uint8Array };

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export function isSupported(file: { name: string; type: string }): "pdf" | "docx" | null {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (file.type.includes("wordprocessingml") || name.endsWith(".docx")) return "docx";
  return null;
}

type PdfTextItem = { str: string; transform: number[]; width: number };

async function pdfLines(bytes: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(bytes);
  const lines: string[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const items = (content.items as Array<Partial<PdfTextItem>>).flatMap((item) =>
      typeof item.str === "string" && Array.isArray(item.transform)
        ? [{
            str: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width ?? 0,
            size: Math.hypot(item.transform[2], item.transform[3]) || 10,
          }]
        : [],
    );
    lines.push(...pdfPageLines(items));
  }
  return lines;
}

/** Plain text of a PDF or DOCX, one line per visual line, with flush-right columns kept apart. */
export async function resumeToText(file: ResumeFile): Promise<string> {
  const kind = isSupported(file);
  if (kind === "pdf") {
    try {
      const lines = await pdfLines(file.bytes);
      if (lines.length) return lines.join("\n");
    } catch {
      // Fall back to plain extraction below.
    }
    const pdf = await getDocumentProxy(file.bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }
  if (kind === "docx") {
    const buffer = Buffer.from(file.bytes);
    try {
      const { value } = await mammoth.convertToHtml({ buffer });
      const lines = docxHtmlLines(value);
      if (lines.length) return lines.join("\n");
    } catch {
      // Fall back to raw text below.
    }
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  throw new Error("Unsupported file type. Upload a PDF or DOCX.");
}

export type ParseResult = { parsed: ParsedResume; method: "model" | "rules"; text: string };

/**
 * Model first when one is configured (it handles unusual layouts), rules otherwise
 * or if the model fails. Either way the result is only a set of proposals.
 */
export async function parseResume(file: ResumeFile): Promise<ParseResult> {
  const text = await resumeToText(file);
  const llm = getLlm();
  if (llm) {
    try {
      const input =
        isSupported(file) === "pdf"
          ? [
              {
                type: "document" as const,
                source: { type: "base64" as const, media_type: "application/pdf" as const, data: Buffer.from(file.bytes).toString("base64") },
              },
              { type: "text" as const, text: "Extract this resume." },
            ]
          : `Extract this resume:\n\n${text}`;
      const parsed = await llm.generateObject({
        purpose: "resume.parse",
        promptVersion: RESUME_PARSE_V1.version,
        system: RESUME_PARSE_V1.system,
        input,
        schema: ParsedResumeSchema,
        effort: "low",
      });
      return { parsed, method: "model", text };
    } catch {
      // Fall through to the rules parser; the user still gets proposals to confirm.
    }
  }
  return { parsed: parseResumeText(text), method: "rules", text };
}
