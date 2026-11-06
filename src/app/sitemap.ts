import type { MetadataRoute } from "next";
import { TERMS_VERSION } from "@/lib/legal";
import { siteUrl } from "@/lib/site-url";

/** Solo las páginas públicas. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const legalUpdated = new Date(`${TERMS_VERSION}T00:00:00Z`);
  return [
    { url: `${base}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/registro`, changeFrequency: "yearly", priority: 0.8 },
    { url: `${base}/login`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/terminos`, lastModified: legalUpdated, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacidad`, lastModified: legalUpdated, changeFrequency: "yearly", priority: 0.3 },
  ];
}
