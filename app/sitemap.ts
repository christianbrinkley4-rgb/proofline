import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/guides/content";
import { site } from "@/lib/site";

/** Public pages only. Signed-in pages and shared proof links stay out. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url.replace(/\/$/, "");
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/check`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/guides`, changeFrequency: "weekly", priority: 0.7 },
    ...GUIDES.map((g) => ({ url: `${base}/guides/${g.slug}`, lastModified: g.updated, changeFrequency: "monthly" as const, priority: 0.6 })),
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
