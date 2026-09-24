import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/**
 * The agent's replies as React elements, never as HTML: paragraphs, "- " lists,
 * **bold**, and [links](url). Only relative paths and http(s) URLs become links.
 */

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

const APP_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").origin;
  } catch {
    return null;
  }
})();

function safeHref(href: string): string | null {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    // Links back into this app open in place. (The env var is the same on server and client, so no hydration mismatch.)
    if (APP_ORIGIN && url.origin === APP_ORIGIN) return url.pathname + url.search + url.hash;
    return url.toString();
  } catch {
    return null;
  }
}

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={`${key}-b${i++}`}>{m[1]}</strong>);
    else {
      const href = safeHref(m[3]);
      if (!href) out.push(m[2]);
      else if (href.startsWith("/")) out.push(<Link key={`${key}-l${i++}`} href={href} className="font-medium underline underline-offset-4">{m[2]}</Link>);
      else out.push(<a key={`${key}-l${i++}`} href={href} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">{m[2]}</a>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-2.5">
      {blocks.map((block, b) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={b} className="list-disc space-y-1 pl-5">
              {lines.map((l, i) => (
                <li key={i}>{inline(l.replace(/^\s*[-*]\s+/, ""), `${b}-${i}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={b} className="whitespace-pre-wrap">
            {lines.map((l, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {inline(l, `${b}-${i}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
