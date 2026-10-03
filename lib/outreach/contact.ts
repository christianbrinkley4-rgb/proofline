import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { htmlToText } from "@/lib/jobs/text";
import { USER_AGENT } from "@/lib/jobs/sources/http";
import { fetchBoardDetail } from "@/lib/jobs/sources/boards";
import type { NormalizedJob } from "@/lib/jobs/types";
import { contactFromPosting } from "./model";

function publicIp(ip: string) {
  if (isIP(ip) === 6) return /^(?:2|3)[0-9a-f]{3}:/i.test(ip);
  const [a, b] = ip.split(".").map(Number);
  return isIP(ip) === 4 && a !== 0 && a !== 10 && a !== 127 && a !== 169 && a !== 192 && a < 224 && !(a === 172 && b >= 16 && b <= 31) && !(a === 100 && b >= 64 && b <= 127) && !(a === 198 && [18, 19].includes(b));
}
/** Every redirect must remain a public HTTPS posting. Pasted text never verifies identity. */
async function readPage(raw: string): Promise<{ text: string; url: string }> {
  let url = new URL(raw);
  for (let redirects = 0; redirects <= 3; redirects++) {
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("A public HTTPS source is required.");
    const addresses = await lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some((a) => !publicIp(a.address))) throw new Error("Private addresses cannot verify a contact.");
    const response = await fetch(url, { redirect: "manual", cache: "no-store", headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(8000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) { url = new URL(response.headers.get("location") ?? "", url); continue; }
    if (!response.ok) throw new Error("The source could not be read.");
    const html = await response.text();
    if (html.length > 2_000_000) throw new Error("The source is too large.");
    return { text: htmlToText(html), url: url.toString() };
  }
  throw new Error("The source redirected too many times.");
}
export async function discoverContact(job: { source: string; sourceId: string; url: string }) {
  try {
    // These adapters read the employer's official published ATS record.
    if (["greenhouse", "lever", "ashby"].includes(job.source) && /^[a-z0-9_.-]+:[a-z0-9_-]+$/i.test(job.sourceId)) {
      const detail = await fetchBoardDetail(job.source as NormalizedJob["source"], job.sourceId);
      const contact = contactFromPosting(detail?.description ?? "", job.url);
      if (contact) return { contact, reason: null };
    }
    const page = await readPage(job.url);
    const contact = contactFromPosting(page.text, page.url);
    return { contact, reason: contact ? null : "No named recruiter or hiring manager with a public email was found in the live posting. We have not guessed a contact." };
  } catch { return { contact: null, reason: "We could not verify a contact from the live posting. You can still apply through the employer's posting." }; }
}
