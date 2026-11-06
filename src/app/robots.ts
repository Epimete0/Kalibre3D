import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/** Rutas privadas y de sesión: no tienen nada que indexar y no deben aparecer en buscadores. */
export const PRIVATE_PREFIXES = ["/dashboard", "/agenda", "/appointments", "/categories", "/clients", "/inventory", "/movements", "/products", "/profile", "/profitability", "/protocols", "/purchases", "/quotes", "/services", "/suppliers", "/team", "/tools", "/taller", "/join", "/auth", "/forgot-password", "/reset-password"];

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PREFIXES }], sitemap: `${siteUrl()}/sitemap.xml` };
}
