import { blockingExportMessage, type ExportBlockedBody, type ExportGateCheck, isBlockingFail } from "./export-gate";

export type DownloadExportResult =
  | { ok: true }
  | { ok: false; kind: "blocked"; checks: ExportGateCheck[]; message: string }
  | { ok: false; kind: "error"; message: string };

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* fall through */
    }
  }
  const plain = /filename="([^"]+)"|filename=([^;]+)/i.exec(header);
  return plain?.[1] ?? plain?.[2]?.trim() ?? null;
}

/** Fetch an export URL; on success triggers a browser download. */
export async function downloadExport(url: string, fallbackName: string): Promise<DownloadExportResult> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return { ok: false, kind: "error", message: "Couldn't download. Check your connection and try again." };
  }

  if (res.status === 409) {
    let checks: ExportGateCheck[] = [];
    try {
      const body = (await res.json()) as ExportBlockedBody;
      if (body?.blocked && Array.isArray(body.checks)) checks = body.checks;
    } catch {
      /* plain-text 409 from an older build */
    }
    return { ok: false, kind: "blocked", checks, message: blockingExportMessage(checks) };
  }

  if (!res.ok) {
    return { ok: false, kind: "error", message: "Couldn't download. Please try again." };
  }

  const blob = await res.blob();
  const name = filenameFromDisposition(res.headers.get("content-disposition")) || fallbackName;
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Give the browser time to resolve the blob after the synthetic click.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch {
    URL.revokeObjectURL(objectUrl);
    return { ok: false, kind: "error", message: "Couldn't start the download. Please try again." };
  }
  return { ok: true };
}

export { isBlockingFail, blockingExportMessage };
