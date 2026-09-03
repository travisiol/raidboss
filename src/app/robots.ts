import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-config";

export default function robots(): MetadataRoute.Robots {
  return {
    // /lab is the shader bench: a developer tool, not a page anyone should
    // arrive at from a search result.
    rules: { userAgent: "*", allow: "/", disallow: "/lab" },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
