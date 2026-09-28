import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** The app, its API, and people's shared proof links aren't for search engines. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app/", "/api/", "/proof/"] },
    sitemap: `${site.url.replace(/\/$/, "")}/sitemap.xml`,
  };
}
