import { renderDocx, renderPdf } from "@/lib/resume/render";
import { SAMPLE_RESUME } from "@/lib/resume/fixtures/sample";
import { TEMPLATES } from "@/lib/resume/templates";

/** Development only: renders the sample resume in a template, to check the output by eye. */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const template = TEMPLATES[url.searchParams.get("template") === "technical" ? "technical" : "classic"];
  if (url.searchParams.get("format") === "docx") {
    return new Response(new Uint8Array(await renderDocx(SAMPLE_RESUME, template)), {
      headers: { "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    });
  }
  return new Response(new Uint8Array(await renderPdf(SAMPLE_RESUME, template, "Sample resume")), { headers: { "content-type": "application/pdf" } });
}
